const db = require('./db');
const consumer = require('./consumer');

async function main() {
  await db.initDb();
  await consumer.start();
}

main().catch((err) => {
  console.error('[ACCOUNT-SERVICE] Error fatal:', err.message);
  process.exit(1);
});
