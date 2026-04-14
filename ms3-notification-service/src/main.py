import asyncio
import os
import sys

from consumer import start_consumer


async def main():
    print("[NOTIFICATION-SERVICE] ================================================")
    print("[NOTIFICATION-SERVICE] Iniciando MS3 - Notification Service (Python)")
    print("[NOTIFICATION-SERVICE] Este servicio NO tiene base de datos (stateless)")
    print("[NOTIFICATION-SERVICE] ================================================")
    sys.stdout.flush()

    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
    await start_consumer(rabbitmq_url)


if __name__ == "__main__":
    asyncio.run(main())
