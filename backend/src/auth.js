/* Middleware autentikasi JWT + helper sign. */
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-ganti-di-produksi-minimal-32-chars';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token tidak ditemukan. Silakan login.' });
  }
  try {
    const payload = verifyToken(token);
    req.user = payload; // { id, username, peran, no_rekening? }
    next();
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALID', message: 'Sesi kedaluwarsa atau token tidak valid. Silakan login kembali.' });
  }
}

module.exports = { signToken, verifyToken, authRequired };
