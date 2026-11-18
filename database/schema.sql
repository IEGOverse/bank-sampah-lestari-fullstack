-- ============================================================================
-- SKEMA DATABASE: BANK SAMPAH LESTARI  (REVISI Tahap 4)
-- Sistem Informasi Manajemen Bank Sampah Lestari
-- ============================================================================
-- Versi       : 2.0 (Tahap 4 — Desain Sistem)
-- Database    : PostgreSQL 15+
-- Tanggal     : 2026-11-10
-- Sumber acuan: SRS Tahap 2 (REQ/NFR/BR/US), ERD Tahap 3, skema v1.0
--
-- PENTING — skrip ini TIDAK menghapus tabel lama. Aman dijalankan pada
-- database kosong. Untuk database yang SUDAH berisi data, gunakan skrip
-- migrasi terpisah (lihat database/README.md bagian "Migrasi dari v1.0").
-- DILARANG menjalankan DROP TABLE ... CASCADE pada database berisi data.
--
-- Konvensi:
--   * no_referensi : nomor referensi transaksi (REQ-19), digenerate dari
--                    sequence sehingga aman dari tabrakan saat bersamaan.
--   * no_rekening  : format BS-XXXXXXX, default dari sequence (bukan MAX+1).
--   * Semua nilai uang dan berat memakai DECIMAL.
--   * Transaksi keuangan saling terkait WAJIB dibungkus transaksi database
--     (BEGIN ... COMMIT / ROLLBACK) di layer backend.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. CATATAN EKSTENSI
-- ============================================================================
-- Skema ini SENGAJA tidak memakai ekstensi apa pun (mis. btree_gist untuk
-- exclusion constraint) agar dapat berjalan pada setiap instalasi PostgreSQL
-- 15+ standar, termasuk instalasi minimal/tertanam. Pencegahan periode harga
-- yang tumpang tindih dilakukan lewat TRIGGER (lihat TABEL 4).

-- ============================================================================
-- 1. TIPE KUSTOM (ENUM)
-- ============================================================================
-- peran_pengguna: KETUA, PETUGAS TIMBANG, BENDAHARA (pengurus) + NASABAH + ADMIN.
-- SRS: akun login untuk seluruh aktor, registrasi mandiri nasabah selalu
-- berperan Nasabah; peran pengurus hanya dapat ditetapkan pihak berwenang.
-- ADMIN ditambahkan Tahap 5: peran teknis (superset kewenangan pengurus)
-- untuk pengelolaan akun/sistem, dipisah dari akun Ketua atas permintaan klien.
DO $$
BEGIN
    CREATE TYPE peran_pengguna AS ENUM ('Nasabah', 'Ketua', 'Petugas Timbang', 'Bendahara', 'Admin');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Migrasi untuk database v2.0 yang sudah berisi data (idempoten):
-- menambahkan nilai 'Admin' pada enum peran_pengguna.
ALTER TYPE peran_pengguna ADD VALUE IF NOT EXISTS 'Admin';

-- ============================================================================
-- 2. SEQUENCE & FUNGSI UTILITAS
-- ============================================================================
-- Sequence nomor rekening: aman terhadap pendaftaran nasabah bersamaan
-- (dua registrasi tidak dapat menghasilkan no_rekening yang sama).
CREATE SEQUENCE IF NOT EXISTS seq_no_rekening START 1;

CREATE OR REPLACE FUNCTION buat_no_rekening()
RETURNS VARCHAR(10) AS $$
BEGIN
    RETURN 'BS-' || LPAD(nextval('seq_no_rekening')::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- Sequence global nomor referensi transaksi (REQ-19)
CREATE SEQUENCE IF NOT EXISTS seq_no_referensi START 1;

CREATE OR REPLACE FUNCTION buat_no_referensi(p_prefix TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Contoh: SET-202611-00042 / TRK-202611-00007 / JLN-....
    RETURN p_prefix || '-' || to_char(NOW(), 'YYYYMM') || '-' ||
           LPAD(nextval('seq_no_referensi')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABEL 1: pengguna
-- Akun login untuk seluruh aktor (REQ-01, REQ-02, NFR-01).
-- Password disimpan sebagai hash (NFR-03). Status aktif/nonaktif (NFR-01).
-- ============================================================================
CREATE TABLE IF NOT EXISTS pengguna (
    id_pengguna     SERIAL          PRIMARY KEY,
    username        VARCHAR(50)     NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,       -- bcrypt / argon2
    nama_lengkap    VARCHAR(100)    NOT NULL,
    peran           peran_pengguna  NOT NULL DEFAULT 'Nasabah',
    status          BOOLEAN         NOT NULL DEFAULT TRUE,   -- TRUE = aktif
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_username_min_length CHECK (LENGTH(TRIM(username)) >= 3),
    CONSTRAINT chk_nama_lengkap_not_empty CHECK (LENGTH(TRIM(nama_lengkap)) > 0),
    CONSTRAINT chk_password_hash_not_empty CHECK (LENGTH(password_hash) > 0)
);

COMMENT ON TABLE pengguna IS
    'Akun login seluruh aktor: Nasabah, Ketua, Petugas Timbang, Bendahara.';
COMMENT ON COLUMN pengguna.peran IS
    'Peran pengguna. Registrasi mandiri SELALU Nasabah; peran pengurus hanya bisa ditetapkan pihak berwenang (REQ-05).';
COMMENT ON COLUMN pengguna.password_hash IS 'Hash bcrypt/argon2 — bukan teks biasa (NFR-03).';

-- ============================================================================
-- TABEL 2: nasabah
-- Data nasabah (REQ-04). Terhubung 1:1 dengan akun login (pengguna.peran = Nasabah).
-- saldo = tabungan nasabah (bertambah dari 90% setoran, berkurang saat penarikan).
-- ============================================================================
CREATE TABLE IF NOT EXISTS nasabah (
    no_rekening         VARCHAR(10)     PRIMARY KEY DEFAULT buat_no_rekening(),
    id_pengguna         INT             UNIQUE,               -- akun login milik nasabah ini
    nama_nasabah        VARCHAR(100)    NOT NULL,
    alamat              TEXT,
    no_hp               VARCHAR(15),
    no_buku_tabungan    VARCHAR(30),                          -- diisi pengurus bila tersedia (REQ-04)
    saldo               DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    tgl_daftar          DATE            NOT NULL DEFAULT CURRENT_DATE,
    status_aktif        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_saldo_non_negatif CHECK (saldo >= 0),
    CONSTRAINT chk_nama_nasabah_not_empty CHECK (LENGTH(TRIM(nama_nasabah)) > 0),
    CONSTRAINT chk_no_rekening_format CHECK (no_rekening ~ '^BS-[0-9]{7}$'),

    CONSTRAINT fk_nasabah_pengguna
        FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Nomor buku tabungan unik bila sudah dicatat (boleh kosong/NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nasabah_no_buku_tabungan
    ON nasabah(no_buku_tabungan) WHERE no_buku_tabungan IS NOT NULL;

COMMENT ON TABLE nasabah IS
    'Data nasabah Bank Sampah Lestari. 1:1 dengan akun pengguna berperan Nasabah.';
COMMENT ON COLUMN nasabah.no_buku_tabungan IS
    'Nomor buku tabungan fisik bila telah dicatat pengurus (REQ-04); unik bila terisi.';
COMMENT ON COLUMN nasabah.saldo IS 'Saldo tabungan (Rp). Tidak boleh negatif.';

-- ============================================================================
-- TABEL 3: jenis_sampah  (master, tanpa harga — harga ada di harga_sampah)
-- Daftar WAJIB sesuai SRS (REQ-06, BR-03):
--   botol plastik, plastik campur, kardus, kertas, besi, aluminium, botol kaca
-- ============================================================================
CREATE TABLE IF NOT EXISTS jenis_sampah (
    id_jenis        SERIAL          PRIMARY KEY,
    nama_jenis      VARCHAR(50)     NOT NULL UNIQUE,
    kategori        VARCHAR(30)     NOT NULL,
    satuan          VARCHAR(10)     NOT NULL DEFAULT 'kg',
    aktif           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_nama_jenis_not_empty CHECK (LENGTH(TRIM(nama_jenis)) > 0),
    CONSTRAINT chk_kategori_not_empty CHECK (LENGTH(TRIM(kategori)) > 0)
);

COMMENT ON TABLE jenis_sampah IS
    'Master jenis sampah yang diterima (REQ-06). Harga TIDAK disimpan di sini; lihat harga_sampah.';

-- ============================================================================
-- TABEL 4: harga_sampah  (riwayat harga per jenis, berdasarkan periode berlaku)
-- SRS REQ-07 / BR-04 / BR-05: Ketua menetapkan harga tiap awal bulan;
-- transaksi lama memakai harga yang berlaku pada bulan transaksi.
-- ============================================================================
CREATE TABLE IF NOT EXISTS harga_sampah (
    id_harga            SERIAL          PRIMARY KEY,
    id_jenis            INT             NOT NULL,
    harga_per_kg        DECIMAL(12,2)   NOT NULL,
    periode_mulai       DATE            NOT NULL,             -- awal berlaku (mis. 2026-11-01)
    periode_selesai     DATE,                                   -- NULL = masih berlaku
    id_penetap          INT,                                    -- Ketua yang menetapkan
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_harga_positif CHECK (harga_per_kg > 0),
    CONSTRAINT chk_periode_valid CHECK (periode_selesai IS NULL OR periode_selesai >= periode_mulai),

    CONSTRAINT fk_harga_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_harga_penetap
        FOREIGN KEY (id_penetap) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE SET NULL,

    -- Satu jenis sampah tidak boleh memiliki dua periode mulai yang sama
    CONSTRAINT uq_harga_jenis_periode UNIQUE (id_jenis, periode_mulai)
    -- Periode yang tumpang tindih dicegah TRIGGER trg_harga_no_overlap (di bawah)
);

-- Trigger: satu jenis sampah tidak boleh memiliki dua periode harga yang tumpang tindih
CREATE OR REPLACE FUNCTION cek_harga_no_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM harga_sampah h
        WHERE h.id_jenis = NEW.id_jenis
          AND h.id_harga <> COALESCE(NEW.id_harga, -1)
          AND daterange(h.periode_mulai, COALESCE(h.periode_selesai, 'infinity'::date), '[]')
              && daterange(NEW.periode_mulai, COALESCE(NEW.periode_selesai, 'infinity'::date), '[]')
    ) THEN
        RAISE EXCEPTION 'Periode harga tumpang tindih untuk id_jenis % (baru: % s.d. %)',
            NEW.id_jenis, NEW.periode_mulai, COALESCE(NEW.periode_selesai::text, 'sampai sekarang');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_harga_no_overlap ON harga_sampah;
CREATE TRIGGER trg_harga_no_overlap
    BEFORE INSERT OR UPDATE ON harga_sampah
    FOR EACH ROW EXECUTE FUNCTION cek_harga_no_overlap();

COMMENT ON TABLE harga_sampah IS
    'Riwayat harga per kg per jenis sampah berdasarkan periode berlaku (REQ-07, BR-04, BR-05).';
COMMENT ON COLUMN harga_sampah.periode_selesai IS
    'NULL berarti harga masih berlaku. Diisi otomatis/manual saat harga baru ditetapkan.';

-- ============================================================================
-- TABEL 5: transaksi_setor  (header setoran)
-- REQ-08/09/10, BR-06/BR-07, REQ-19 (no_referensi)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transaksi_setor (
    id_setor                SERIAL          PRIMARY KEY,
    no_referensi            VARCHAR(30)     NOT NULL UNIQUE DEFAULT buat_no_referensi('SET'),
    no_rekening             VARCHAR(10)     NOT NULL,
    id_petugas              INT             NOT NULL,           -- Petugas Timbang pencatat
    tgl_setor               TIMESTAMP       NOT NULL DEFAULT NOW(),
    total_berat             DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    total_nilai             DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    nilai_tabungan          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,   -- 90% (BR-07)
    nilai_kas_operasional   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,   -- 10% (BR-07)
    created_at              TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_total_berat_non_negatif CHECK (total_berat >= 0),
    CONSTRAINT chk_total_nilai_non_negatif CHECK (total_nilai >= 0),
    CONSTRAINT chk_nilai_tabungan_non_negatif CHECK (nilai_tabungan >= 0),
    CONSTRAINT chk_nilai_kas_non_negatif CHECK (nilai_kas_operasional >= 0),
    CONSTRAINT chk_split_konsisten CHECK (nilai_tabungan + nilai_kas_operasional = total_nilai),

    CONSTRAINT fk_setor_nasabah
        FOREIGN KEY (no_rekening) REFERENCES nasabah(no_rekening)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_setor_petugas
        FOREIGN KEY (id_petugas) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

COMMENT ON TABLE transaksi_setor IS
    'Header transaksi setoran sampah. Detail per jenis di detail_setor.';
COMMENT ON COLUMN transaksi_setor.nilai_tabungan IS '90% dari total_nilai untuk tabungan nasabah (BR-07).';
COMMENT ON COLUMN transaksi_setor.nilai_kas_operasional IS '10% dari total_nilai untuk kas operasional (BR-07).';

-- ============================================================================
-- TABEL 6: detail_setor  (rincian per jenis sampah)
-- Harga di-snapshot DAN direferensikan ke baris harga_sampah yang dipakai,
-- sehingga harga historis tidak pernah berubah (REQ-07, BR-05, BR-06).
-- ============================================================================
CREATE TABLE IF NOT EXISTS detail_setor (
    id_detail           SERIAL          PRIMARY KEY,
    id_setor            INT             NOT NULL,
    id_jenis            INT             NOT NULL,
    id_harga            INT             NOT NULL,               -- baris harga yang dipakai
    berat_kg            DECIMAL(10,2)   NOT NULL,
    harga_saat_setor    DECIMAL(12,2)   NOT NULL,               -- snapshot harga/kg
    subtotal            DECIMAL(12,2)   NOT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_berat_positif CHECK (berat_kg > 0),
    CONSTRAINT chk_harga_setor_positif CHECK (harga_saat_setor > 0),
    CONSTRAINT chk_subtotal_non_negatif CHECK (subtotal >= 0),

    CONSTRAINT fk_detail_setor
        FOREIGN KEY (id_setor) REFERENCES transaksi_setor(id_setor)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detail_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_detail_harga
        FOREIGN KEY (id_harga) REFERENCES harga_sampah(id_harga)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_detail_setor_jenis UNIQUE (id_setor, id_jenis)
);

COMMENT ON TABLE detail_setor IS
    'Rincian setoran per jenis. Snapshot harga + FK ke harga_sampah menjaga harga historis.';

-- ============================================================================
-- TABEL 7: penarikan_saldo
-- REQ-12, BR-08 (min Rp50.000, 1×/bulan), BR-09 (Desember: boleh seluruh saldo),
-- REQ-19 (no_referensi). Diproses Bendahara.
-- Aturan bisnis 1×/bulan & pengecualian Desember ditegakkan di backend.
-- ============================================================================
CREATE TABLE IF NOT EXISTS penarikan_saldo (
    id_tarik            SERIAL          PRIMARY KEY,
    no_referensi        VARCHAR(30)     NOT NULL UNIQUE DEFAULT buat_no_referensi('TRK'),
    no_rekening         VARCHAR(10)     NOT NULL,
    id_bendahara        INT             NOT NULL,
    tgl_tarik           TIMESTAMP       NOT NULL DEFAULT NOW(),
    jumlah_tarik        DECIMAL(12,2)   NOT NULL,
    -- Catatan: batas minimal Rp50.000 (BR-08) ditegakkan di BACKEND, bukan CHECK,
    -- agar pengecualian Desember (BR-09 — boleh menarik seluruh tabungan) tetap mungkin.
    saldo_sebelum       DECIMAL(12,2)   NOT NULL,
    sisa_saldo          DECIMAL(12,2)   NOT NULL,
    status_transaksi    VARCHAR(20)     NOT NULL DEFAULT 'Berhasil'
                        CHECK (status_transaksi IN ('Berhasil', 'Dibatalkan')),
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_jumlah_tarik_positif CHECK (jumlah_tarik > 0),
    CONSTRAINT chk_saldo_sebelum_non_negatif CHECK (saldo_sebelum >= 0),
    CONSTRAINT chk_sisa_saldo_non_negatif CHECK (sisa_saldo >= 0),
    CONSTRAINT chk_tarik_konsisten CHECK (sisa_saldo = saldo_sebelum - jumlah_tarik),

    CONSTRAINT fk_tarik_nasabah
        FOREIGN KEY (no_rekening) REFERENCES nasabah(no_rekening)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tarik_bendahara
        FOREIGN KEY (id_bendahara) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

COMMENT ON TABLE penarikan_saldo IS
    'Penarikan tabungan yang diproses Bendahara. Min Rp50.000 & maks 1×/bulan (BR-08); Desember boleh seluruh saldo (BR-09) — ditegakkan di backend.';

-- ============================================================================
-- TABEL 8: stok_gudang  (stok berjalan per jenis — relasi 1:1 dengan jenis_sampah)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stok_gudang (
    id_stok                 SERIAL          PRIMARY KEY,
    id_jenis                INT             NOT NULL UNIQUE,
    total_berat_kg          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    estimasi_nilai          DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
    tgl_terakhir_update     TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_stok_berat_non_negatif CHECK (total_berat_kg >= 0),
    CONSTRAINT chk_stok_nilai_non_negatif CHECK (estimasi_nilai >= 0),

    CONSTRAINT fk_stok_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================================
-- TABEL 9: stok_mutasi  (riwayat pergerakan stok — append-only)
-- perubahan_kg: positif = barang masuk (setoran), negatif = barang keluar
-- (penjualan) atau penyesuaian penimbangan ulang/penyusutan.
-- ============================================================================
CREATE TABLE IF NOT EXISTS stok_mutasi (
    id_mutasi           BIGSERIAL       PRIMARY KEY,
    id_jenis            INT             NOT NULL,
    tgl_mutasi          TIMESTAMP       NOT NULL DEFAULT NOW(),
    tipe_mutasi         VARCHAR(30)     NOT NULL
                        CHECK (tipe_mutasi IN ('SETOR', 'PENJUALAN', 'PENYESUAIAN', 'KOREKSI')),
    perubahan_kg        DECIMAL(12,2)   NOT NULL CHECK (perubahan_kg <> 0),
    saldo_setelah_kg    DECIMAL(12,2)   NOT NULL CHECK (saldo_setelah_kg >= 0),
    referensi_tabel     VARCHAR(50),                            -- mis. 'transaksi_setor'
    referensi_id        BIGINT,                                 -- id baris sumber
    id_pengguna         INT,                                    -- pencatat
    keterangan          TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mutasi_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_mutasi_pengguna
        FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE SET NULL
);

COMMENT ON TABLE stok_mutasi IS
    'Riwayat pergerakan stok (append-only). Saldo akhir dapat diaudit dari mutasi.';

-- ============================================================================
-- TABEL 10: penimbangan_ulang  (header, setiap pengepul datang ~2 mingguan — BR-10)
-- ============================================================================
CREATE TABLE IF NOT EXISTS penimbangan_ulang (
    id_penimbangan      SERIAL          PRIMARY KEY,
    no_referensi        VARCHAR(30)     NOT NULL UNIQUE DEFAULT buat_no_referensi('PEN'),
    tgl_penimbangan     TIMESTAMP       NOT NULL DEFAULT NOW(),
    id_petugas          INT             NOT NULL,               -- Petugas Timbang
    keterangan          TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_penimbangan_petugas
        FOREIGN KEY (id_petugas) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================================
-- TABEL 11: penimbangan_ulang_detail  (per jenis — BR-11, REQ-14, REQ-15)
-- selisih_kg = berat_pengepul - berat_sebelumnya (negatif = penyusutan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS penimbangan_ulang_detail (
    id_detail_penimbangan   SERIAL          PRIMARY KEY,
    id_penimbangan          INT             NOT NULL,
    id_jenis                INT             NOT NULL,
    berat_sebelumnya        DECIMAL(12,2)   NOT NULL,           -- catatan Bank Sampah (kg)
    berat_pengepul          DECIMAL(12,2)   NOT NULL,           -- hasil timbang ulang (kg)
    selisih_kg              DECIMAL(12,2)   GENERATED ALWAYS AS (berat_pengepul - berat_sebelumnya) STORED,
    created_at              TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_berat_sebelumnya_non_negatif CHECK (berat_sebelumnya >= 0),
    CONSTRAINT chk_berat_pengepul_non_negatif CHECK (berat_pengepul >= 0),

    CONSTRAINT fk_detail_penimbangan
        FOREIGN KEY (id_penimbangan) REFERENCES penimbangan_ulang(id_penimbangan)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detail_penimbangan_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_penimbangan_jenis UNIQUE (id_penimbangan, id_jenis)
);

COMMENT ON TABLE penimbangan_ulang_detail IS
    'Selisih berat dicatat sebagai penyusutan bila negatif (BR-11, REQ-15).';

-- ============================================================================
-- TABEL 12: penjualan_pengepul  (header penjualan ke pengepul — REQ-16)
-- RINCIAN PEMBAYARAN PENGEPUL BELUM DIPASTIKAN KLIEN — harga jual TIDAK disimpan.
-- ============================================================================
CREATE TABLE IF NOT EXISTS penjualan_pengepul (
    id_penjualan        SERIAL          PRIMARY KEY,
    no_referensi        VARCHAR(30)     NOT NULL UNIQUE DEFAULT buat_no_referensi('JLN'),
    tgl_penjualan       TIMESTAMP       NOT NULL DEFAULT NOW(),
    id_pencatat         INT             NOT NULL,               -- pengurus berwenang
    keterangan          TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_penjualan_pencatat
        FOREIGN KEY (id_pencatat) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================================
-- TABEL 13: detail_penjualan  (jenis & jumlah yang keluar — REQ-16)
-- ============================================================================
CREATE TABLE IF NOT EXISTS detail_penjualan (
    id_detail_penjualan SERIAL          PRIMARY KEY,
    id_penjualan        INT             NOT NULL,
    id_jenis            INT             NOT NULL,
    berat_keluar_kg     DECIMAL(12,2)   NOT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_berat_keluar_positif CHECK (berat_keluar_kg > 0),

    CONSTRAINT fk_detail_penjualan
        FOREIGN KEY (id_penjualan) REFERENCES penjualan_pengepul(id_penjualan)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detail_penjualan_jenis
        FOREIGN KEY (id_jenis) REFERENCES jenis_sampah(id_jenis)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_penjualan_jenis UNIQUE (id_penjualan, id_jenis)
);

-- ============================================================================
-- TABEL 14: kas_operasional  (pemasukan & pengeluaran — REQ-17, BR-12)
-- Porsi 10% dari setoran dicatat otomatis sebagai PEMASUKAN dengan referensi
-- ke transaksi_setor; pembelian karung, transportasi, dll. sebagai PENGELUARAN.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kas_operasional (
    id_kas              SERIAL          PRIMARY KEY,
    no_referensi        VARCHAR(30)     NOT NULL UNIQUE DEFAULT buat_no_referensi('KAS'),
    tipe_kas            VARCHAR(10)     NOT NULL CHECK (tipe_kas IN ('PEMASUKAN', 'PENGELUARAN')),
    nominal             DECIMAL(12,2)   NOT NULL CHECK (nominal > 0),
    tgl_kas             TIMESTAMP       NOT NULL DEFAULT NOW(),
    keterangan          TEXT            NOT NULL,
    id_petugas          INT             NOT NULL,               -- Bendahara pencatat
    referensi_tabel     VARCHAR(50),                            -- mis. 'transaksi_setor'
    referensi_id        BIGINT,                                 -- id transaksi sumber (opsional)
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_keterangan_not_empty CHECK (LENGTH(TRIM(keterangan)) > 0),

    CONSTRAINT fk_kas_petugas
        FOREIGN KEY (id_petugas) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

COMMENT ON TABLE kas_operasional IS
    'Kas operasional: pemasukan (termasuk 10% setoran) dan pengeluaran (karung, transportasi, dst.) (REQ-17, BR-12).';

-- ============================================================================
-- TABEL 15: audit_log  (riwayat perubahan transaksi penting — REQ-18, NFR-09)
-- Append-only. Untuk aksi KOREKSI, alasan WAJIB diisi.
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id_audit            BIGSERIAL       PRIMARY KEY,
    tabel_terkait       VARCHAR(50)     NOT NULL,
    id_referensi        VARCHAR(50)     NOT NULL,               -- id/no_referensi baris
    aksi                VARCHAR(20)     NOT NULL
                        CHECK (aksi IN ('INSERT', 'UPDATE', 'KOREKSI', 'BATAL')),
    data_sebelum        JSONB,
    data_sesudah        JSONB,
    alasan              TEXT,
    id_pengguna         INT,                                    -- NULL = proses sistem
    waktu               TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_alasan_koreksi CHECK (aksi <> 'KOREKSI' OR (alasan IS NOT NULL AND LENGTH(TRIM(alasan)) > 0)),

    CONSTRAINT fk_audit_pengguna
        FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna)
        ON UPDATE CASCADE ON DELETE SET NULL
);

COMMENT ON TABLE audit_log IS
    'Jejak audit/koreksi transaksi. Tidak boleh dihapus dari aplikasi (koreksi = INSERT baris baru).';

-- ============================================================================
-- 16. TRIGGER updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trg_update_pengguna ON pengguna;
CREATE TRIGGER trg_update_pengguna
    BEFORE UPDATE ON pengguna FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_update_nasabah ON nasabah;
CREATE TRIGGER trg_update_nasabah
    BEFORE UPDATE ON nasabah FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 17. INDEKS (kolom yang sering dicari / untuk laporan — NFR-07)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pengguna_peran ON pengguna(peran);
CREATE INDEX IF NOT EXISTS idx_pengguna_status ON pengguna(status);

CREATE INDEX IF NOT EXISTS idx_nasabah_id_pengguna ON nasabah(id_pengguna);
CREATE INDEX IF NOT EXISTS idx_nasabah_nama ON nasabah(nama_nasabah);
CREATE INDEX IF NOT EXISTS idx_nasabah_status ON nasabah(status_aktif);
CREATE INDEX IF NOT EXISTS idx_nasabah_tgl_daftar ON nasabah(tgl_daftar);

CREATE INDEX IF NOT EXISTS idx_harga_jenis ON harga_sampah(id_jenis);
CREATE INDEX IF NOT EXISTS idx_harga_periode ON harga_sampah(periode_mulai, periode_selesai);

CREATE INDEX IF NOT EXISTS idx_setor_no_rekening ON transaksi_setor(no_rekening);
CREATE INDEX IF NOT EXISTS idx_setor_id_petugas ON transaksi_setor(id_petugas);
CREATE INDEX IF NOT EXISTS idx_setor_tgl_setor ON transaksi_setor(tgl_setor);
CREATE INDEX IF NOT EXISTS idx_setor_rekening_tanggal ON transaksi_setor(no_rekening, tgl_setor);
CREATE INDEX IF NOT EXISTS idx_setor_no_referensi ON transaksi_setor(no_referensi);

CREATE INDEX IF NOT EXISTS idx_detail_id_setor ON detail_setor(id_setor);
CREATE INDEX IF NOT EXISTS idx_detail_id_jenis ON detail_setor(id_jenis);
CREATE INDEX IF NOT EXISTS idx_detail_id_harga ON detail_setor(id_harga);

CREATE INDEX IF NOT EXISTS idx_tarik_no_rekening ON penarikan_saldo(no_rekening);
CREATE INDEX IF NOT EXISTS idx_tarik_id_bendahara ON penarikan_saldo(id_bendahara);
CREATE INDEX IF NOT EXISTS idx_tarik_tgl_tarik ON penarikan_saldo(tgl_tarik);
CREATE INDEX IF NOT EXISTS idx_tarik_no_referensi ON penarikan_saldo(no_referensi);

CREATE INDEX IF NOT EXISTS idx_mutasi_id_jenis ON stok_mutasi(id_jenis);
CREATE INDEX IF NOT EXISTS idx_mutasi_tgl ON stok_mutasi(tgl_mutasi);
CREATE INDEX IF NOT EXISTS idx_mutasi_tipe ON stok_mutasi(tipe_mutasi);
CREATE INDEX IF NOT EXISTS idx_mutasi_referensi ON stok_mutasi(referensi_tabel, referensi_id);

CREATE INDEX IF NOT EXISTS idx_penimbangan_tgl ON penimbangan_ulang(tgl_penimbangan);
CREATE INDEX IF NOT EXISTS idx_detail_penimbangan_penimbangan ON penimbangan_ulang_detail(id_penimbangan);
CREATE INDEX IF NOT EXISTS idx_detail_penimbangan_jenis ON penimbangan_ulang_detail(id_jenis);

CREATE INDEX IF NOT EXISTS idx_penjualan_tgl ON penjualan_pengepul(tgl_penjualan);
CREATE INDEX IF NOT EXISTS idx_detail_penjualan_penjualan ON detail_penjualan(id_penjualan);
CREATE INDEX IF NOT EXISTS idx_detail_penjualan_jenis ON detail_penjualan(id_jenis);

CREATE INDEX IF NOT EXISTS idx_kas_tgl ON kas_operasional(tgl_kas);
CREATE INDEX IF NOT EXISTS idx_kas_tipe ON kas_operasional(tipe_kas);
CREATE INDEX IF NOT EXISTS idx_kas_petugas ON kas_operasional(id_petugas);
CREATE INDEX IF NOT EXISTS idx_kas_referensi ON kas_operasional(referensi_tabel, referensi_id);

CREATE INDEX IF NOT EXISTS idx_audit_tabel ON audit_log(tabel_terkait, id_referensi);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON audit_log(waktu);
CREATE INDEX IF NOT EXISTS idx_audit_pengguna ON audit_log(id_pengguna);

-- ============================================================================
-- 18. SEED DATA (minimal, sesuai SRS)
-- ============================================================================
-- 18a. Master jenis sampah — PERSIS daftar SRS (REQ-06, BR-03)
INSERT INTO jenis_sampah (nama_jenis, kategori, satuan) VALUES
    ('Botol Plastik',   'Plastik', 'kg'),
    ('Plastik Campur',  'Plastik', 'kg'),
    ('Kardus',          'Kertas',  'kg'),
    ('Kertas',          'Kertas',  'kg'),
    ('Besi',            'Logam',   'kg'),
    ('Aluminium',       'Logam',   'kg'),
    ('Botol Kaca',      'Kaca',    'kg')
ON CONFLICT (nama_jenis) DO NOTHING;

-- 18b. Stok awal 0 untuk setiap jenis
INSERT INTO stok_gudang (id_jenis, total_berat_kg, estimasi_nilai)
SELECT id_jenis, 0.00, 0.00 FROM jenis_sampah
ON CONFLICT (id_jenis) DO NOTHING;

-- 18c. Akun Ketua awal (PLACEHOLDER — password WAJIB diganti sebelum dipakai!)
--      Peran lain (Petugas Timbang/Bendahara) dibuat lewat US-03 oleh Ketua.
--      Harga TIDAK di-seed: harga ditetapkan Ketua tiap awal bulan (BR-04).
INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, status)
VALUES (
    'admin',
    '$2b$12$LJ3m4ys3GZ2vJ5i8N0eJxOQkPfBnKOGJr0JMbLxQkP7zR9s6SkDGy',  -- GANTI SEBELUM PRODUKSI!
    'Administrator Bank Sampah (Ketua)',
    'Ketua',
    TRUE
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 19. VIEW UNTUK LAPORAN DAN DASHBOARD
-- ============================================================================
CREATE OR REPLACE VIEW v_harga_berlaku AS
SELECT h.id_harga, h.id_jenis, j.nama_jenis, h.harga_per_kg, h.periode_mulai, h.periode_selesai
FROM harga_sampah h
JOIN jenis_sampah j ON j.id_jenis = h.id_jenis
WHERE h.periode_selesai IS NULL OR h.periode_selesai >= CURRENT_DATE;

CREATE OR REPLACE VIEW v_ringkasan_nasabah AS
SELECT
    n.no_rekening,
    n.nama_nasabah,
    n.saldo,
    n.tgl_daftar,
    n.status_aktif,
    COALESCE(ts.jumlah_setoran, 0)    AS jumlah_setoran,
    COALESCE(ts.total_berat_setor, 0) AS total_berat_setor,
    COALESCE(ts.total_nilai_setor, 0) AS total_nilai_setor,
    COALESCE(ps.jumlah_penarikan, 0)  AS jumlah_penarikan,
    COALESCE(ps.total_nilai_tarik, 0) AS total_nilai_tarik
FROM nasabah n
LEFT JOIN (
    SELECT no_rekening, COUNT(*) AS jumlah_setoran,
           SUM(total_berat) AS total_berat_setor, SUM(total_nilai) AS total_nilai_setor
    FROM transaksi_setor GROUP BY no_rekening
) ts ON n.no_rekening = ts.no_rekening
LEFT JOIN (
    SELECT no_rekening, COUNT(*) AS jumlah_penarikan, SUM(jumlah_tarik) AS total_nilai_tarik
    FROM penarikan_saldo WHERE status_transaksi = 'Berhasil' GROUP BY no_rekening
) ps ON n.no_rekening = ps.no_rekening;

CREATE OR REPLACE VIEW v_stok_gudang AS
SELECT sg.id_stok, j.nama_jenis, j.kategori, sg.total_berat_kg, sg.estimasi_nilai,
       sg.tgl_terakhir_update
FROM stok_gudang sg
JOIN jenis_sampah j ON j.id_jenis = sg.id_jenis
ORDER BY j.kategori, j.nama_jenis;

CREATE OR REPLACE VIEW v_riwayat_setor AS
SELECT ts.id_setor, ts.no_referensi, ts.tgl_setor, n.no_rekening, n.nama_nasabah,
       p.nama_lengkap AS nama_petugas, ts.total_berat, ts.total_nilai,
       ts.nilai_tabungan, ts.nilai_kas_operasional, ts.created_at
FROM transaksi_setor ts
JOIN nasabah n ON n.no_rekening = ts.no_rekening
JOIN pengguna p ON p.id_pengguna = ts.id_petugas
ORDER BY ts.tgl_setor DESC;

CREATE OR REPLACE VIEW v_saldo_kas AS
SELECT
    (SELECT COALESCE(SUM(nominal), 0) FROM kas_operasional WHERE tipe_kas = 'PEMASUKAN')
  - (SELECT COALESCE(SUM(nominal), 0) FROM kas_operasional WHERE tipe_kas = 'PENGELUARAN')
    AS saldo_kas_operasional;

COMMIT;

-- ============================================================================
-- CATATAN PENGGUNAAN
-- ============================================================================
-- 1. Instalasi:  psql -d bank_sampah_lestari -f database/schema.sql
--    (skrip ini TIDAK menghapus tabel yang sudah ada; aman untuk instalasi baru.)
-- 2. Akun 'admin' hanyalah placeholder — ganti password dan nama sebelum dipakai.
-- 3. Harga TIDAK di-seed. Ketua menetapkan harga tiap awal bulan (US-05 / BR-04).
-- 4. Pembagian 90:10 (BR-07) disimpan per transaksi pada nilai_tabungan dan
--    nilai_kas_operasional. Waktu mulai penerapan 90:10 belum dipastikan klien.
-- 5. Aturan penarikan (min Rp50.000, 1×/bulan, Desember boleh seluruh saldo)
--    ditegakkan di backend, bukan CHECK constraint, karena ada pengecualian
--    Desember yang memerlukan konteks bulan berjalan dan status transaksi.
-- 6. Transaksi keuangan WAJIB atomik di backend:
--      BEGIN;
--        INSERT transaksi_setor ...; INSERT detail_setor ...;
--        UPDATE nasabah SET saldo = saldo + :tabungan ...;
--        INSERT kas_operasional (10%) ...;
--        UPDATE stok_gudang ...; INSERT stok_mutasi ...;
--      COMMIT;  -- atau ROLLBACK seluruhnya bila ada yang gagal
-- 7. Koreksi transaksi (REQ-18) = INSERT baris audit_log dengan aksi 'KOREKSI'
--    dan alasan wajib; jangan pernah DELETE/UPDATE transaksi keuangan tanpa jejak.
-- 8. NFR-08 (backup): jadwalkan pg_dump harian + uji restore berkala.
-- ============================================================================
