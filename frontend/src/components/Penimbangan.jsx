/* US-09 — Penimbangan ulang pengepul & penyusutan (Petugas Timbang) */
import { useEffect, useState } from 'react'
import { useAuth, fkg } from '../App'
import { api } from '../api'

export default function Penimbangan() {
  const { me } = useAuth()
  const [stok, setStok] = useState([])
  const [pengepul, setPengepul] = useState({})
  const [tgl, setTgl] = useState(new Date().toISOString().slice(0, 10))
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { api('/stok').then(setStok).catch(e => setErr(e.message)) }, [])
  useEffect(() => { const init = {}; stok.forEach(s => init[s.id_jenis] = s.total_berat_kg); setPengepul(init) }, [stok])

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      const items = stok.map(s => ({ id_jenis: s.id_jenis, berat_pengepul: Number(pengepul[s.id_jenis] ?? s.total_berat_kg) }))
      const r = await api('/penimbangan-ulang', { method: 'POST', body: JSON.stringify({ tgl_penimbangan: tgl, items }) })
      setMsg(`Tersimpan. Ref: ${r.no_referensi} · Total penyusutan ${fkg(r.total_penyusutan)}`)
      api('/stok').then(setStok)
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-petugas">Aktor: Petugas Timbang</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Penimbangan Ulang Pengepul &amp; Penyusutan</h3>
          <p className="text-[11px] text-slate-500">Selisih (pengepul − catatan) negatif = penyusutan. Stok otomatis menyesuaikan.</p></div>
        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg"><i className="fa-solid fa-weight-scale"></i></div>
      </div>
      {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div><label className="lbl" htmlFor="pt">Tanggal Penimbangan *</label><input id="pt" type="date" className="input w-48" required value={tgl} onChange={e => setTgl(e.target.value)} /></div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="tbl min-w-[680px]">
            <thead><tr><th>Jenis</th><th className="text-right">Catatan (kg)</th><th className="text-right">Hasil Pengepul (kg)</th><th className="text-right">Selisih</th></tr></thead>
            <tbody>
              {stok.map(s => {
                const cat = Number(s.total_berat_kg)
                const pen = Number(pengepul[s.id_jenis] ?? cat)
                const sel = pen - cat
                return (
                  <tr key={s.id_jenis}>
                    <td className="font-bold">{s.nama_jenis}</td>
                    <td className="text-right font-mono">{cat.toFixed(1)}</td>
                    <td><input type="number" min="0" step="0.1" className="input !py-1.5 !text-xs text-right font-mono" value={pengepul[s.id_jenis] ?? cat} onChange={e => setPengepul({ ...pengepul, [s.id_jenis]: e.target.value })} /></td>
                    <td className={`text-right font-mono ${sel < 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>{sel >= 0 ? '+' : ''}{sel.toFixed(1)} kg</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end"><button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk"></i> Simpan Penimbangan Ulang</button></div>
      </form>
    </div>
  )
}
