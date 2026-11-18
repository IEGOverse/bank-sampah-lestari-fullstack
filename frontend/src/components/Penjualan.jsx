/* US-10 — Mencatat penjualan kepada pengepul (Ketua berwenang) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { fkg, tglID } from '../App'

export default function Penjualan() {
  const [stok, setStok] = useState([])
  const [tgl, setTgl] = useState(new Date().toISOString().slice(0, 10))
  const [ket, setKet] = useState('')
  const [baris, setBaris] = useState([{ id_jenis: 1, berat: '' }])
  const [riwayat, setRiwayat] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    setStok(await api('/stok'))
    setRiwayat(await api('/penjualan'))
  }
  useEffect(() => { load().catch(e => setErr(e.message)) }, [])

  const tambah = () => setBaris([...baris, { id_jenis: 1, berat: '' }])
  const hapus = (i) => setBaris(baris.filter((_, j) => j !== i))
  const ubah = (i, k, v) => { const b = [...baris]; b[i] = { ...b[i], [k]: v }; setBaris(b) }

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      const items = baris.filter(b => Number(b.berat) > 0).map(b => ({ id_jenis: Number(b.id_jenis), berat_keluar_kg: Number(b.berat) }))
      if (!items.length) throw new Error('Isi minimal satu jenis.')
      const r = await api('/penjualan', { method: 'POST', body: JSON.stringify({ tgl_penjualan: tgl, keterangan: ket, items }) })
      setMsg(`Tersimpan. Ref: ${r.no_referensi}`)
      setKet(''); setBaris([{ id_jenis: 1, berat: '' }]); load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="us-chip">US-10</span><span className="actor-badge actor-ketua">Aktor: Ketua (berwenang)</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Catat Penjualan ke Pengepul</h3>
          <p className="text-[11px] text-slate-500">Stok berkurang sesuai jumlah keluar. Pembayaran pengepul belum dipastikan klien.</p></div>
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg"><i className="fa-solid fa-truck-ramp-box"></i></div>
      </div>
      {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl" htmlFor="jt">Tanggal *</label><input id="jt" type="date" className="input" required value={tgl} onChange={e => setTgl(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="jk">Keterangan</label><input id="jk" className="input" placeholder="mis. Penjualan rutin ± 2 mingguan" value={ket} onChange={e => setKet(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="tbl min-w-[640px]">
            <thead><tr><th>Jenis</th><th className="text-right">Stok (kg)</th><th className="text-right">Jumlah Dijual</th><th></th></tr></thead>
            <tbody>
              {baris.map((b, i) => {
                const st = stok.find(s => s.id_jenis === Number(b.id_jenis))
                const stokKg = st ? Number(st.total_berat_kg) : 0
                return (
                  <tr key={i}>
                    <td><select className="input !py-1.5 !text-xs" value={b.id_jenis} onChange={e => ubah(i, 'id_jenis', e.target.value)}>{stok.map(s => <option key={s.id_jenis} value={s.id_jenis}>{s.nama_jenis}</option>)}</select></td>
                    <td className="text-right font-mono">{stokKg.toFixed(1)}</td>
                    <td><input type="number" min="0" step="0.1" className="input !py-1.5 !text-xs text-right font-mono" placeholder="0,0" value={b.berat} onChange={e => ubah(i, 'berat', e.target.value)} /></td>
                    <td className="text-center"><button type="button" className="text-red-400 hover:text-red-600" onClick={() => hapus(i)}><i className="fa-solid fa-trash-can"></i></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-slate !py-2" onClick={tambah}><i className="fa-solid fa-plus"></i> Tambah Jenis</button>
        <div className="flex justify-end"><button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk"></i> Simpan Penjualan</button></div>
      </form>
      <div className="mt-5"><h4 className="font-extrabold text-sm text-slate-800 mb-2">Riwayat Penjualan</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-64 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Tanggal</th><th>Ref.</th><th>Jenis</th><th className="text-right">Jumlah (kg)</th></tr></thead><tbody>{riwayat.map((r, i) => <tr key={i}><td>{tglID(r.tgl_penjualan)}</td><td className="font-mono text-[10px]">{r.no_referensi}</td><td>{r.nama_jenis}</td><td className="text-right font-mono">{fkg(r.berat_keluar_kg)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}

