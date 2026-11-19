/* US-11 — Mencatat Kas Operasional (Bendahara) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, tglID } from '../App'

export default function Kas() {
  const [data, setData] = useState({ saldo: 0, kas: [] })
  const [tipe, setTipe] = useState('PENGELUARAN')
  const [nominal, setNominal] = useState('')
  const [ket, setKet] = useState('')
  const [tgl, setTgl] = useState(new Date().toISOString().slice(0, 10))
  const [ref, setRef] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => setData(await api('/kas'))
  useEffect(() => { load().catch(e => setErr(e.message)) }, [])

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      await api('/kas', { method: 'POST', body: JSON.stringify({ tipe_kas: tipe, nominal: Number(nominal), keterangan: ket, tgl_kas: tgl, referensi: ref || null }) })
      setMsg('Kas tersimpan.'); setNominal(''); setKet(''); setRef(''); load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 glass-card p-5 sm:p-6 rounded-3xl">
        <div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-bendahara">Aktor: Bendahara</span><span className="dummy-badge">Data Dummy</span></div>
        <h3 className="text-lg font-black text-slate-800 mt-2">Catat Kas Operasional</h3>
        <p className="text-[11px] text-slate-500 mb-4">Pemasukan (termasuk 10% setoran) &amp; pengeluaran (karung, transportasi).</p>
        {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
        {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 rounded-xl p-3 cursor-pointer text-xs font-bold text-emerald-900"><input type="radio" name="tipe" value="PEMASUKAN" checked={tipe === 'PEMASUKAN'} onChange={e => setTipe(e.target.value)} /> Pemasukan</label>
            <label className="flex items-center gap-2 border border-red-200 bg-red-50 rounded-xl p-3 cursor-pointer text-xs font-bold text-red-900"><input type="radio" name="tipe" value="PENGELUARAN" checked={tipe === 'PENGELUARAN'} onChange={e => setTipe(e.target.value)} /> Pengeluaran</label>
          </div>
          <div><label className="lbl" htmlFor="kt">Tanggal *</label><input id="kt" type="date" className="input" required value={tgl} onChange={e => setTgl(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="kn">Nominal (Rp) *</label><input id="kn" type="number" min="0" step="500" className="input font-mono font-bold" required placeholder="150000" value={nominal} onChange={e => setNominal(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="kk">Keterangan *</label><input id="kk" className="input" required placeholder="mis. Pembelian karung" value={ket} onChange={e => setKet(e.target.value)} list="presets" /><datalist id="presets"><option value="Pembelian karung"></option><option value="Biaya transportasi pengepul"></option></datalist></div>
          <div><label className="lbl" htmlFor="kr">Referensi (opsional)</label><input id="kr" className="input font-mono" placeholder="mis. SET-202611-00001" value={ref} onChange={e => setRef(e.target.value)} /></div>
          <div className="flex justify-end"><button type="submit" className="btn btn-amber"><i className="fa-solid fa-floppy-disk"></i> Simpan Kas</button></div>
        </form>
      </div>
      <div className="lg:col-span-3 glass-card p-5 sm:p-6 rounded-3xl">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h4 className="font-extrabold text-sm text-slate-800">Buku Kas</h4>
          <div className="text-right"><p className="text-[9px] font-extrabold text-slate-400 uppercase">Saldo Kas</p><p className="font-mono font-black text-purple-800">{rupiah(data.saldo)}</p></div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-96 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Keterangan</th><th className="text-right">Nominal</th><th>Ref.</th></tr></thead><tbody>{data.kas.map((k, i) => <tr key={i}><td>{tglID(k.tgl_kas)}</td><td><span className={`pill ${k.tipe_kas === 'PEMASUKAN' ? 'pill-ok' : 'pill-red'}`}>{k.tipe_kas === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}</span></td><td>{k.keterangan}</td><td className={`text-right font-mono ${k.tipe_kas === 'PEMASUKAN' ? 'text-emerald-700' : 'text-red-700'}`}>{k.tipe_kas === 'PEMASUKAN' ? '+' : '−'} {Number(k.nominal).toLocaleString('id-ID')}</td><td className="font-mono text-[10px]">{k.referensi_tabel ? 'terkait transaksi' : '—'}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}

