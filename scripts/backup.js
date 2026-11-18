/* Ekspor seluruh tabel public ke stdout sebagai JSON.
   Penggunaan:
     node scripts/backup.js > backup-YYYYMMDD-HHMM.json
   (atau lewat SSH ke service Railway:
      ssh railway-app "node /app/scripts/backup.js" > backup.json)
*/
const { Pool } = require('pg');

const TABLES = [
  'pengguna',
  'nasabah',
  'jenis_sampah',
  'harga_sampah',
  'transaksi_setor',
  'detail_setor',
  'penarikan_saldo',
  'stok_gudang',
  'stok_mutasi',
  'penimbangan_ulang',
  'penimbangan_ulang_detail',
  'penjualan_pengepul',
  'detail_penjualan',
  'kas_operasional',
  'audit_log',
];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const fs = require('fs');
  const path = require('path');
  const f = path.join(__dirname, '..', '.db_uri');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8').trim();
  throw new Error('DATABASE_URL tidak ditemukan.');
}

(async () => {
  const pool = new Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  const dump = { meta: { version: 1, created_at: new Date().toISOString(), app: 'bank-sampah-lestari' }, data: {} };
  try {
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY 1`);
      dump.data[table] = rows;
    }
    process.stdout.write(JSON.stringify(dump, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error('backup gagal:', e.message); process.exit(1); });
