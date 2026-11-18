/* Helper tulis audit_log (dalam transaksi atau pool). */
async function writeAudit(clientOrPool, { tabel, id_referensi, aksi, alasan, id_pengguna, data_sebelum, data_sesudah }) {
  const payload = [tabel, String(id_referensi), aksi, data_sebelum ? JSON.stringify(data_sebelum) : null, data_sesudah ? JSON.stringify(data_sesudah) : null, alasan || null, id_pengguna || null];
  await clientOrPool.query(
    `INSERT INTO audit_log (tabel_terkait, id_referensi, aksi, data_sebelum, data_sesudah, alasan, id_pengguna)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, payload);
}
module.exports = { writeAudit };
