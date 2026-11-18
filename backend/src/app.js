/* Entry point: Bank Sampah Lestari — Backend API */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const errorHandler = require('./errorHandler');

const app = express();
// Catatan: CSP dimatikan untuk demo — index.html memuat script inline dari CDN.
// Untuk produksi: aktifkan CSP yang hanya mengizinkan origin CDN yang dipakai.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'bank-sampah-lestari-backend', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);

// Sajikan hasil build frontend (React/Vite) bila ada — supaya satu URL melayani app + API.
const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // fallback SPA: semua non-/api → index.html
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Bank Sampah Lestari API berjalan di http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
