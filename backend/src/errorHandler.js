/* Error handler: format konsisten, tanpa membocorkan stack trace di produksi. */
module.exports = function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Terjadi kesalahan pada server.' : (err.message || 'Permintaan tidak valid.');
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ error: code, message });
};

function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status; e.code = code;
  return e;
}
module.exports.httpError = httpError;
