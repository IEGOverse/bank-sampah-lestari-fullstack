/* Route Auth: register / login / logout / me  (US-01, US-02) */
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, inTransaction } = require('../db');
const { signToken, authRequired } = require('../auth');
const { writeAudit } = require('../audit');
const { httpError } = require('../errorHandler');

const router = express.Router();

// US-01 — Registrasi mandiri: akun otomatis berperan Nasabah
router.post('/register', async (req, res, next) => {
  try {
    const { nama_lengkap, no_hp, alamat, username, password } = req.body || {};
    if (!nama_lengkap || !no_hp || !alamat || !username || !password) {
      throw httpError(400, 'VALIDATION', 'nama_lengkap, no_hp, alamat, username, dan password wajib diisi.');
    }
    const _noHP = String(no_hp).trim();
    if (!/^(\+62|62|0)8[0-9]{7,11}$/.test(_noHP.replace(/[\s\-]/g, ''))) {
      throw httpError(400, 'VALIDATION', 'Format nomor HP harus diawali 08xxx / +62xxx, angka saja, minimal 10 digit.');
    }
    if (String(username).trim().length < 3) throw httpError(400, 'VALIDATION', 'Username minimal 3 karakter.');
    if (String(password).length < 4) throw httpError(400, 'VALIDATION', 'Password minimal 4 karakter.');

    const hash = await bcrypt.hash(String(password), 10);
    const result = await inTransaction(async (client) => {
      const userQ = `INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, status)
                     VALUES ($1,$2,$3,'Nasabah',TRUE)
                     RETURNING id_pengguna, username, nama_lengkap, peran`;
      let user;
      try {
        user = (await client.query(userQ, [String(username).trim().toLowerCase(), hash, String(nama_lengkap).trim()])).rows[0];
      } catch (e) {
        if (e.code === '23505') throw httpError(409, 'USERNAME_TAKEN', 'Username sudah dipakai.');
        throw e;
      }
      const nb = (await client.query(
        `INSERT INTO nasabah (id_pengguna, nama_nasabah, no_hp, alamat, saldo) VALUES ($1,$2,$3,$4,0)
         RETURNING no_rekening`, [user.id_pengguna, user.nama_lengkap, String(no_hp).trim(), String(alamat).trim()])).rows[0];
      await writeAudit(client, { tabel: 'pengguna', id_referensi: user.username, aksi: 'INSERT', alasan: 'Registrasi mandiri nasabah baru', id_pengguna: user.id_pengguna });
      return { user, no_rekening: nb.no_rekening };
    });

    res.status(201).json({ message: 'Registrasi berhasil. Silakan login.', no_rekening: result.no_rekening, pengguna: { ...result.user, peran: 'Nasabah' } });
  } catch (e) { next(e); }
});

// US-02 — Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) throw httpError(400, 'VALIDATION', 'Username dan password wajib diisi.');
    const u = (await pool.query('SELECT * FROM pengguna WHERE LOWER(username) = LOWER($1)', [String(username).trim()])).rows[0];
    const ok = u && await bcrypt.compare(String(password), u.password_hash);
    if (!ok) throw httpError(401, 'CREDENTIALS', 'Username atau password salah.');
    if (!u.status) throw httpError(403, 'ACCOUNT_DISABLED', 'Akun nonaktif. Hubungi Ketua.');

    // ambil no_rekening bila nasabah
    const nb = (await pool.query('SELECT no_rekening FROM nasabah WHERE id_pengguna = $1', [u.id_pengguna])).rows[0];
    const payload = { id: u.id_pengguna, username: u.username, peran: u.peran, no_rekening: nb?.no_rekening || null };
    const token = signToken(payload);
    res.json({ token, pengguna: { id: u.id_pengguna, username: u.username, nama_lengkap: u.nama_lengkap, peran: u.peran, no_rekening: payload.no_rekening } });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => res.json({ message: 'Logout berhasil (token dibuang klien).' }));

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const u = (await pool.query('SELECT id_pengguna, username, nama_lengkap, peran, status FROM pengguna WHERE id_pengguna = $1', [req.user.id])).rows[0];
    if (!u || !u.status) throw httpError(401, 'UNAUTHORIZED', 'Akun tidak aktif.');
    const nb = (await pool.query('SELECT no_rekening, saldo, no_hp, alamat, tgl_daftar FROM nasabah WHERE id_pengguna = $1', [u.id_pengguna])).rows[0];
    res.json({ pengguna: { ...u, no_rekening: nb?.no_rekening || null }, nasabah: nb || null });
  } catch (e) { next(e); }
});

module.exports = router;
