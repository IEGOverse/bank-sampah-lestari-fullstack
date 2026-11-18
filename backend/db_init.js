/* Load database/schema.sql + buat akun uji (password di-hash bcrypt).
   Idempoten: tabel pakai IF NOT EXISTS; akun di-skip jika sudah ada.
   Jalankan: npm run db:up  (papan terminal terpisah)  →  npm run db:init */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const f = path.join(__dirname, '..', '.db_uri');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8').trim();
  throw new Error('DATABASE_URL tidak ditemukan. Jalankan dulu: npm run db:up');
}

(async () => {
  const pool = new Pool({ connectionString: dbUrl() });
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf-8');
    await client.query(schema);
    console.log('schema.sql dimuat.');

    const users = [
      ['ketua', 'ketua123', 'Ketua Bank Sampah', 'Ketua'],
      ['petugas', 'petugas123', 'Petugas Timbang 1', 'Petugas Timbang'],
      ['petugas2', 'petugas2123', 'Petugas Timbang 2', 'Petugas Timbang'],
      ['bendahara', 'bendahara123', 'Bendahara Bank Sampah', 'Bendahara'],
      ['nasabah', 'nasabah123', 'Bpk. Nasabah A', 'Nasabah'],
      ['nasabah2', 'nasabah2123', 'Ibu Nasabah B', 'Nasabah'],
      ['nasabah3', 'nasabah3123', 'Bpk. Nasabah C', 'Nasabah'],
    ];
    for (const [username, password, nama, peran] of users) {
      const hash = await bcrypt.hash(password, 10);
      const q = `INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, status)
                 VALUES ($1,$2,$3,$4,TRUE)
                 ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, nama_lengkap = EXCLUDED.nama_lengkap, peran = EXCLUDED.peran, status = TRUE
                 RETURNING id_pengguna`;
      const r = await client.query(q, [username, hash, nama, peran]);
      const id = r.rows[0].id_pengguna;
      if (peran === 'Nasabah') {
        const alamat = 'Lingk. II / Jaga 2, Kelurahan Airmadidi';
        await client.query(
          `INSERT INTO nasabah (id_pengguna, nama_nasabah, no_hp, alamat, saldo)
           VALUES ($1,$2,'0812-0000-0001',$3,0)
           ON CONFLICT (id_pengguna) DO NOTHING`,
          [id, nama, alamat]
        );
      }
      console.log('akun', username, 'siap.');
    }
    // Contoh harga periode (DATA DUMMY — di produksi Ketua menetapkan lewat US-05).
    const hargaOkt = { 1: 2300, 2: 900, 3: 1400, 4: 1100, 5: 4800, 6: 7500, 7: 700 };
    const hargaNov = { 1: 2500, 2: 1000, 3: 1500, 4: 1200, 5: 5000, 6: 8000, 7: 800 };
    for (const idJenis of Object.keys(hargaNov)) {
      const id = Number(idJenis);
      await client.query(
        `INSERT INTO harga_sampah (id_jenis, harga_per_kg, periode_mulai, periode_selesai, id_penetap)
         VALUES ($1,$2,'2026-10-01','2026-10-31',$3)
         ON CONFLICT (id_jenis, periode_mulai) DO NOTHING`,
        [id, hargaOkt[id], 1]
      );
      await client.query(
        `INSERT INTO harga_sampah (id_jenis, harga_per_kg, periode_mulai, periode_selesai, id_penetap)
         VALUES ($1,$2,'2026-11-01',NULL,$3)
         ON CONFLICT (id_jenis, periode_mulai) DO NOTHING`,
        [id, hargaNov[id], 1]
      );
    }
    console.log('Harga contoh (DATA DUMMY) termuat.');
    console.log('SELESAI.');
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error('GAGAL:', e); process.exit(1); });
