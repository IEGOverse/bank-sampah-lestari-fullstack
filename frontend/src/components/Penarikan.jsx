/* US-07 — Mencatat penarikan tabungan (Bendahara) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, tglID } from '../App'

export default function Penarikan() {
  const [nasabah, setNasabah] = useState([])
  const [pilih, setPilih] = useState('')
  const [jumlah, setJumlah] = useState('50000')
  const [riwayat, setRiwayat] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    setNasabah(await api('/nasabah'))
    setRiwayat(await api('/penarikan?limit=10'))
  }
  useEffect(() => { load().catch(e => setErr(e.message)) }, [])

  const n = nasabah.find(x => x.no_rekening === pilih)
  const desember = new Date().getMonth() === 11
  const jumlahBulan = 0

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      const r = await api('/penarikan', { method: 'POST', body: JSON.stringify({ no_rekening: pilih, jumlah_tarik: Number(jumlah) }) })
      setMsg(`Tersimpan. Ref: ${r.no_referensi} · Sisa saldo ${rupiah(r.sisa_saldo)}`)
      setJumlah('50000'); load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="max-w-2xl mx-auto glass-card p-5 sm:p-7 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-bendahara">Aktor: Bendahara</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Catat Penarikan Tabungan</h3>
          <p className="text-[11px] text-slate-500">Min Rp50.000 · maks 1×/bulan · khusus Desember boleh seluruh saldo (BR-08, BR-09).</p></div>
        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg"><i className="fa-solid fa-money-bill-transfer"></i></div>
      </div>
      {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="lbl" htmlFor="tn">Cari Nasabah *</label>
          <select id="tn" className="input font-semibold" required value={pilih} onChange={e => setPilih(e.target.value)}>
            <option value="">— pilih nasabah —</option>
            {nasabah.map(x => <option key={x.no_rekening} value={x.no_rekening}>{x.no_rekening} — {x.nama_nasabah}</option>)}
          </select>
        </div>
        {n && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-[9px] font-extrabold text-slate-500 uppercase">Saldo</p><p className="font-mono font-black text-slate-800 text-sm">{rupiah(n.saldo)}</p></div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-[9px] font-extrabold text-slate-500 uppercase">Sisa Setelah Tarik</p><p className="font-mono font-black text-emerald-700 text-sm">{rupiah(Math.max(0, Number(n.saldo) - Number(jumlah || 0)))}</p></div>
          </div>
        )}
        <div><label className="lbl" htmlFor="tj">Jumlah (Rp) *</label><input id="tj" type="number" min="0" step="1000" className="input font-mono font-bold" required value={jumlah} onChange={e => setJumlah(e.target.value)} /></div>
        <p className="text-[10px] text-slate-400">{desember ? 'Bulan Desember: boleh tarik seluruh tabungan.' : 'Penarikan bulan ini: maksimal 1×/bulan · min Rp50.000.'}</p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100"><button type="submit" className="btn btn-amber"><i className="fa-solid fa-check"></i> Simpan Penarikan</button></div>
      </form>
      <div className="mt-5"><h4 className="font-extrabold text-sm text-slate-800 mb-2">Riwayat Penarikan</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-64 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Tanggal</th><th>Ref.</th><th>Nasabah</th><th className="text-right">Jumlah</th><th className="text-right">Sisa</th></tr></thead><tbody>{riwayat.map(r => <tr key={r.no_referensi}><td>{tglID(r.tgl_tarik)}</td><td className="font-mono text-[10px]">{r.no_referensi}</td><td>{r.nama_nasabah}</td><td className="text-right font-mono">{rupiah(r.jumlah_tarik)}</td><td className="text-right font-mono">{rupiah(r.sisa_saldo)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}

