/* Otorisasi RBAC: batasi route berdasarkan peran. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Silakan login.' });
    if (!roles.includes(req.user.peran)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: `Akses ditolak. Diperlukan peran: ${roles.join(' / ')}.` });
    }
    next();
  };
}

const isNasabah = (req) => req.user?.peran === 'Nasabah';
module.exports = { requireRole, isNasabah };
