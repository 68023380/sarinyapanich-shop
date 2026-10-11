/*
  ย้ายข้อมูลจาก SQLite เดิมไป Supabase PostgreSQL
  ใช้งานหลังจากรัน supabase/schema.sql แล้ว:

    node scripts/migrate-sqlite-to-supabase.js

  ค่าเริ่มต้นอ่านฐานข้อมูลจาก DATABASE_FILE หรือ ./data/shop.db
*/
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
require('dotenv').config();

const sqliteFile = path.resolve(process.env.DATABASE_FILE || './data/shop.db');
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
  throw new Error('กรุณาตั้ง SUPABASE_DB_URL หรือค่า SUPABASE_DB_HOST, SUPABASE_DB_USER และ SUPABASE_DB_PASSWORD ใน .env');
}

const sqlite = new Database(sqliteFile, { readonly: true });
const pool = new Pool({
  ...connectionConfig,
  ssl: process.env.NODE_ENV === 'production' || process.env.SUPABASE_DB_SSL !== 'false'
    ? { rejectUnauthorized: false }
    : false
});

function rows(table) {
  return sqlite.prepare(`select * from ${table}`).all();
}

function safeDetails(value, productId) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === null || value === undefined || String(value).trim() === '') return '[]';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch {
    console.warn(`products id=${productId}: details ไม่ใช่ JSON ที่ถูกต้อง จึงใช้ [] แทน`);
    return '[]';
  }
}

async function insertRows(client, table, columns, valuesFor) {
  const records = rows(table);
  for (const [index, record] of records.entries()) {
    const values = valuesFor(record);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    try {
      await client.query(
        `insert into public.${table} (${columns.join(', ')}) values (${placeholders}) on conflict do nothing`,
        values
      );
    } catch (error) {
      throw new Error(`${table} row ${index + 1} (id=${record.id ?? 'n/a'}): ${error.message}`);
    }
  }
  console.log(`${table}: ${records.length} rows processed`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');

    await insertRows(client, 'users', ['id', 'username', 'password_hash', 'name', 'phone', 'email', 'role', 'avatar', 'address', 'created_at'], (r) => [
      r.id, r.username, r.password_hash, r.name, r.phone, r.email, r.role, r.avatar || null, r.address || '', r.created_at
    ]);

    await insertRows(client, 'products', ['id', 'name', 'category', 'price', 'stock', 'image', 'description', 'ingredients', 'details', 'is_active', 'created_at', 'updated_at'], (r) => [
      r.id, r.name, r.category, r.price, r.stock, r.image || '', r.description || '', r.ingredients || '', safeDetails(r.details, r.id), Boolean(r.is_active), r.created_at, r.updated_at
    ]);

    await insertRows(client, 'cart_items', ['user_id', 'product_id', 'quantity'], (r) => [r.user_id, r.product_id, r.quantity]);

    await insertRows(client, 'orders', ['id', 'user_id', 'status', 'total', 'payment_method', 'customer_name', 'customer_phone', 'address', 'created_at'], (r) => [
      r.id, r.user_id, r.status, r.total, r.payment_method, r.customer_name, r.customer_phone, r.address || '', r.created_at
    ]);

    await insertRows(client, 'order_items', ['id', 'order_id', 'product_id', 'product_name', 'price', 'quantity'], (r) => [
      r.id, r.order_id, r.product_id || null, r.product_name, r.price, r.quantity
    ]);

    await client.query(`
      select setval(pg_get_serial_sequence('public.users', 'id'), coalesce((select max(id) from public.users), 1), true);
      select setval(pg_get_serial_sequence('public.products', 'id'), coalesce((select max(id) from public.products), 1), true);
      select setval(pg_get_serial_sequence('public.orders', 'id'), coalesce((select max(id) from public.orders), 1), true);
      select setval(pg_get_serial_sequence('public.order_items', 'id'), coalesce((select max(id) from public.order_items), 1), true);
    `);

    await client.query('commit');
    console.log('ย้ายข้อมูลสำเร็จ');
  } catch (error) {
    await client.query('rollback');
    console.error('ย้ายข้อมูลไม่สำเร็จ:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

main();
