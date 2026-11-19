/* US-13 — Laporan (Ketua) — 7 jenis laporan + cetak */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, fkg, tglID } from '../App'

const TABS = [
  { k: 'setoran', label: 'Setoran' },
  { k: 'penarikan', label: 'Penarikan' },
  { k: 'saldo', label: 'Saldo Nasabah' },
  { k: 'stok', label: 'Stok' },
  { k: 'penyusutan', label: 'Penyusutan' },
  { k: 'penjualan', label: 'Penjualan' },
  { k: 'kas', label: 'Kas Operasional' },
]

export default function Laporan() {
  const [tab, setTab] = useState('setoran')
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7))
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setData(null); setErr('')
    api(`/laporan/${tab}?bulan=${bulan}`).then(setData).catch(e => setErr(e.message))
  }, [tab, bulan])

  const fmtCell = (k, v) => {
    if (v === null || v === undefined) return '—'
    if (k === 'saldo' || k === 'nominal' || k === 'total_nilai' || k === 'nilai_tabungan' || k === 'nilai_kas_operasional' || k === 'jumlah_tarik' || k === 'estimasi_nilai') return rupiah(v)
    if (k === 'total_berat' || k === 'berat_keluar_kg' || k === 'total_berat_kg' || k === 'selisih_kg') return fkg(v)
    if (k === 'tgl_setor' || k === 'tgl_tarik' || k === 'tgl_kas' || k === 'tgl_penjualan' || k === 'tgl_penimbangan') return tglID(v)
    return String(v)
  }

  const lap = data?.laporan?.[0]
  const rows = lap?.baris || []

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-4 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-ketua">Aktor: Ketua</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Laporan Bank Sampah Lestari</h3></div>
        <div className="flex items-center gap-2">
          <input type="month" className="input w-40" value={bulan} onChange={e => setBulan(e.target.value)} />
          <button className="btn btn-slate" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Cetak</button>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {TABS.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`whitespace-nowrap px-3 py-2 rounded-xl text-[11px] font-extrabold border ${tab === t.k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t.label}</button>)}
      </div>
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-3">{err}</p>}
      {!data ? <p className="text-slate-500 text-sm mt-3">Memuat…</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 mt-3">
          <table className="tbl">
            <thead><tr>{lap.kolom.map((k, i) => <th key={i}>{k}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v], j) => <td key={j}>{fmtCell(k, v)}</td>)}</tr>)}
              {!rows.length && <tr><td colSpan={lap.kolom.length} className="text-center text-slate-400 py-4">Tidak ada data bulan ini.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-2">Seluruh angka adalah DATA DUMMY.</p>
    </div>
  )
}

