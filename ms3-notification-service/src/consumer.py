import asyncio
import json
import sys

import aio_pika

EXCHANGE_NAME = "microservices.events"
QUEUE_NAME    = "q.notification.service"

# Este servicio escucha AMBOS eventos
BINDINGS = ["user.created", "account.created"]


def send_mock_email(payload: dict, event_type: str):
    email   = payload.get("email", "N/A")
    nombre  = payload.get("nombre", "Usuario")
    user_id = payload.get("userId", "N/A")

    if event_type == "user.created":
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Para: {email}")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Asunto: Bienvenido/a a la plataforma, {nombre}!")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Cuerpo: Tu cuenta fue creada exitosamente. userId={user_id}")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Estado: ENVIADO (mock)")
    elif event_type == "account.created":
        account_number = payload.get("accountNumber", "N/A")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Para: {email}")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Asunto: Tu cuenta financiera fue creada, {nombre}!")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Cuerpo: Numero de cuenta: {account_number}")
        print(f"[NOTIFICATION-SERVICE] [EMAIL] Estado: ENVIADO (mock)")
    sys.stdout.flush()


def send_mock_push(payload: dict, event_type: str):
    nombre  = payload.get("nombre", "Usuario")
    user_id = payload.get("userId", "N/A")

    if event_type == "user.created":
        print(f"[NOTIFICATION-SERVICE] [PUSH]  userId: {user_id}")
        print(f"[NOTIFICATION-SERVICE] [PUSH]  Mensaje: Bienvenido/a {nombre}! Tu cuenta esta lista.")
        print(f"[NOTIFICATION-SERVICE] [PUSH]  Estado: ENVIADO (mock)")
    elif event_type == "account.created":
        account_number = payload.get("accountNumber", "N/A")
        print(f"[NOTIFICATION-SERVICE] [PUSH]  userId: {user_id}")
        print(f"[NOTIFICATION-SERVICE] [PUSH]  Mensaje: Cuenta financiera {account_number} activada!")
        print(f"[NOTIFICATION-SERVICE] [PUSH]  Estado: ENVIADO (mock)")
    sys.stdout.flush()


async def handle_message(message: aio_pika.IncomingMessage):
    async with message.process():
        event      = json.loads(message.body)
        event_type = event.get("eventType", "unknown")
        event_id   = event.get("eventId", "N/A")
        payload    = event.get("payload", {})
        correlation_id = event.get("correlationId", "N/A")

        print("[NOTIFICATION-SERVICE] ================================================")
        print(f"[NOTIFICATION-SERVICE] Evento recibido: {event_type}")
        print(f"[NOTIFICATION-SERVICE] eventId={event_id} | correlationId={correlation_id}")
        sys.stdout.flush()

        if event_type == "user.created":
            print(f"[NOTIFICATION-SERVICE] Enviando notificaciones de bienvenida a {payload.get('email')}")
            sys.stdout.flush()
            send_mock_email(payload, event_type)
            send_mock_push(payload, event_type)

        elif event_type == "account.created":
            print(f"[NOTIFICATION-SERVICE] Enviando notificaciones de cuenta financiera")
            sys.stdout.flush()
            send_mock_email(payload, event_type)
            send_mock_push(payload, event_type)

        else:
            print(f"[NOTIFICATION-SERVICE] Tipo de evento no manejado: {event_type}")

        print("[NOTIFICATION-SERVICE] ================================================")
        sys.stdout.flush()


async def start_consumer(rabbitmq_url: str, max_attempts: int = 20):
    for attempt in range(1, max_attempts + 1):
        try:
            print(f"[NOTIFICATION-SERVICE] Conectando a RabbitMQ (intento {attempt}/{max_attempts})...")
            sys.stdout.flush()
            connection = await aio_pika.connect_robust(rabbitmq_url)
            print("[NOTIFICATION-SERVICE] Conectado a RabbitMQ")
            sys.stdout.flush()
            break
        except Exception as e:
            print(f"[NOTIFICATION-SERVICE] RabbitMQ no disponible: {e}. Reintentando en 5s...")
            sys.stdout.flush()
            await asyncio.sleep(5)
    else:
        print("[NOTIFICATION-SERVICE] No se pudo conectar a RabbitMQ. Saliendo.")
        sys.exit(1)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)

        # Declarar exchange
        exchange = await channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
        )

        # Declarar cola
        queue = await channel.declare_queue(QUEUE_NAME, durable=True)

        # Bind para AMBOS eventos
        for routing_key in BINDINGS:
            await queue.bind(exchange, routing_key=routing_key)
            print(f"[NOTIFICATION-SERVICE] Binding: {QUEUE_NAME} <- {routing_key}")

        sys.stdout.flush()
        print(f"[NOTIFICATION-SERVICE] Escuchando eventos: {', '.join(BINDINGS)}")
        print("[NOTIFICATION-SERVICE] Listo para enviar notificaciones (mock)")
        sys.stdout.flush()

        await queue.consume(handle_message)
        await asyncio.Future()  # Mantener vivo indefinidamente
