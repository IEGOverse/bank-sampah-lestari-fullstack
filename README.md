# Fullstack — Bank Sampah Lestari (Tahap 5 · Implementasi sesuai rancangan awal)

**Status:** ✅ Dibangun & diuji **secara lokal** (React → Express → PostgreSQL tertanam).
❌ **Belum di-deploy** ke hosting publik — diperlukan akun hosting backend & database (mis. Render/Neon/Supabase) yang belum tersedia.

## Teknologi (sesuai rancangan Tahap 4)

| Lapisan | Teknologi | Status |
|---|---|---|
| Frontend | **React 19 + Vite 8** (SPA, React Router bawaan — tab state) | Dibangun, berfungsi |
| Backend | **Node.js + Express 4** (REST API JSON, JWT + bcrypt, RBAC middleware) | Dibangun, berfungsi |
| Database | **PostgreSQL 17.9** (skema v2.0 `database/schema.sql`) | Dibangun, berfungsi |
| Pengujian | pgembed (PostgreSQL tertanam) + uji HTTP via PowerShell/browser | Lulus |
| Hosting | Static Hosting/CDN (FE) · Backend/API Hosting (BE) · PostgreSQL Database Hosting (DB) | **Belum dipilih/di-deploy** |

## Struktur

```
fullstack/
├── backend/            # Express API  (src/app.js, routes/, src/db.js)
│   ├── src/app.js      # entry point (port 3000)
│   ├── src/db.js       # pool + helper transaksi atomik
│   ├── src/auth.js     # JWT sign/verify + middleware authRequired
│   ├── src/rbac.js     # requireRole() — otorisasi per peran
│   ├── src/audit.js    # writeAudit() → audit_log
│   └── src/routes/     # auth.js + api.js (seluruh endpoint US-01…13)
└── frontend/           # React + Vite (SPA) — komponen sesuai US-01…13
    ├── src/api.js      # fetch wrapper (token JWT dari localStorage)
    ├── src/App.jsx     # shell: sidebar per peran + router tab
    └── src/components/ # Login, Dashboard, Setoran, Harga, Saldo, Penarikan,
                        # Stok, Penimbangan, Penjualan, Kas, Koreksi, Laporan, US03
```

## Cara menjalankan (lokal)

```bash
# 1) Nyalakan PostgreSQL tertanam (port tertulis ke fullstack/.db_uri)
python fullstack/scripts/db_up.py     # biarkan berjalan

# 2) Muat skema v2.0 + akun uji (bcrypt-hashed) — sekali saja per DB baru
cd fullstack/backend
node db_init.js

# 3) Jalankan backend (port 3000)
node src/app.js

# 4) Jalankan frontend (port 5173/5174, proxy /api → localhost:3000)
cd ../frontend
npm install
npm run dev
```

Akun uji (password = username + `123`, di-hash **bcrypt**): `ketua` · `petugas` · `petugas2` · `bendahara` · `nasabah` · `nasabah2` · `nasabah3`.

## Hasil uji nyata (18 Nov 2026)

- ✅ Backend ↔ PostgreSQL tertanam: `schema.sql` dimuat tanpa error; 7 jenis sampah + 7 stok + akun hashed termuat.
- ✅ Login RBAC: `nasabah` diblokir dari `/api/pengguna` (HTTP 403).
- ✅ Setoran via API: 10 kg Botol Plastik → **SET-202611-00001** · total Rp25.000 · tabungan Rp22.500 · kas Rp2.500 (transaksi atomik: header + detail + saldo + stok + kas 10% + audit).
- ✅ Penarikan: < Rp50.000 ditolak (HTTP 409); > saldo ditolak (INSUFFICIENT_BALANCE); 1×/bulan diberlakukan.
- ✅ Frontend (React) → API → DB: Petugas login → **mencatat setoran 5 kg → "Tersimpan. Ref: SET-202611-00006 · Total Rp 12.500 · Tabungan Rp 11.250"**.
- ✅ Ketua dashboard menampilkan data nyata dari PostgreSQL (3 nasabah, stok 110 kg, saldo Rp107.500, kas Rp17.500).
- ✅ `npm run build` sukses (289 kB bundle).

## Belum dilakukan / Batasan

- ❌ **Deployment publik** — diperlukan akun hosting backend & database; belum tersedia. (Frontend dapat di-deploy ke GitHub Pages, tetapi tanpa backend publik aplikasi tidak dapat berfungsi bagi pengunjung.)
- ❌ Belum ada test suite otomatis (uji manual + verifikasi browser).
- ❌ `estimasi_nilai` pada `stok_gudang` tidak diupdate otomatis (tidak memengaruhi laporan stok).
- ⚠️ `JWT_SECRET` masih default dev di `.env` — untuk produksi wajib diganti.
- ⚠️ Data contoh (harga, transaksi) adalah **DATA DUMMY**; bukan data produksi.
- ⚠️ Jika PostgreSQL tertanam mati (proses `db_up.py` berhenti), data hilang → seed ulang dengan `node db_init.js`.
