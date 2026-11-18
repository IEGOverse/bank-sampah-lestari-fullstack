/* Route utama: pengguna/nasabah/harga/setoran/penarikan/stok/kas/koreksi/laporan */
const express = require('express');
const { pool, inTransaction } = require('../db');
const { authRequired } = require('../auth');
const { requireRole } = require('../rbac');
const { writeAudit } = require('../audit');
const { httpError } = require('../errorHandler');

const router = express.Router();
router.use(authRequired);

/* ---------- US-03 Penetapan peran (Ketua) ---------- */
router.get('/pengguna', requireRole('Ketua'), async (req, res, next) => {
  try {
    const rows = (await pool.query(`
      SELECT p.id_pengguna, p.username, p.nama_lengkap, p.peran, p.status, n.no_rekening, n.no_buku_tabungan
      FROM pengguna p LEFT JOIN nasabah n ON n.id_pengguna = p.id_pengguna ORDER BY p.id_pengguna`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});
router.patch('/pengguna/:id/peran', requireRole('Ketua'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id); const { peran } = req.body || {};
    if (!['Nasabah', 'Ketua', 'Petugas Timbang', 'Bendahara'].includes(peran)) throw httpError(400, 'VALIDATION', 'Peran tidak valid.');
    if (id === req.user.id) throw httpError(400, 'SELF_CHANGE', 'Tidak dapat mengubah peran sendiri.');
    const before = (await pool.query('SELECT peran FROM pengguna WHERE id_pengguna = $1', [id])).rows[0];
    if (!before) throw httpError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
    const after = (await pool.query('UPDATE pengguna SET peran = $1 WHERE id_pengguna = $2 RETURNING id_pengguna, username, nama_lengkap, peran', [peran, id])).rows[0];
    await writeAudit(pool, { tabel: 'pengguna', id_referensi: after.username, aksi: 'UPDATE', alasan: `Perubahan peran ${before.peran} → ${peran}`, id_pengguna: req.user.id, data_sebelum: before, data_sesudah: after });
    res.json(after);
  } catch (e) { next(e); }
});
router.patch('/pengguna/:id/status', requireRole('Ketua'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id); const { status } = req.body || {};
    if (typeof status !== 'boolean') throw httpError(400, 'VALIDATION', 'status (boolean) wajib diisi.');
    const after = (await pool.query('UPDATE pengguna SET status = $1 WHERE id_pengguna = $2 RETURNING id_pengguna, username, peran, status', [status, id])).rows[0];
    if (!after) throw httpError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
    await writeAudit(pool, { tabel: 'pengguna', id_referensi: after.username, aksi: 'UPDATE', alasan: `Status akun → ${status}`, id_pengguna: req.user.id });
    res.json(after);
  } catch (e) { next(e); }
});

/* ---------- US-06 Saldo & riwayat ---------- */
async function riwayatRekening(noRek) {
  const setor = (await pool.query(`SELECT tgl_setor iso, 'Setoran' tipe, no_referensi ref, nilai_tabungan nominal, TRUE plus FROM transaksi_setor WHERE no_rekening = $1`, [noRek])).rows;
  const tarik = (await pool.query(`SELECT tgl_tarik iso, 'Penarikan' tipe, no_referensi ref, jumlah_tarik nominal, FALSE plus FROM penarikan_saldo WHERE no_rekening = $1 AND status_transaksi = 'Berhasil'`, [noRek])).rows;
  return [...setor, ...tarik].sort((a, b) => (a.iso < b.iso ? 1 : -1));
}
router.patch('/nasabah/:noRek/no-buku-tabungan', requireRole('Ketua'), async (req, res, next) => {
  try {
    const rek = String(req.params.noRek).trim().toUpperCase();
    const nb = String(req.body?.no_buku_tabungan ?? '').trim();
    if (nb.length && !/^[A-Z0-9\-]{3,30}$/i.test(nb)) throw httpError(400, 'VALIDATION', 'No. buku tabungan tidak valid.');
    const before = (await pool.query('SELECT no_buku_tabungan FROM nasabah WHERE no_rekening = $1', [rek])).rows[0];
    if (!before) throw httpError(404, 'NOT_FOUND', 'Nasabah tidak ditemukan.');
    const after = (await pool.query('UPDATE nasabah SET no_buku_tabungan = $1 WHERE no_rekening = $2 RETURNING no_rekening, nama_nasabah, no_buku_tabungan', [nb || null, rek])).rows[0];
    await writeAudit(pool, { tabel: 'nasabah', id_referensi: rek, aksi: 'UPDATE', alasan: nb ? `No. buku tabungan diisi/ubah → ${nb}` : 'No. buku tabungan dihapus', id_pengguna: req.user.id, data_sebelum: before, data_sesudah: after });
    res.json(after);
  } catch (e) { next(e); }
});

router.get('/nasabah/me', async (req, res, next) => {
  try {
    const nb = (await pool.query('SELECT no_rekening, nama_nasabah, no_hp, alamat, saldo, tgl_daftar, status_aktif, no_buku_tabungan FROM nasabah WHERE id_pengguna = $1', [req.user.id])).rows[0];
    if (!nb) throw httpError(404, 'NOT_FOUND', 'Data nasabah tidak ditemukan untuk akun ini.');
    res.json(nb);
  } catch (e) { next(e); }
});
router.get('/nasabah/me/riwayat', async (req, res, next) => {
  try {
    const nb = (await pool.query('SELECT no_rekening, saldo FROM nasabah WHERE id_pengguna = $1', [req.user.id])).rows[0];
    if (!nb) return res.json({ saldo: 0, riwayat: [] });
    res.json({ saldo: nb.saldo, riwayat: await riwayatRekening(nb.no_rekening) });
  } catch (e) { next(e); }
});
router.get('/nasabah/:noRek/riwayat', requireRole('Ketua', 'Bendahara'), async (req, res, next) => {
  try {
    const nb = (await pool.query('SELECT no_rekening, nama_nasabah, saldo, no_buku_tabungan, status_aktif FROM nasabah WHERE no_rekening = $1', [req.params.noRek])).rows[0];
    if (!nb) throw httpError(404, 'NOT_FOUND', 'Nasabah tidak ditemukan.');
    res.json({ ...nb, riwayat: await riwayatRekening(nb.no_rekening) });
  } catch (e) { next(e); }
});

/* ---------- US-05 Harga ---------- */
router.get('/harga', async (req, res, next) => {
  try {
    const iso = (req.query.berlaku && /^\d{4}-\d{2}-\d{2}$/.test(req.query.berlaku)) ? req.query.berlaku : '2026-11-16';
    const rows = (await pool.query(`
      SELECT h.id_harga, h.id_jenis, j.nama_jenis, h.harga_per_kg, h.periode_mulai, h.periode_selesai
      FROM harga_sampah h JOIN jenis_sampah j ON j.id_jenis = h.id_jenis
      WHERE h.periode_mulai <= $1 AND (h.periode_selesai IS NULL OR h.periode_selesai >= $1)
      ORDER BY j.nama_jenis`, [iso])).rows;
    res.json(rows);
  } catch (e) { next(e); }
});
router.get('/harga/riwayat', async (req, res, next) => {
  try {
    const rows = (await pool.query(`
      SELECT h.id_harga, j.nama_jenis, h.harga_per_kg, h.periode_mulai, h.periode_selesai, p.nama_lengkap AS penetap
      FROM harga_sampah h JOIN jenis_sampah j ON j.id_jenis = h.id_jenis LEFT JOIN pengguna p ON p.id_pengguna = h.id_penetap
      ORDER BY h.periode_mulai DESC, j.nama_jenis`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/harga', requireRole('Ketua'), async (req, res, next) => {
  try {
    const { id_jenis, harga_per_kg } = req.body || {};
    const harga = Number(harga_per_kg);
    if (!Number.isInteger(Number(id_jenis)) || !Number.isFinite(harga) || harga <= 0) throw httpError(400, 'VALIDATION', 'id_jenis & harga_per_kg (>0) wajib.');
    const today = new Date().toISOString().slice(0, 10);
    const out = await inTransaction(async (client) => {
      const cur = await client.query(`SELECT * FROM harga_sampah WHERE id_jenis = $1 AND periode_selesai IS NULL`, [id_jenis]);
      if (cur.rows.length) {
        const end = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
        await client.query(`UPDATE harga_sampah SET periode_selesai = $1 WHERE id_harga = $2`, [end, cur.rows[0].id_harga]);
      }
      const inserted = (await client.query(
        `INSERT INTO harga_sampah (id_jenis, harga_per_kg, periode_mulai, periode_selesai, id_penetap) VALUES ($1,$2,$3,NULL,$4) RETURNING *`,
        [id_jenis, harga, today, req.user.id])).rows[0];
      await writeAudit(client, { tabel: 'harga_sampah', id_referensi: jenisNama(inserted, null) || String(id_jenis), aksi: 'UPDATE', alasan: `Harga baru Rp${harga}/kg berlaku mulai ${today}`, id_pengguna: req.user.id });
      return inserted;
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});
const jenisNama = (row) => row && row.nama_jenis ? row.nama_jenis : null;

/* ---------- US-04 Setoran ---------- */
router.get('/setoran/by-ref/:ref', async (req, res, next) => {
  try {
    const ref = String(req.params.ref).trim().toUpperCase();
    const hdr = (await pool.query(`SELECT s.no_referensi, s.tgl_setor, s.no_rekening, s.total_berat, s.total_nilai, s.nilai_tabungan, s.nilai_kas_operasional, n.nama_nasabah
                                     FROM transaksi_setor s JOIN nasabah n ON n.no_rekening = s.no_rekening WHERE s.no_referensi = $1`, [ref])).rows[0];
    if (!hdr) return res.status(404).json({ error: 'NOT_FOUND', message: 'Setoran tidak ditemukan.' });
    const items = (await pool.query(`SELECT d.id_jenis, j.nama_jenis, d.berat_kg, d.harga_saat_setor, d.subtotal
                                       FROM detail_setor d JOIN jenis_sampah j ON j.id_jenis = d.id_jenis
                                       WHERE d.id_setor = (SELECT id_setor FROM transaksi_setor WHERE no_referensi = $1)`, [ref])).rows;
    res.json({ ...hdr, items });
  } catch (e) { next(e); }
});

/* ---------- US-12 Koreksi ---------- */
router.post('/koreksi', requireRole('Ketua'), async (req, res, next) => {
  try {
    const { tipe, no_referensi, alasan, items_baru, nominal_baru, keterangan_baru } = req.body || {};
    if (!alasan || !String(alasan).trim()) throw httpError(400, 'VALIDATION', 'Alasan koreksi wajib diisi.');
    const ref = String(no_referensi || '').trim().toUpperCase();
    const iso = new Date().toISOString();

    if (tipe === 'kas') {
      const k = (await pool.query('SELECT * FROM kas_operasional WHERE no_referensi = $1', [ref])).rows[0];
      if (!k) throw httpError(404, 'NOT_FOUND', 'Transaksi kas tidak ditemukan.');
      const before = { nominal: Number(k.nominal), keterangan: k.keterangan };
      const nominal = Number(nominal_baru);
      const ket = String(keterangan_baru || '').trim();
      if (!Number.isFinite(nominal) || nominal <= 0 || !ket) throw httpError(400, 'VALIDATION', 'nominal_baru (>0) & keterangan_baru wajib.');
      const after = (await pool.query(
        'UPDATE kas_operasional SET nominal = $1, keterangan = $2 WHERE no_referensi = $3 RETURNING no_referensi, tipe_kas, nominal, keterangan',
        [nominal, ket, ref])).rows[0];
      await writeAudit(pool, { tabel: 'kas_operasional', id_referensi: ref, aksi: 'KOREKSI', alasan: String(alasan).trim() + ` (nominal ${before.nominal} → ${nominal})`, id_pengguna: req.user.id, data_sebelum: before, data_sesudah: { ...after, nominal: Number(after.nominal) } });
      return res.json({ message: 'Kas terkoreksi.', kas: after });
    }

    if (tipe === 'setoran') {
      const s = (await pool.query('SELECT * FROM transaksi_setor WHERE no_referensi = $1', [ref])).rows[0];
      if (!s) throw httpError(404, 'NOT_FOUND', 'Setoran tidak ditemukan.');
      if (!Array.isArray(items_baru) || !items_baru.length) throw httpError(400, 'VALIDATION', 'items_baru wajib array berisi {id_jenis, berat_kg}.');
      const out = await inTransaction(async (client) => {
        let totalBerat = 0, totalNilai = 0;
        const newItems = [];
        for (const it of items_baru) {
          const id_jenis = Number(it.id_jenis), berat = Number(it.berat_kg);
          if (!Number.isInteger(id_jenis) || !Number.isFinite(berat) || berat <= 0) throw httpError(400, 'VALIDATION', 'Setiap item_baru wajib id_jenis & berat_kg > 0.');
          const cur = (await client.query('SELECT * FROM detail_setor WHERE id_setor = $1 AND id_jenis = $2', [s.id_setor, id_jenis])).rows[0];
          if (!cur) throw httpError(409, 'ITEM_NOT_FOUND', `Item jenis ${id_jenis} tidak ada pada setoran ${ref}.`);
          const sub = Math.round(berat * Number(cur.harga_saat_setor));
          totalBerat += berat; totalNilai += sub;
          newItems.push({ id_jenis, berat_kg: berat, harga_saat_setor: cur.harga_saat_setor, subtotal: sub, _diff: berat - Number(cur.berat_kg) });
        }
        const tab = Math.round(totalNilai * 0.9), kas = totalNilai - tab;
        const dTab = tab - Number(s.nilai_tabungan), dKas = kas - Number(s.nilai_kas_operasional);
        // Update nasabah saldo sebesar delta nilai tabungan
        await client.query('UPDATE nasabah SET saldo = saldo + $1 WHERE no_rekening = $2', [dTab, s.no_rekening]);
        // Update kas 10% yang otomatis (referensi ke setor ini)
        if (dKas !== 0) {
          await client.query(`UPDATE kas_operasional SET nominal = GREATEST(nominal + $1, 0) WHERE referensi_tabel='transaksi_setor' AND referensi_id = $2`, [dKas, s.id_setor]);
        }
        // Update stok per jenis sesuai selisih berat
        for (const it of newItems) {
          if (it._diff !== 0) {
            const baru = (await client.query('UPDATE stok_gudang SET total_berat_kg = GREATEST(total_berat_kg + $1, 0), tgl_terakhir_update=NOW() WHERE id_jenis = $2 RETURNING total_berat_kg', [it._diff, it.id_jenis])).rows[0];
            await client.query(`INSERT INTO stok_mutasi (id_jenis, tipe_mutasi, perubahan_kg, saldo_setelah_kg, referensi_tabel, referensi_id, id_pengguna) VALUES ($1,'KOREKSI',$2,$3,'transaksi_setor',$4,$5)`, [it.id_jenis, it._diff, baru?.total_berat_kg ?? 0, s.id_setor, req.user.id]);
          }
        }
        // Update detail & header
        for (const it of newItems) {
          await client.query('UPDATE detail_setor SET berat_kg=$1, subtotal=$2 WHERE id_setor=$3 AND id_jenis=$4', [it.berat_kg, it.subtotal, s.id_setor, it.id_jenis]);
        }
        await client.query('UPDATE transaksi_setor SET total_berat=$1, total_nilai=$2, nilai_tabungan=$3, nilai_kas_operasional=$4 WHERE id_setor=$5', [totalBerat, totalNilai, tab, kas, s.id_setor]);
        await writeAudit(client, { tabel: 'transaksi_setor', id_referensi: ref, aksi: 'KOREKSI', alasan: String(alasan).trim() + ` (nilai ${s.total_nilai} → ${totalNilai})`, id_pengguna: req.user.id, data_sebelum: { total_berat: s.total_berat, total_nilai: s.total_nilai, nilai_tabungan: s.nilai_tabungan }, data_sesudah: { total_berat: totalBerat, total_nilai: totalNilai, nilai_tabungan: tab } });
        return { no_referensi: ref, total_nilai: totalNilai, nilai_tabungan: tab, nilai_kas_operasional: kas };
      });
      return res.json({ message: 'Setoran terkoreksi.', setoran: out });
    }

    if (tipe === 'penarikan') {
      const p = (await pool.query('SELECT * FROM penarikan_saldo WHERE no_referensi = $1', [ref])).rows[0];
      if (!p) throw httpError(404, 'NOT_FOUND', 'Penarikan tidak ditemukan.');
      if (p.status_transaksi === 'Dibatalkan') throw httpError(409, 'ALREADY_CANCELLED', 'Penarikan sudah dibatalkan.');
      const jumlah = Number(nominal_baru);
      if (!Number.isFinite(jumlah) || jumlah <= 0 || jumlah > Number(p.saldo_sebelum)) throw httpError(400, 'VALIDATION', `Jumlah baru harus > 0 dan ≤ saldo sebelum (Rp${p.saldo_sebelum}).`);
      const delta = jumlah - Number(p.jumlah_tarik);
      const sisa = Number(p.saldo_sebelum) - jumlah;
      const out = await inTransaction(async (client) => {
        await client.query('UPDATE nasabah SET saldo = saldo - $1 WHERE no_rekening = $2', [delta, p.no_rekening]);
        const after = (await client.query('UPDATE penarikan_saldo SET jumlah_tarik = $1, sisa_saldo = $2 WHERE no_referensi = $3 RETURNING no_referensi, jumlah_tarik, sisa_saldo', [jumlah, sisa, ref])).rows[0];
        await writeAudit(client, { tabel: 'penarikan_saldo', id_referensi: ref, aksi: 'KOREKSI', alasan: String(alasan).trim() + ` (jumlah Rp${p.jumlah_tarik} → Rp${jumlah})`, id_pengguna: req.user.id, data_sebelum: { jumlah_tarik: p.jumlah_tarik, sisa_saldo: p.sisa_saldo }, data_sesudah: { jumlah_tarik: after.jumlah_tarik, sisa_saldo: after.sisa_saldo } });
        return after;
      });
      return res.json({ message: 'Penarikan terkoreksi.', penarikan: out });
    }

    throw httpError(400, 'VALIDATION', "tipe harus 'kas', 'setoran', atau 'penarikan'.");
  } catch (e) { next(e); }
});

/* ---------- US-04 Setoran ---------- */
router.get('/nasabah', requireRole('Petugas Timbang', 'Ketua', 'Bendahara'), async (req, res, next) => {
  try {
    const rows = (await pool.query(`SELECT no_rekening, nama_nasabah, no_hp, saldo FROM nasabah WHERE status_aktif ORDER BY nama_nasabah`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/setoran', requireRole('Petugas Timbang', 'Ketua'), async (req, res, next) => {
  try {
    const { no_rekening, tgl_setor, items } = req.body || {};
    const iso = (typeof tgl_setor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tgl_setor)) ? tgl_setor : new Date().toISOString().slice(0, 10);
    if (!Array.isArray(items) || !items.length) throw httpError(400, 'VALIDATION', 'items (array) wajib diisi.');
    const clean = [];
    for (const it of items) {
      const berat = Number(it.berat_kg); const id_jenis = Number(it.id_jenis);
      if (!Number.isFinite(berat) || berat <= 0 || !Number.isInteger(id_jenis)) throw httpError(400, 'VALIDATION', 'Setiap item wajib punya id_jenis & berat_kg > 0.');
      clean.push({ id_jenis, berat_kg: berat });
    }
    const out = await inTransaction(async (client) => {
      const nas = (await client.query('SELECT * FROM nasabah WHERE no_rekening = $1 FOR UPDATE', [no_rekening])).rows[0];
      if (!nas) throw httpError(404, 'NOT_FOUND', 'Nasabah tidak ditemukan.');
      let total = 0, totalBerat = 0;
      const detail = [];
      for (const it of clean) {
        const h = (await client.query(`
          SELECT id_harga, harga_per_kg FROM harga_sampah
          WHERE id_jenis = $1 AND periode_mulai <= $2 AND (periode_selesai IS NULL OR periode_selesai >= $2)
          ORDER BY periode_mulai DESC LIMIT 1`, [it.id_jenis, iso])).rows[0];
        if (!h) throw httpError(409, 'NO_PRICE', `Tidak ada harga berlaku untuk id_jenis ${it.id_jenis} pada ${iso}.`);
        const sub = Math.round(it.berat_kg * Number(h.harga_per_kg));
        detail.push({ ...it, id_harga: h.id_harga, harga_saat_setor: h.harga_per_kg, subtotal: sub });
        total += sub; totalBerat += it.berat_kg;
      }
      const tab = Math.round(total * 0.9), kas = total - tab;
      const hdr = (await client.query(
        `INSERT INTO transaksi_setor (no_rekening, id_petugas, tgl_setor, total_berat, total_nilai, nilai_tabungan, nilai_kas_operasional)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_setor, no_referensi`,
        [no_rekening, req.user.id, iso, totalBerat, total, tab, kas])).rows[0];
      for (const d of detail) {
        await client.query(
          `INSERT INTO detail_setor (id_setor, id_jenis, id_harga, berat_kg, harga_saat_setor, subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
          [hdr.id_setor, d.id_jenis, d.id_harga, d.berat_kg, d.harga_saat_setor, d.subtotal]);
        const inStock = (await client.query(`UPDATE stok_gudang SET total_berat_kg = total_berat_kg + $1, tgl_terakhir_update = NOW() WHERE id_jenis = $2 RETURNING total_berat_kg`, [d.berat_kg, d.id_jenis])).rows[0];
        await client.query(
          `INSERT INTO stok_mutasi (id_jenis, tipe_mutasi, perubahan_kg, saldo_setelah_kg, referensi_tabel, referensi_id, id_pengguna) VALUES ($1,'SETOR',$2,$3,'transaksi_setor',$4,$5)`,
          [d.id_jenis, d.berat_kg, inStock.total_berat_kg, hdr.id_setor, req.user.id]);
      }
      await client.query('UPDATE nasabah SET saldo = saldo + $1 WHERE no_rekening = $2', [tab, no_rekening]);
      await client.query(
        `INSERT INTO kas_operasional (tipe_kas, nominal, tgl_kas, keterangan, id_petugas, referensi_tabel, referensi_id) VALUES ('PEMASUKAN',$1,$2,$3,$4,'transaksi_setor',$5)`,
        [kas, iso, `Porsi 10% setoran ${hdr.no_referensi}`, req.user.id, hdr.id_setor]);
      await writeAudit(client, { tabel: 'transaksi_setor', id_referensi: hdr.no_referensi, aksi: 'INSERT', alasan: 'Pencatatan setoran nasabah', id_pengguna: req.user.id, data_sesudah: { total, nilai_tabungan: tab, nilai_kas_operasional: kas } });
      return { ...hdr, total_nilai: total, nilai_tabungan: tab, nilai_kas_operasional: kas, total_berat: totalBerat, items: detail };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});
router.get('/setoran', async (req, res, next) => {
  try {
    const rek = req.query.no_rekening;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const sql = rek
      ? `SELECT s.no_referensi, s.tgl_setor, s.total_berat, s.total_nilai, s.nilai_tabungan, n.nama_nasabah
         FROM transaksi_setor s JOIN nasabah n ON n.no_rekening = s.no_rekening WHERE s.no_rekening = $1 ORDER BY s.tgl_setor DESC LIMIT $2`
      : `SELECT s.no_referensi, s.tgl_setor, s.total_berat, s.total_nilai, s.nilai_tabungan, n.nama_nasabah
         FROM transaksi_setor s JOIN nasabah n ON n.no_rekening = s.no_rekening ORDER BY s.tgl_setor DESC LIMIT $1`;
    const rows = (await pool.query(sql, rek ? [rek, limit] : [limit])).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- US-07 Penarikan (Bendahara) ---------- */
router.post('/penarikan', requireRole('Bendahara', 'Ketua'), async (req, res, next) => {
  try {
    const { no_rekening, jumlah_tarik } = req.body || {};
    const jumlah = Number(jumlah_tarik);
    if (!no_rekening || !Number.isFinite(jumlah) || jumlah <= 0) throw httpError(400, 'VALIDATION', 'no_rekening & jumlah_tarik (>0) wajib.');
    const iso = new Date().toISOString();
    const bulan = iso.slice(0, 7);
    const desember = iso.slice(5, 7) === '12';
    const out = await inTransaction(async (client) => {
      const nas = (await client.query('SELECT * FROM nasabah WHERE no_rekening = $1 FOR UPDATE', [no_rekening])).rows[0];
      if (!nas) throw httpError(404, 'NOT_FOUND', 'Nasabah tidak ditemukan.');
      const jumlahBulan = (await client.query(`SELECT COUNT(*)::int c FROM penarikan_saldo WHERE no_rekening = $1 AND to_char(tgl_tarik, 'YYYY-MM') = $2 AND status_transaksi = 'Berhasil'`, [no_rekening, bulan])).rows[0].c;
      if (!desember) {
        if (jumlah < 50000) throw httpError(409, 'MIN_WITHDRAWAL', 'Penarikan minimal Rp50.000 (BR-08).');
        if (jumlahBulan >= 1) throw httpError(409, 'MONTHLY_LIMIT', 'Nasabah sudah menarik 1× bulan ini (BR-08).');
      }
      if (jumlah > Number(nas.saldo)) throw httpError(409, 'INSUFFICIENT_BALANCE', 'Saldo tidak mencukupi.');
      const rec = (await client.query(
        `INSERT INTO penarikan_saldo (no_rekening, id_bendahara, tgl_tarik, jumlah_tarik, saldo_sebelum, sisa_saldo, status_transaksi)
         VALUES ($1,$2,NOW(),$3,$4,$5,'Berhasil') RETURNING no_referensi, tgl_tarik`,
        [no_rekening, req.user.id, jumlah, nas.saldo, Number(nas.saldo) - jumlah])).rows[0];
      await client.query('UPDATE nasabah SET saldo = saldo - $1 WHERE no_rekening = $2', [jumlah, no_rekening]);
      await writeAudit(client, { tabel: 'penarikan_saldo', id_referensi: rec.no_referensi, aksi: 'INSERT', alasan: `Penarikan Rp${jumlah} oleh ${nas.nama_nasabah}`, id_pengguna: req.user.id });
      return { ...rec, sisa_saldo: Number(nas.saldo) - jumlah };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});
router.get('/penarikan', async (req, res, next) => {
  try {
    const rek = req.query.no_rekening; const ref = req.query.ref; const limit = Math.min(Number(req.query.limit) || 20, 100);
    const where = [];
    const params = [];
    if (rek) { params.push(rek); where.push(`p.no_rekening = $${params.length}`); }
    if (ref) { params.push(String(ref).toUpperCase()); where.push(`p.no_referensi = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(limit);
    const rows = (await pool.query(`
      SELECT p.no_referensi, p.tgl_tarik, p.jumlah_tarik, p.sisa_saldo, p.saldo_sebelum, p.status_transaksi, n.nama_nasabah
      FROM penarikan_saldo p JOIN nasabah n ON n.no_rekening = p.no_rekening
      ${whereSql} ORDER BY p.tgl_tarik DESC LIMIT $${params.length}`, params)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- US-08 Stok ---------- */
router.get('/stok', async (req, res, next) => {
  try {
    const rows = (await pool.query(`
      SELECT s.id_jenis, j.nama_jenis, j.kategori, s.total_berat_kg, s.estimasi_nilai, s.tgl_terakhir_update
      FROM stok_gudang s JOIN jenis_sampah j ON j.id_jenis = s.id_jenis ORDER BY j.nama_jenis`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});
router.get('/stok/mutasi', async (req, res, next) => {
  try {
    const rows = (await pool.query(`
      SELECT m.tgl_mutasi, j.nama_jenis, m.tipe_mutasi, m.perubahan_kg, m.saldo_setelah_kg, m.referensi_tabel, m.referensi_id
      FROM stok_mutasi m JOIN jenis_sampah j ON j.id_jenis = m.id_jenis ORDER BY m.tgl_mutasi DESC, m.id_mutasi DESC LIMIT 50`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- US-09 Penimbangan ulang ---------- */
router.post('/penimbangan-ulang', requireRole('Petugas Timbang'), async (req, res, next) => {
  try {
    const { tgl_penimbangan, items } = req.body || {};
    const iso = (typeof tgl_penimbangan === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tgl_penimbangan)) ? tgl_penimbangan : new Date().toISOString().slice(0, 10);
    if (!Array.isArray(items) || !items.length) throw httpError(400, 'VALIDATION', 'items wajib diisi.');
    const out = await inTransaction(async (client) => {
      const hdr = (await client.query(`INSERT INTO penimbangan_ulang (tgl_penimbangan, id_petugas) VALUES ($1,$2) RETURNING id_penimbangan, no_referensi`, [iso, req.user.id])).rows[0];
      let totalPenyusutan = 0;
      for (const it of items) {
        const id_jenis = Number(it.id_jenis), pengepul = Number(it.berat_pengepul);
        if (!Number.isInteger(id_jenis) || !Number.isFinite(pengepul) || pengepul < 0) throw httpError(400, 'VALIDATION', 'id_jenis & berat_pengepul wajib valid.');
        const cur = (await client.query('SELECT total_berat_kg FROM stok_gudang WHERE id_jenis = $1 FOR UPDATE', [id_jenis])).rows[0];
        const sebelum = Number(cur?.total_berat_kg || 0);
        const selisih = pengepul - sebelum;
        if (selisih !== 0) {
          const baru = Math.max(0, +(sebelum + selisih).toFixed(2));
          await client.query('UPDATE stok_gudang SET total_berat_kg = $1, tgl_terakhir_update = NOW() WHERE id_jenis = $2', [baru, id_jenis]);
          await client.query(`INSERT INTO stok_mutasi (id_jenis, tipe_mutasi, perubahan_kg, saldo_setelah_kg, referensi_tabel, referensi_id, id_pengguna) VALUES ($1,'PENYESUAIAN',$2,$3,'penimbangan_ulang',$4,$5)`,
            [id_jenis, selisih, baru, hdr.id_penimbangan, req.user.id]);
        }
        if (selisih < 0) totalPenyusutan += -selisih;
        await client.query(`INSERT INTO penimbangan_ulang_detail (id_penimbangan, id_jenis, berat_sebelumnya, berat_pengepul) VALUES ($1,$2,$3,$4)`,
          [hdr.id_penimbangan, id_jenis, sebelum, pengepul]);
      }
      await writeAudit(client, { tabel: 'penimbangan_ulang', id_referensi: hdr.no_referensi, aksi: 'INSERT', alasan: 'Penimbangan ulang pengepul', id_pengguna: req.user.id });
      return { ...hdr, tgl_penimbangan: iso, total_penyusutan: totalPenyusutan };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});

/* ---------- US-10 Penjualan ke pengepul ---------- */
router.post('/penjualan', requireRole('Ketua'), async (req, res, next) => {
  try {
    const { tgl_penjualan, keterangan, items } = req.body || {};
    const iso = (typeof tgl_penjualan === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tgl_penjualan)) ? tgl_penjualan : new Date().toISOString().slice(0, 10);
    if (!Array.isArray(items) || !items.length) throw httpError(400, 'VALIDATION', 'items wajib diisi.');
    const out = await inTransaction(async (client) => {
      const hdr = (await client.query(`INSERT INTO penjualan_pengepul (tgl_penjualan, id_pencatat, keterangan) VALUES ($1,$2,$3) RETURNING id_penjualan, no_referensi`, [iso, req.user.id, keterangan || null])).rows[0];
      for (const it of items) {
        const id_jenis = Number(it.id_jenis), berat = Number(it.berat_keluar_kg);
        if (!Number.isInteger(id_jenis) || !Number.isFinite(berat) || berat <= 0) throw httpError(400, 'VALIDATION', 'Item penjualan tidak valid.');
        const cur = (await client.query('SELECT total_berat_kg FROM stok_gudang WHERE id_jenis = $1 FOR UPDATE', [id_jenis])).rows[0];
        if (!cur || Number(cur.total_berat_kg) < berat) throw httpError(409, 'INSUFFICIENT_STOCK', `Stok id_jenis ${id_jenis} tidak cukup.`);
        const baru = +(Number(cur.total_berat_kg) - berat).toFixed(2);
        await client.query('UPDATE stok_gudang SET total_berat_kg = $1, tgl_terakhir_update = NOW() WHERE id_jenis = $2', [baru, id_jenis]);
        await client.query(`INSERT INTO detail_penjualan (id_penjualan, id_jenis, berat_keluar_kg) VALUES ($1,$2,$3)`, [hdr.id_penjualan, id_jenis, berat]);
        await client.query(`INSERT INTO stok_mutasi (id_jenis, tipe_mutasi, perubahan_kg, saldo_setelah_kg, referensi_tabel, referensi_id, id_pengguna) VALUES ($1,'PENJUALAN',$2,$3,'penjualan_pengepul',$4,$5)`,
          [id_jenis, -berat, baru, hdr.id_penjualan, req.user.id]);
      }
      await writeAudit(client, { tabel: 'penjualan_pengepul', id_referensi: hdr.no_referensi, aksi: 'INSERT', alasan: 'Penjualan ke pengepul', id_pengguna: req.user.id });
      return { ...hdr, tgl_penjualan: iso };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});
router.get('/penjualan', async (req, res, next) => {
  try {
    const rows = (await pool.query(`
      SELECT p.no_referensi, p.tgl_penjualan, j.nama_jenis, d.berat_keluar_kg
      FROM penjualan_pengepul p JOIN detail_penjualan d ON d.id_penjualan = p.id_penjualan JOIN jenis_sampah j ON j.id_jenis = d.id_jenis
      ORDER BY p.tgl_penjualan DESC, p.id_penjualan DESC LIMIT 50`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- US-11 Kas ---------- */
router.get('/kas', async (req, res, next) => {
  try {
    const rows = (await pool.query(`SELECT k.no_referensi, k.tipe_kas, k.nominal, k.tgl_kas, k.keterangan, k.referensi_tabel, k.referensi_id FROM kas_operasional k ORDER BY k.tgl_kas DESC, k.id_kas DESC LIMIT 100`)).rows;
    const saldo = (await pool.query(`SELECT COALESCE(SUM(CASE WHEN tipe_kas = 'PEMASUKAN' THEN nominal ELSE -nominal END), 0) AS saldo FROM kas_operasional`)).rows[0].saldo;
    res.json({ saldo, kas: rows });
  } catch (e) { next(e); }
});
router.post('/kas', requireRole('Bendahara', 'Ketua'), async (req, res, next) => {
  try {
    const { tipe_kas, nominal, keterangan, tgl_kas } = req.body || {};
    const nom = Number(nominal);
    if (!['PEMASUKAN', 'PENGELUARAN'].includes(tipe_kas) || !Number.isFinite(nom) || nom <= 0 || !keterangan?.trim()) throw httpError(400, 'VALIDATION', 'tipe_kas, nominal (>0), keterangan wajib.');
    const iso = (typeof tgl_kas === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tgl_kas)) ? tgl_kas : new Date().toISOString().slice(0, 10);
    const rec = (await pool.query(`INSERT INTO kas_operasional (tipe_kas, nominal, tgl_kas, keterangan, id_petugas) VALUES ($1,$2,$3,$4,$5) RETURNING no_referensi, tgl_kas`, [tipe_kas, nom, iso, keterangan.trim(), req.user.id])).rows[0];
    await writeAudit(pool, { tabel: 'kas_operasional', id_referensi: rec.no_referensi, aksi: 'INSERT', alasan: keterangan.trim(), id_pengguna: req.user.id });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

/* ---------- US-12 Audit ---------- */
router.get('/audit', requireRole('Ketua'), async (req, res, next) => {
  try {
    const rows = (await pool.query(`SELECT a.waktu, a.tabel_terkait, a.id_referensi, a.aksi, a.alasan, p.nama_lengkap AS pengguna FROM audit_log a LEFT JOIN pengguna p ON p.id_pengguna = a.id_pengguna ORDER BY a.waktu DESC LIMIT 100`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- US-13 Laporan ---------- */
router.get('/laporan/ringkasan', requireRole('Ketua', 'Bendahara', 'Petugas Timbang'), async (req, res, next) => {
  try {
    const r = (await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM nasabah WHERE status_aktif) AS nasabah_aktif,
        (SELECT COALESCE(SUM(total_berat_kg),0) FROM stok_gudang) AS stok_total,
        (SELECT COALESCE(SUM(saldo),0) FROM nasabah) AS saldo_nasabah,
        (SELECT COALESCE(SUM(CASE WHEN tipe_kas='PEMASUKAN' THEN nominal ELSE -nominal END),0) FROM kas_operasional) AS saldo_kas`)).rows[0];
    res.json(r);
  } catch (e) { next(e); }
});
router.get('/laporan/:jenis', requireRole('Ketua', 'Bendahara'), async (req, res, next) => {
  try {
    const jenis = req.params.jenis; const bulan = req.query.bulan && /^\d{4}-\d{2}$/.test(req.query.bulan) ? req.query.bulan : new Date().toISOString().slice(0, 7);
    const out = [];
    if (jenis === 'setoran') {
      const rows = (await pool.query(`SELECT s.no_referensi, s.tgl_setor, n.nama_nasabah, s.total_berat, s.total_nilai, s.nilai_tabungan, s.nilai_kas_operasional FROM transaksi_setor s JOIN nasabah n ON n.no_rekening=s.no_rekening WHERE to_char(s.tgl_setor,'YYYY-MM')=$1 ORDER BY s.tgl_setor`, [bulan])).rows;
      out.push({ nama: 'Setoran', kolom: ['Ref.', 'Tanggal', 'Nasabah', 'Berat (kg)', 'Total', 'Tabungan 90%', 'Kas 10%'], baris: rows });
    } else if (jenis === 'penarikan') {
      out.push({ nama: 'Penarikan', kolom: ['Ref.', 'Tanggal', 'Nasabah', 'Jumlah', 'Status'], baris: (await pool.query(`SELECT p.no_referensi, p.tgl_tarik, n.nama_nasabah, p.jumlah_tarik, p.status_transaksi FROM penarikan_saldo p JOIN nasabah n ON n.no_rekening=p.no_rekening WHERE to_char(p.tgl_tarik,'YYYY-MM')=$1 ORDER BY p.tgl_tarik`, [bulan])).rows });
    } else if (jenis === 'saldo') {
      out.push({ nama: 'Saldo Nasabah', kolom: ['No. Rekening', 'Nama', 'Saldo'], baris: (await pool.query('SELECT no_rekening, nama_nasabah, saldo FROM nasabah ORDER BY no_rekening')).rows });
    } else if (jenis === 'stok') {
      out.push({ nama: 'Stok', kolom: ['Jenis', 'Stok (kg)', 'Estimasi Nilai'], baris: (await pool.query(`SELECT j.nama_jenis, s.total_berat_kg, s.estimasi_nilai FROM stok_gudang s JOIN jenis_sampah j ON j.id_jenis=s.id_jenis ORDER BY j.nama_jenis`)).rows });
    } else if (jenis === 'penyusutan') {
      out.push({ nama: 'Penyusutan', kolom: ['Tanggal', 'Jenis', 'Selisih (kg)'], baris: (await pool.query(`SELECT p.tgl_penimbangan, j.nama_jenis, d.selisih_kg FROM penimbangan_ulang p JOIN penimbangan_ulang_detail d ON d.id_penimbangan=p.id_penimbangan JOIN jenis_sampah j ON j.id_jenis=d.id_jenis WHERE d.selisih_kg < 0 AND to_char(p.tgl_penimbangan,'YYYY-MM')=$1 ORDER BY p.tgl_penimbangan`, [bulan])).rows });
    } else if (jenis === 'penjualan') {
      out.push({ nama: 'Penjualan', kolom: ['Tanggal', 'Ref.', 'Jenis', 'Jumlah (kg)'], baris: (await pool.query(`SELECT p.tgl_penjualan, p.no_referensi, j.nama_jenis, d.berat_keluar_kg FROM penjualan_pengepul p JOIN detail_penjualan d ON d.id_penjualan=p.id_penjualan JOIN jenis_sampah j ON j.id_jenis=d.id_jenis WHERE to_char(p.tgl_penjualan,'YYYY-MM')=$1 ORDER BY p.tgl_penjualan`, [bulan])).rows });
    } else if (jenis === 'kas') {
      out.push({ nama: 'Kas Operasional', kolom: ['Tanggal', 'Tipe', 'Keterangan', 'Nominal'], baris: (await pool.query(`SELECT tgl_kas, tipe_kas, keterangan, CASE WHEN tipe_kas='PEMASUKAN' THEN nominal ELSE -nominal END AS nominal FROM kas_operasional WHERE to_char(tgl_kas,'YYYY-MM')=$1 ORDER BY tgl_kas`, [bulan])).rows });
    } else {
      throw httpError(404, 'NOT_FOUND', `Jenis laporan '${jenis}' tidak dikenal.`);
    }
    res.json({ bulan, laporan: out });
  } catch (e) { next(e); }
});

module.exports = router;
