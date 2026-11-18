/* Pulihkan database dari file JSON hasil backup.js.
   Penggunaan:
     node scripts/restore.js backup.json
   PERINGATAN: akan menghapus data yang ada di target DB lalu memuat ulang.
*/
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const TABLES_RESTORE_ORDER = [
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

const SERIAL_PK = {
  pengguna: 'id_pengguna',
  nasabah: null,
  jenis_sampah: 'id_jenis',
  harga_sampah: 'id_harga',
  transaksi_setor: 'id_setor',
  detail_setor: 'id_detail',
  penarikan_saldo: 'id_tarik',
  stok_gudang: 'id_stok',
  stok_mutasi: 'id_mutasi',
  penimbangan_ulang: 'id_penimbangan',
  penimbangan_ulang_detail: 'id_detail_penimbangan',
  penjualan_pengepul: 'id_penjualan',
  detail_penjualan: 'id_detail_penjualan',
  kas_operasional: 'id_kas',
  audit_log: 'id_audit',
};

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const f = path.join(__dirname, '..', '.db_uri');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8').trim();
  throw new Error('DATABASE_URL tidak ditemukan.');
}

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('File backup tidak ditemukan:', file);
    process.exit(1);
  }
  const dump = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const pool = new Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  try {
    // Pastikan schema ada dulu (schema.sql bersifat idempotent)
    const schemaFile = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaFile)) {
      const schema = fs.readFileSync(schemaFile, 'utf-8');
      await client.query(schema);
    }
    // Matikan FK sementara, kosongkan tabel, lalu muat data
    await client.query('BEGIN');
    const allTables = TABLES_RESTORE_ORDER.join(', ');
    await client.query(`TRUNCATE ${allTables} RESTART IDENTITY CASCADE`);
    for (const table of TABLES_RESTORE_ORDER) {
      const rows = (dump.data && dump.data[table]) || [];
      if (!rows.length) continue;
      // Ambil daftar kolom dari baris pertama
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;
      for (const row of rows) {
        const values = cols.map(c => row[c]);
        await client.query(sql, values);
      }
    }
    // Reset sequence setelah insert
    for (const [table, col] of Object.entries(SERIAL_PK)) {
      if (!col) continue;
      const seqResult = await client.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(MAX(${col}), 1), true) AS val FROM ${table}`,
        [table, col]
      );
      console.log('  sequence', table, '->', seqResult.rows[0].val);
    }
    await client.query('COMMIT');
    console.log('Restore selesai.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Restore gagal:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
