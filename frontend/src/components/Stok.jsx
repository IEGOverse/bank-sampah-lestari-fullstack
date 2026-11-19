/* US-08 — Melihat stok gudang (Ketua) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, fkg, tglID } from '../App'

export default function Stok() {
  const [stok, setStok] = useState([])
  const [mutasi, setMutasi] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([api('/stok'), api('/stok/mutasi')]).then(([s, m]) => { setStok(s); setMutasi(m) }).catch(e => setErr(e.message))
  }, [])

  const total = stok.reduce((a, s) => a + Number(s.total_berat_kg), 0)
  const nilai = stok.reduce((a, s) => a + Number(s.estimasi_nilai), 0)

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-ketua">Aktor: Ketua</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Stok Sampah di Gudang</h3></div>
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg"><i className="fa-solid fa-warehouse"></i></div>
      </div>
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="tbl">
          <thead><tr><th>Jenis</th><th>Kategori</th><th className="text-right">Stok (kg)</th><th className="text-right">Estimasi (Rp)</th><th>Terakhir Update</th></tr></thead>
          <tbody>
            {stok.map(s => (
              <tr key={s.id_jenis}><td className="font-bold">{s.nama_jenis}</td><td>{s.kategori}</td><td className="text-right font-mono">{fkg(s.total_berat_kg)}</td><td className="text-right font-mono">{rupiah(s.estimasi_nilai)}</td><td className="text-slate-500 text-[10px]">{tglID(s.tgl_terakhir_update)}</td></tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold text-xs"><tr><td colSpan={2} className="p-3">TOTAL</td><td className="p-3 text-right font-mono">{fkg(total)}</td><td className="p-3 text-right font-mono">{rupiah(nilai)}</td><td></td></tr></tfoot>
        </table>
      </div>
      <div className="mt-5"><h4 className="font-extrabold text-sm text-slate-800 mb-2">Mutasi Stok Terakhir</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-64 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Tipe</th><th className="text-right">Perubahan (kg)</th><th className="text-right">Saldo Setelah</th></tr></thead>
            <tbody>{mutasi.map((m, i) => <tr key={i}><td>{tglID(m.tgl_mutasi)}</td><td>{m.nama_jenis}</td><td>{m.tipe_mutasi}</td><td className={`text-right font-mono ${Number(m.perubahan_kg) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Number(m.perubahan_kg) >= 0 ? '+' : ''}{fkg(m.perubahan_kg)}</td><td className="text-right font-mono">{fkg(m.saldo_setelah_kg)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

