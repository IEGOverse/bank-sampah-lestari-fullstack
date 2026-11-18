/* US-05 — Mengatur harga sampah per kg + riwayat (Ketua) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { tglID } from '../App'

const jenisLabel = ['Botol Plastik', 'Plastik Campur', 'Kardus', 'Kertas', 'Besi', 'Aluminium', 'Botol Kaca']

export default function Harga() {
  const [rows, setRows] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [baru, setBaru] = useState({})
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    setRows(await api('/harga?berlaku=' + new Date().toISOString().slice(0, 10)))
    setRiwayat(await api('/harga/riwayat'))
  }
  useEffect(() => { load().catch(e => setErr(e.message)) }, [])

  const simpan = async (id_jenis, nama) => {
    const harga = Number(baru[id_jenis])
    if (!harga || harga <= 0) { setErr('Isi harga (> 0) untuk ' + nama); return }
    try {
      setErr(''); await api('/harga', { method: 'POST', body: JSON.stringify({ id_jenis, harga_per_kg: harga }) })
      setMsg('Harga ' + nama + ' diperbarui.'); setBaru({ ...baru, [id_jenis]: '' }); load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 sm:p-6 rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
          <div><div className="flex items-center gap-2 flex-wrap"><span className="us-chip">US-05</span><span className="actor-badge actor-ketua">Aktor: Ketua</span><span className="dummy-badge">Data Dummy</span></div>
            <h3 className="text-lg font-black text-slate-800 mt-2">Mengatur Harga Sampah per kg</h3>
            <p className="text-[11px] text-slate-500">Harga baru menutup periode berjalan dan berlaku mulai hari ini; setoran lama memakai harga historis (BR-05).</p></div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg"><i className="fa-solid fa-tags"></i></div>
        </div>
        {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
        {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="tbl">
            <thead><tr><th>Jenis</th><th className="text-right">Harga Berjalan (Rp/kg)</th><th>Berlaku Sejak</th><th className="text-right">Harga Baru</th><th></th></tr></thead>
            <tbody>
              {jenisLabel.map((l, i) => {
                const id = i + 1
                const h = rows.find(r => r.id_jenis === id)
                return (
                  <tr key={id}>
                    <td className="font-bold">{l}</td>
                    <td className="text-right font-mono">{h ? Number(h.harga_per_kg).toLocaleString('id-ID') : '—'}</td>
                    <td className="font-mono text-[11px]">{h ? tglID(h.periode_mulai) : '—'}</td>
                    <td className="text-right"><input type="number" min="0" step="50" className="input !py-1.5 !text-xs text-right font-mono w-28" placeholder="0" value={baru[id] || ''} onChange={e => setBaru({ ...baru, [id]: e.target.value })} /></td>
                    <td className="text-center"><button className="btn btn-primary !py-1.5 !px-3 !text-[10px]" onClick={() => simpan(id, l)}>Simpan</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="glass-card p-5 sm:p-6 rounded-3xl">
        <h4 className="font-extrabold text-sm text-slate-800 mb-3">Riwayat Harga</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-80 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Jenis</th><th>Periode Mulai</th><th>Periode Berakhir</th><th className="text-right">Harga/kg</th><th>Ditetapkan</th></tr></thead>
            <tbody>{riwayat.map(h => <tr key={h.id_harga}><td className="font-bold">{h.nama_jenis}</td><td className="font-mono">{tglID(h.periode_mulai)}</td><td className="font-mono">{h.periode_selesai ? tglID(h.periode_selesai) : <span className="pill pill-ok">Berjalan</span>}</td><td className="text-right font-mono">{Number(h.harga_per_kg).toLocaleString('id-ID')}</td><td>{h.penetap || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

