# Microservicios POC — Universidad Provincial de Ezeiza

POC didáctico de arquitectura de microservicios poliglotas comunicados por eventos.
Desarrollado para la cátedra de **Tecnologías de Programación / Arquitectura de Sistemas** — UPE.

---

## Arquitectura

```
Browser
   │
   ▼
Frontend (Node.js :3000)
   │  REST POST /api/users
   ▼
MS1 - User Service (Java / Spring Boot)  ──► PostgreSQL
   │
   │  publica: user.created
   ▼
RabbitMQ  (Topic Exchange: microservices.events)
   ├──► MS2 - Account Service (Node.js)  ──► PostgreSQL  ──► publica: account.created
   ├──► MS3 - Notification Service (Python)  [sin DB]
   └──► MS4 - Audit Service (Go)  ──► MongoDB

                account.created
                     │
          RabbitMQ ──┤
                     ├──► MS3 - Notification Service (Python)
                     ├──► MS4 - Audit Service (Go)
                     └──► MS5 - Card Service (C)
```

### Stack por servicio

| Servicio | Lenguaje | Base de datos | Puerto |
|---|---|---|---|
| Frontend | Node.js (Express) | — | 3000 |
| MS1 - User Service | Java (Spring Boot) | PostgreSQL | 8080 (interno) |
| MS2 - Account Service | Node.js | PostgreSQL | interno |
| MS3 - Notification Service | Python (aio-pika) | — | interno |
| MS4 - Audit Service | Go | MongoDB | interno |
| MS5 - Card Service | C (librabbitmq) | — | interno |
| Log Viewer | Node.js (Express + SSE) | — | 9999 |
| RabbitMQ | — | — | 5672 / 15672 |

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 4.x o superior
- 4 GB de RAM disponibles para Docker
- Puertos libres: `3000`, `5672`, `9999`, `15672`

---

## Levantar el proyecto

```bash
git clone https://github.com/jjmadeo/tecnicas-microservicios-upe.git
cd tecnicas-microservicios-upe
docker compose up --build
```

**Primera vez:** el build tarda ~5 minutos (descarga imágenes, compila Maven/Go/C).
**Siguiente vez:** ~1 minuto (todo cacheado).

Cuando veas en la terminal:

```
Container frontend  Started
```

Todo está listo.

---

## URLs

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Formulario de registro de usuario |
| http://localhost:9999 | Visor de logs en tiempo real (todos los servicios) |
| http://localhost:15672 | RabbitMQ Management UI — usuario: `guest` / `guest` |

---

## Cómo usar

1. Abrí **http://localhost:9999** en una pestaña (logs en tiempo real)
2. Abrí **http://localhost:3000** en otra pestaña (formulario)
3. Completá el formulario con nombre, apellido, email y edad
4. Enviá y observá el flujo de eventos en el log viewer

### Qué vas a ver en los logs

```
USER-SERVICE      [USER-SERVICE] Guardando usuario en PostgreSQL...
USER-SERVICE      [USER-SERVICE] Publicando evento user.created | eventId=abc-123
ACCOUNT-SERVICE   [ACCOUNT-SERVICE] Recibido: user.created | eventId=abc-123
ACCOUNT-SERVICE   [ACCOUNT-SERVICE] Verificando idempotencia...
ACCOUNT-SERVICE   [ACCOUNT-SERVICE] Cuenta creada | accountId=xyz-456
AUDIT-SERVICE     [AUDIT-SERVICE] Recibido routing key: user.created
NOTIFICATION-SVC  [NOTIFICATION-SERVICE] [EMAIL] Enviando a juan@...
NOTIFICATION-SVC  [NOTIFICATION-SERVICE] [PUSH]  Mensaje: Bienvenido Juan!
AUDIT-SERVICE     [AUDIT-SERVICE] Recibido routing key: account.created
CARD-SERVICE      [CARD-SERVICE] Card Number: 4000-1234-5678-9012 (MOCK VISA)
```

---

## Demo de conceptos clave

### Idempotencia (MS2)

Enviá el mismo email **dos veces** desde el formulario:
- Primera vez → usuario creado, cuenta creada
- Segunda vez → el frontend muestra `⚠️ Email ya registrado`

Para testear la idempotencia directamente en la cola:
1. Abrí RabbitMQ Management en http://localhost:15672
2. Entrá a **Queues** → `q.account.service` → **Publish message**
3. Pegá el mismo JSON con el mismo `eventId` dos veces
4. En los logs vas a ver: `DUPLICATE EVENT DETECTED, SKIPPING`

### Resiliencia (MS3)

```bash
# Detener el servicio de notificaciones
docker stop ms3-notification-service

# Enviar un usuario → MS1 y MS2 siguen funcionando sin problema
# Los mensajes se acumulan en la cola q.notification.service

# Reiniciar → procesa el backlog automáticamente
docker start ms3-notification-service
```

### Ver exchanges y colas en RabbitMQ

En http://localhost:15672 → **Exchanges** → `microservices.events`:
- Tipo: `topic`
- Bindings: `user.created`, `account.created`, `#` (audit captura todo)

---

## Estructura del proyecto

```
.
├── docker-compose.yml
├── frontend/                    # Node.js + HTML
├── ms1-user-service/            # Java Spring Boot
├── ms2-account-service/         # Node.js
├── ms3-notification-service/    # Python
├── ms4-audit-service/           # Go
├── ms5-card-service/            # C
└── log-viewer/                  # Visor de logs custom (SSE)
```

---

## Formato del evento

Todos los eventos que viajan por RabbitMQ tienen esta estructura:

```json
{
  "eventId": "uuid-v4",
  "eventType": "user.created",
  "timestamp": "2026-04-14T18:00:00.000Z",
  "service": "user-service",
  "correlationId": "uuid-v4",
  "payload": {
    "userId": "uuid",
    "nombre": "Juan",
    "apellido": "Perez",
    "email": "juan@example.com",
    "edad": 30
  },
  "audit": {
    "requestId": "uuid-v4",
    "sessionId": "uuid-v4",
    "ipAddress": "192.168.1.42",
    "userAgent": "Mozilla/5.0 ...",
    "environment": "development",
    "version": "1.0.0",
    "processedBy": "user-service"
  }
}
```

---

## Apagar todo

```bash
docker compose down
```

> Los datos se pierden al bajar (intencional para uso en clase). Cada `docker compose up` arranca limpio.

---

## Desarrollado por

**Juan Madeo** — Ayudante de cátedra, Universidad Provincial de Ezeiza
[linkedin.com/in/madeo-juan](https://www.linkedin.com/in/madeo-juan/)
