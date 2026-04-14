/*
 * MS5 - Card Service (C)
 * UPE - Arquitectura de Microservicios POC
 *
 * Escucha eventos "account.created" desde RabbitMQ y emite una tarjeta virtual (mock).
 * Implementado en C puro con librabbitmq para mostrar que cualquier lenguaje puede
 * participar en una arquitectura de microservicios basada en eventos.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include <amqp.h>
#include <amqp_tcp_socket.h>

#define EXCHANGE_NAME  "microservices.events"
#define QUEUE_NAME     "q.card.service"
#define BINDING_KEY    "account.created"
#define MAX_RETRIES    20
#define RETRY_SECS     5

/* ─── JSON extractor minimo ─────────────────────────────────────────────────
 * Busca el valor string de una clave JSON en un texto dado.
 * Funciona para JSON plano o dentro de un objeto anidado.
 * Suficiente para los eventos bien definidos de este POC.
 */
static int json_get_string(const char *json, const char *key,
                            char *out, size_t out_size)
{
    char search[256];
    snprintf(search, sizeof(search), "\"%s\"", key);

    const char *pos = strstr(json, search);
    if (!pos) return 0;

    pos += strlen(search);
    /* saltar espacios y ':' */
    while (*pos == ' ' || *pos == ':') pos++;
    if (*pos != '"') return 0;
    pos++; /* saltar comilla de apertura */

    size_t i = 0;
    while (*pos && *pos != '"' && i < out_size - 1) {
        if (*pos == '\\') pos++; /* escape basico */
        if (*pos) out[i++] = *pos++;
    }
    out[i] = '\0';
    return i > 0;
}

/* ─── Generador de numero de tarjeta mock ───────────────────────────────── */
static void generate_card_number(char *buf, size_t size)
{
    snprintf(buf, size, "4000-%04d-%04d-%04d",
             rand() % 10000, rand() % 10000, rand() % 10000);
}

/* ─── Conexion a RabbitMQ con reintentos ────────────────────────────────── */
static amqp_connection_state_t connect_rabbitmq(const char *host, int port)
{
    for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        printf("[CARD-SERVICE] Conectando a RabbitMQ %s:%d (intento %d/%d)\n",
               host, port, attempt, MAX_RETRIES);
        fflush(stdout);

        amqp_connection_state_t conn = amqp_new_connection();
        amqp_socket_t *socket = amqp_tcp_socket_new(conn);
        if (!socket) {
            amqp_destroy_connection(conn);
            sleep(RETRY_SECS);
            continue;
        }

        int status = amqp_socket_open(socket, host, port);
        if (status != AMQP_STATUS_OK) {
            amqp_destroy_connection(conn);
            printf("[CARD-SERVICE] No se pudo conectar. Reintentando en %ds...\n", RETRY_SECS);
            fflush(stdout);
            sleep(RETRY_SECS);
            continue;
        }

        amqp_rpc_reply_t reply = amqp_login(conn, "/", 0, 131072, 0,
                                             AMQP_SASL_METHOD_PLAIN,
                                             "guest", "guest");
        if (reply.reply_type != AMQP_RESPONSE_NORMAL) {
            amqp_destroy_connection(conn);
            sleep(RETRY_SECS);
            continue;
        }

        printf("[CARD-SERVICE] Conectado a RabbitMQ exitosamente\n");
        fflush(stdout);
        return conn;
    }

    fprintf(stderr, "[CARD-SERVICE] Error: no se pudo conectar tras %d intentos\n", MAX_RETRIES);
    return NULL;
}

/* ─── Procesamiento de un mensaje ──────────────────────────────────────────*/
static void process_message(amqp_connection_state_t conn,
                             const amqp_envelope_t *envelope)
{
    /* Copiar cuerpo del mensaje a buffer local */
    char body[8192] = {0};
    size_t len = envelope->message.body.len;
    if (len >= sizeof(body)) len = sizeof(body) - 1;
    memcpy(body, envelope->message.body.bytes, len);
    body[len] = '\0';

    /* Extraer campos del nivel raiz */
    char event_id[128]   = {0};
    char event_type[64]  = {0};
    char corr_id[128]    = {0};

    json_get_string(body, "eventId",       event_id,   sizeof(event_id));
    json_get_string(body, "eventType",     event_type, sizeof(event_type));
    json_get_string(body, "correlationId", corr_id,    sizeof(corr_id));

    /* Extraer campos del objeto "payload" */
    char account_id[128]     = {0};
    char account_number[64]  = {0};
    char user_id[128]        = {0};
    char nombre[128]         = {0};
    char email[256]          = {0};

    const char *payload_pos = strstr(body, "\"payload\"");
    if (payload_pos) {
        json_get_string(payload_pos, "accountId",     account_id,     sizeof(account_id));
        json_get_string(payload_pos, "accountNumber", account_number, sizeof(account_number));
        json_get_string(payload_pos, "userId",        user_id,        sizeof(user_id));
        json_get_string(payload_pos, "nombre",        nombre,         sizeof(nombre));
        json_get_string(payload_pos, "email",         email,          sizeof(email));
    }

    /* Generar numero de tarjeta mock */
    char card_number[32];
    generate_card_number(card_number, sizeof(card_number));

    printf("[CARD-SERVICE] ================================================\n");
    printf("[CARD-SERVICE] Evento recibido: %s\n",      event_type);
    printf("[CARD-SERVICE] eventId:         %s\n",      event_id);
    printf("[CARD-SERVICE] correlationId:   %s\n",      corr_id);
    printf("[CARD-SERVICE] accountId:       %s\n",      account_id);
    printf("[CARD-SERVICE] accountNumber:   %s\n",      account_number);
    printf("[CARD-SERVICE] userId:          %s\n",      user_id);
    printf("[CARD-SERVICE] titular:         %s (%s)\n", nombre, email);
    printf("[CARD-SERVICE] ---\n");
    printf("[CARD-SERVICE] Emitiendo tarjeta virtual...\n");
    printf("[CARD-SERVICE] Numero de tarjeta: %s (MOCK VISA)\n", card_number);
    printf("[CARD-SERVICE] Tipo:              VIRTUAL\n");
    printf("[CARD-SERVICE] Estado:            EMITIDA\n");
    printf("[CARD-SERVICE] ================================================\n");
    fflush(stdout);
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
int main(void)
{
    srand((unsigned int)time(NULL));

    printf("[CARD-SERVICE] ================================================\n");
    printf("[CARD-SERVICE] Iniciando MS5 - Card Service (C)\n");
    printf("[CARD-SERVICE] Escucha: account.created -> emite tarjeta virtual\n");
    printf("[CARD-SERVICE] ================================================\n");
    fflush(stdout);

    const char *host     = getenv("RABBITMQ_HOST") ? getenv("RABBITMQ_HOST") : "rabbitmq";
    const char *port_env = getenv("RABBITMQ_PORT");
    int         port     = port_env ? atoi(port_env) : 5672;

    amqp_connection_state_t conn = connect_rabbitmq(host, port);
    if (!conn) return 1;

    /* Abrir canal */
    amqp_channel_open(conn, 1);
    amqp_rpc_reply_t res = amqp_get_rpc_reply(conn);
    if (res.reply_type != AMQP_RESPONSE_NORMAL) {
        fprintf(stderr, "[CARD-SERVICE] Error abriendo canal\n");
        return 1;
    }

    /* Declarar exchange (topic, durable) */
    amqp_exchange_declare(conn, 1,
        amqp_cstring_bytes(EXCHANGE_NAME),
        amqp_cstring_bytes("topic"),
        0, 1, 0, 0, amqp_empty_table);
    amqp_get_rpc_reply(conn);

    /* Declarar cola (durable) */
    amqp_queue_declare(conn, 1,
        amqp_cstring_bytes(QUEUE_NAME),
        0, 1, 0, 0, amqp_empty_table);
    amqp_get_rpc_reply(conn);

    /* Binding: q.card.service <- account.created */
    amqp_queue_bind(conn, 1,
        amqp_cstring_bytes(QUEUE_NAME),
        amqp_cstring_bytes(EXCHANGE_NAME),
        amqp_cstring_bytes(BINDING_KEY),
        amqp_empty_table);
    amqp_get_rpc_reply(conn);

    /* Iniciar consumo (manual ack) */
    amqp_basic_consume(conn, 1,
        amqp_cstring_bytes(QUEUE_NAME),
        amqp_empty_bytes,
        0, 0, 0, amqp_empty_table);
    amqp_get_rpc_reply(conn);

    /* prefetch = 1 */
    amqp_basic_qos(conn, 1, 0, 1, 0);

    printf("[CARD-SERVICE] Cola '%s' (binding: %s) lista\n", QUEUE_NAME, BINDING_KEY);
    printf("[CARD-SERVICE] Esperando eventos account.created...\n");
    fflush(stdout);

    /* Loop principal de consumo */
    for (;;) {
        amqp_envelope_t envelope;
        amqp_maybe_release_buffers(conn);

        res = amqp_consume_message(conn, &envelope, NULL, 0);

        if (res.reply_type == AMQP_RESPONSE_NORMAL) {
            process_message(conn, &envelope);
            amqp_basic_ack(conn, 1, envelope.delivery_tag, 0);
            amqp_destroy_envelope(&envelope);
        } else {
            fprintf(stderr, "[CARD-SERVICE] Error consumiendo mensaje. Saliendo.\n");
            fflush(stderr);
            break;
        }
    }

    amqp_channel_close(conn, 1, AMQP_REPLY_SUCCESS);
    amqp_connection_close(conn, AMQP_REPLY_SUCCESS);
    amqp_destroy_connection(conn);
    return 0;
}
