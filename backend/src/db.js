/* Koneksi PostgreSQL + helper transaksi atomik. */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const f = path.join(__dirname, '..', '..', '.db_uri');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8').trim();
  throw new Error('DATABASE_URL tidak ditemukan. Jalankan: npm run db:up (atau set DATABASE_URL).');
}

const pool = new Pool({ connectionString: databaseUrl(), max: 10 });

/** Jalankan fn(client) dalam satu transaksi; commit jika sukses, rollback jika error. */
async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), inTransaction };
