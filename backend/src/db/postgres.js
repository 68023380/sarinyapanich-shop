const { Pool } = require('pg');
require('dotenv').config();

const hasSeparateConfig = Boolean(
  process.env.SUPABASE_DB_HOST &&
  process.env.SUPABASE_DB_USER &&
  process.env.SUPABASE_DB_PASSWORD
);
const connectionString = hasSeparateConfig ? null : (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL);
const connectionConfig = connectionString ? { connectionString } : {
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD
};

if (!connectionString && (!connectionConfig.host || !connectionConfig.user || !connectionConfig.password)) {
  throw new Error('กรุณาตั้ง SUPABASE_DB_URL หรือ SUPABASE_DB_HOST, SUPABASE_DB_USER และ SUPABASE_DB_PASSWORD ในไฟล์ .env');
}

const pool = new Pool({
  ...connectionConfig,
  ssl: process.env.NODE_ENV === 'production' || process.env.SUPABASE_DB_SSL !== 'false'
    ? { rejectUnauthorized: false }
    : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

async function query(text, values = []) {
  return pool.query(text, values);
}

async function healthCheck() {
  const result = await query('select now() as server_time');
  return result.rows[0];
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, healthCheck, close };
