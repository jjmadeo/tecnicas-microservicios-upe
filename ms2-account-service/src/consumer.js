const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const EXCHANGE_NAME = 'microservices.events';
const QUEUE_NAME    = 'q.account.service';
const BINDING_KEY   = 'user.created';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateAccountNumber() {
  const digits = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  return `ACC-${digits}`;
}

async function connectWithRetry(url, maxAttempts = 20) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const conn = await amqplib.connect(url);
      console.log('[ACCOUNT-SERVICE] Conectado a RabbitMQ');
      return conn;
    } catch (err) {
      console.log(`[ACCOUNT-SERVICE] RabbitMQ no disponible (intento ${i}/${maxAttempts}). Reintentando en 5s...`);
      await sleep(5000);
    }
  }
  throw new Error('No se pudo conectar a RabbitMQ');
}

async function publishAccountCreated(channel, userEvent, account) {
  const event = {
    eventId:       uuidv4(),
    eventType:     'account.created',
    timestamp:     new Date().toISOString(),
    service:       'account-service',
    correlationId: userEvent.correlationId,
    payload: {
      accountId:     account.id,
      accountNumber: account.account_number,
      status:        account.status,
      userId:        userEvent.payload.userId,
      nombre:        userEvent.payload.nombre,
      apellido:      userEvent.payload.apellido,
      email:         userEvent.payload.email,
    },
    audit: {
      requestId:   uuidv4(),
      sessionId:   userEvent.audit?.sessionId || uuidv4(),
      environment: 'development',
      version:     '1.0.0',
      processedBy: 'account-service',
    }
  };

  channel.publish(
    EXCHANGE_NAME,
    'account.created',
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );

  console.log('[ACCOUNT-SERVICE] Evento "account.created" publicado');
  console.log(`[ACCOUNT-SERVICE] eventId=${event.eventId} | accountId=${account.id}`);
  console.log('[ACCOUNT-SERVICE] Suscriptores notificados: MS3 (Notification), MS4 (Audit), MS5 (Card)');
}

async function handleMessage(channel, msg) {
  const event = JSON.parse(msg.content.toString());

  console.log('[ACCOUNT-SERVICE] ================================================');
  console.log(`[ACCOUNT-SERVICE] Evento recibido: ${event.eventType}`);
  console.log(`[ACCOUNT-SERVICE] eventId=${event.eventId} | userId=${event.payload?.userId}`);

  // IDEMPOTENCIA: verificar si ya procesamos este evento
  console.log(`[ACCOUNT-SERVICE] Verificando idempotencia para eventId=${event.eventId}...`);
  const alreadyProcessed = await db.isEventProcessed(event.eventId);

  if (alreadyProcessed) {
    console.log(`[ACCOUNT-SERVICE] DUPLICATE EVENT DETECTED, SKIPPING | eventId=${event.eventId}`);
    console.log('[ACCOUNT-SERVICE] ================================================');
    channel.ack(msg);
    return;
  }

  console.log('[ACCOUNT-SERVICE] Evento nuevo. Creando cuenta financiera...');

  const accountNumber = generateAccountNumber();
  console.log(`[ACCOUNT-SERVICE] Numero de cuenta generado: ${accountNumber}`);

  try {
    const account = await db.createAccountIdempotent(
      event.eventId,
      event.payload.userId,
      accountNumber
    );

    console.log(`[ACCOUNT-SERVICE] Cuenta creada en PostgreSQL | accountId=${account.id}`);
    console.log(`[ACCOUNT-SERVICE] userId=${account.user_id} | accountNumber=${account.account_number} | status=${account.status}`);

    await publishAccountCreated(channel, event, account);

    console.log('[ACCOUNT-SERVICE] ================================================');
    channel.ack(msg);
  } catch (err) {
    // Codigo 23505 = unique_violation en PostgreSQL (race condition de idempotencia)
    if (err.code === '23505') {
      console.log(`[ACCOUNT-SERVICE] DUPLICATE EVENT (race condition) DETECTED, SKIPPING | eventId=${event.eventId}`);
      channel.ack(msg);
    } else {
      console.error(`[ACCOUNT-SERVICE] Error procesando evento: ${err.message}`);
      channel.nack(msg, false, true);
    }
  }
}

async function start() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  console.log('[ACCOUNT-SERVICE] Iniciando MS2 - Account Service (Node.js)');
  console.log(`[ACCOUNT-SERVICE] Conectando a RabbitMQ: ${url}`);

  const conn = await connectWithRetry(url);
  const channel = await conn.createChannel();

  // Declarar exchange
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  // Declarar cola y binding
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, BINDING_KEY);

  channel.prefetch(1);

  console.log(`[ACCOUNT-SERVICE] Escuchando cola "${QUEUE_NAME}" (binding: ${BINDING_KEY})`);
  console.log('[ACCOUNT-SERVICE] Listo para recibir eventos user.created');

  channel.consume(QUEUE_NAME, (msg) => {
    if (msg) handleMessage(channel, msg).catch(console.error);
  });
}

module.exports = { start };
