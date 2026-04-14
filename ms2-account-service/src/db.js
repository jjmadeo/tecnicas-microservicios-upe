const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'ms2_accounts_db',
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID NOT NULL,
        account_number VARCHAR(20) NOT NULL UNIQUE,
        status         VARCHAR(20) DEFAULT 'ACTIVE',
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id     VARCHAR(100) PRIMARY KEY,
        processed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('[ACCOUNT-SERVICE] Tablas "accounts" y "processed_events" listas en PostgreSQL');
  } finally {
    client.release();
  }
}

async function isEventProcessed(eventId) {
  const result = await pool.query(
    'SELECT 1 FROM processed_events WHERE event_id = $1',
    [eventId]
  );
  return result.rowCount > 0;
}

async function createAccountIdempotent(eventId, userId, accountNumber) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Marca el evento como procesado (UNIQUE constraint garantiza idempotencia)
    await client.query(
      'INSERT INTO processed_events (event_id) VALUES ($1)',
      [eventId]
    );

    // Crea la cuenta financiera
    const result = await client.query(
      'INSERT INTO accounts (user_id, account_number) VALUES ($1, $2) RETURNING *',
      [userId, accountNumber]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initDb, isEventProcessed, createAccountIdempotent };
