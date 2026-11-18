# Bank Sampah Lestari — Tahap 5: Implementasi (Online)

**URL:** https://app-production-f6470cb1.up.railway.app

## Stack (sesuai rancangan Tahap 4)

- **Frontend**: React 19 + Vite 8 (SPA) — seluruh US-01 s.d. US-13
- **Backend**: Node.js + Express 4 (REST API, JWT + bcrypt, RBAC middleware)
- **Database**: PostgreSQL 18 (service Railway) — skema v2.0 `database/schema.sql`
- **Hosting**: Railway — `app` (web service, menyajikan React build + `/api/*`) + `Postgres`
- **Auth**: JWT (bcrypt hash) — `Authorization: Bearer <token>`

## Akun uji (password = username + `123`)

| Username | Password | Peran |
|---|---|---|
| `ketua` | `ketua123` | Ketua |
| `petugas` | `petugas123` | Petugas Timbang |
| `petugas2` | `petugas123` | Petugas Timbang |
| `bendahara` | `bendahara123` | Bendahara |
| `nasabah` | `nasabah123` | Nasabah (BS-0000001) |
| `nasabah2` | `nasabah123` | Nasabah (BS-0000002) |
| `nasabah3` | `nasabah123` | Nasabah (BS-0000003) |

## Terbukti berjalan di lingkungan produksi

- ✅ Login RBAC 4 aktor → tampilan & menu sesuai peran
- ✅ Uji setoran via UI → "Tersimpan. Ref: SET-202611-00001 · Total Rp 50.000 · Tabungan Rp 45.000"
- ✅ Ketua dashboard menampilkan data langsung dari PostgreSQL: 3 nasabah · stok 20 kg · tabungan Rp 45.000 · kas Rp 5.000
- ✅ `/api/health` → `{"status":"ok", ...}`

## Struktur

```
backend/     Express API (src/app.js, src/db.js, src/auth.js, src/rbac.js, routes/)
frontend/    React + Vite SPA (src/api.js, App.jsx, components/)
database/    schema.sql (v2.0, idempoten)
render.yaml  (opsional, penyedia hosting alternatif)
railway.json
```

## Cara deploy ulang (CLI Railway)

```bash
cd fullstack
npm i -g @railway/cli --allow-scripts=@railway/cli
railway login --browserless
railway up
node backend/db_init.js    # hanya sekali saat DB baru — muat schema + akun
```

## Batasan jujur

- Data contoh = **DATA DUMMY**; bukan data produksi Bank Sampah Lestari.
- Aplikasi tetap satu-URL (Express menyajikan React build) — bukan CDN terpisah.
- Free tier Railway: app bisa "tidur" setelah 15 menit tidak diakses; request pertama ~1 menit (cold start).
- `JWT_SECRET` disetel di service env; nilai tersimpan di dashboard Railway, tidak di-repo.
- Tanpa test suite otomatis (uji manual + verifikasi end-to-end dari browser).
