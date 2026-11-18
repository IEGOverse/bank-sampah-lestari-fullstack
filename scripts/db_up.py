# Menyalakan instance PostgreSQL tertanam (pgembed) khusus untuk development lokal.
# Menulis URI ke ../fullstack/.db_uri  (dibaca oleh backend).
# Jika pgembed tidak tersedia, laporkan â€” atau pakai DATABASE_URL dari PostgreSQL yang sudah ada.
import tempfile, json, os
from pathlib import Path

try:
    from pgembed import get_server
except ImportError:
    print('ERROR: paket pgembed belum terpasang. Jalankan: pip install pgembed', flush=True)
    raise SystemExit(1)

pgdata = Path(tempfile.mkdtemp(prefix='bsl_pg_'))
srv = get_server(pgdata)   # server tetap hidup selagi proses ini berjalan
uri = srv.get_uri()
uri_file = Path(__file__).resolve().parent.parent / '.db_uri'
uri_file.write_text(uri, encoding='utf-8')
print('PostgreSQL tertanam berjalan di', uri, flush=True)
print('URI disimpan di', uri_file, flush=True)
print('Tekan Ctrl+C untuk mematikan.', flush=True)
try:
    import time
    while True:
        time.sleep(3600)
except KeyboardInterrupt:
    pass

