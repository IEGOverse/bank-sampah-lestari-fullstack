/* US-04 — Mencatat Setoran Sampah (Petugas Timbang) */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, fkg, tglID } from '../App'

const IDX = { BotolPlastik: 1, PlastikCampur: 2, Kardus: 3, Kertas: 4, Besi: 5, Aluminium: 6, BotolKaca: 7 }
const jenisLabel = ['Botol Plastik', 'Plastik Campur', 'Kardus', 'Kertas', 'Besi', 'Aluminium', 'Botol Kaca']

export default function Setoran() {
  const [nasabah, setNasabah] = useState([])
  const [pilih, setPilih] = useState('')
  const [tgl, setTgl] = useState(new Date().toISOString().slice(0, 10))
  const [harga, setHarga] = useState({})
  const [baris, setBaris] = useState([{ id_jenis: 1, berat_kg: '' }])
  const [err, setErr] = useState('')
  const [sukses, setSukses] = useState('')
  const [riwayat, setRiwayat] = useState([])

  useEffect(() => {
    api('/nasabah').then(rows => setNasabah(rows)).catch(e => setErr(e.message))
  }, [])
  useEffect(() => {
    api('/harga?berlaku=' + tgl).then(rows => { const m = {}; rows.forEach(r => m[r.id_jenis] = Number(r.harga_per_kg)); setHarga(m) }).catch(() => {})
    api('/setoran?limit=5').then(setRiwayat).catch(() => {})
  }, [tgl])

  const tambah = () => setBaris([...baris, { id_jenis: 1, berat_kg: '' }])
  const hapus = (i) => setBaris(baris.filter((_, j) => j !== i))
  const ubah = (i, k, v) => { const b = [...baris]; b[i] = { ...b[i], [k]: v }; setBaris(b) }

  const total = baris.reduce((acc, b) => acc + (Number(b.berat_kg) || 0) * (harga[b.id_jenis] || 0), 0)
  const tab = Math.round(total * 0.9)

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setSukses(null)
    try {
      const items = baris.filter(b => Number(b.berat_kg) > 0).map(b => ({ id_jenis: Number(b.id_jenis), berat_kg: Number(b.berat_kg) }))
      if (!items.length) throw new Error('Isi minimal satu jenis dengan berat > 0.')
      const r = await api('/setoran', { method: 'POST', body: JSON.stringify({ no_rekening: pilih, tgl_setor: tgl, items }) })
      setSukses({ ref: r.no_referensi, total: r.total_nilai, tab: r.nilai_tabungan, kas: r.nilai_kas_operasional, rek: pilih, tgl, items })
      setPilih(''); setBaris([{ id_jenis: 1, berat_kg: '' }])
      api('/setoran?limit=5').then(setRiwayat).catch(() => {})
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
      <div className="flex items-start justify-between gap-3 border-b pb-4 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="actor-badge actor-petugas">Aktor: Petugas Timbang</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Catat Setoran Sampah — Sabtu Pagi</h3>
          <p className="text-[11px] text-slate-500">Harga diambil dari periode bulan setoran; 90% tabungan · 10% kas operasional.</p></div>
        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg"><i className="fa-solid fa-scale-balanced"></i></div>
      </div>
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
      {sukses && (
        <div className="border border-emerald-300 bg-emerald-50 rounded-2xl p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-extrabold text-emerald-800">✅ Setoran Tersimpan</p>
              <p className="font-mono text-[11px] mt-1">{sukses.ref} · {sukses.tgl} · {sukses.rek}</p>
            </div>
            <button className="btn btn-primary !py-1.5 !px-4 !text-[11px]" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Cetak Bukti</button>
          </div>
          <div className="mt-3 border-t border-emerald-200 pt-2">
            <ul className="font-mono text-[11px] space-y-0.5">
              {sukses.items.map((it, i) => <li key={i}>Jenis #{it.id_jenis} · {it.berat_kg} kg</li>)}
            </ul>
            <div className="mt-2 flex justify-between font-bold"><span>Total</span><span>{rupiah(sukses.total)}</span></div>
            <div className="flex justify-between"><span>Tabungan 90%</span><span>{rupiah(sukses.tab)}</span></div>
            <div className="flex justify-between"><span>Kas 10%</span><span>{rupiah(sukses.kas)}</span></div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="lbl" htmlFor="sn">Nasabah *</label>
            <select id="sn" className="input font-semibold" required value={pilih} onChange={e => setPilih(e.target.value)}>
              <option value="">— pilih nasabah —</option>
              {nasabah.map(n => <option key={n.no_rekening} value={n.no_rekening}>{n.no_rekening} — {n.nama_nasabah}</option>)}
            </select>
          </div>
          <div><label className="lbl" htmlFor="st">Tanggal Setoran *</label><input id="st" type="date" className="input" required value={tgl} onChange={e => setTgl(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="tbl min-w-[640px]">
            <thead><tr><th>Jenis</th><th className="text-right">Berat (kg)</th><th className="text-right">Harga/kg</th><th className="text-right">Subtotal</th><th></th></tr></thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i}>
                  <td><select className="input !py-1.5 !text-xs" value={b.id_jenis} onChange={e => ubah(i, 'id_jenis', e.target.value)}>{jenisLabel.map((l, j) => <option key={j} value={j + 1}>{l}</option>)}</select></td>
                  <td><input type="number" min="0" step="0.01" className="input !py-1.5 !text-xs text-right font-mono" placeholder="0,00" value={b.berat_kg} onChange={e => ubah(i, 'berat_kg', e.target.value)} /></td>
                  <td className="text-right font-mono">{(harga[b.id_jenis] || 0).toLocaleString('id-ID')}</td>
                  <td className="text-right font-mono">{rupiah((Number(b.berat_kg) || 0) * (harga[b.id_jenis] || 0))}</td>
                  <td className="text-center"><button type="button" className="text-red-400 hover:text-red-600" onClick={() => hapus(i)}><i className="fa-solid fa-trash-can"></i></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-xs"><tr><td className="p-3" colSpan={3}>TOTAL</td><td className="p-3 text-right font-mono">{rupiah(total)}</td><td></td></tr></tfoot>
          </table>
        </div>
        <button type="button" className="btn btn-slate !py-2" onClick={tambah}><i className="fa-solid fa-plus"></i> Tambah Jenis</button>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200"><p className="text-[10px] font-extrabold text-emerald-800 uppercase">Tabungan (90%)</p><p className="text-lg font-black font-mono text-emerald-900 mt-1">{rupiah(tab)}</p></div>
          <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200"><p className="text-[10px] font-extrabold text-purple-800 uppercase">Kas (10%)</p><p className="text-lg font-black font-mono text-purple-900 mt-1">{rupiah(total - tab)}</p></div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-[10px] font-extrabold text-slate-500 uppercase">Nasabah</p><p className="text-xs font-bold text-slate-800 mt-2">{pilih ? pilih : '—'}</p></div>
        </div>
        <div className="flex justify-end gap-2"><button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk"></i> Simpan Setoran</button></div>
      </form>
      <div>
        <h4 className="font-extrabold text-sm text-slate-800 mb-2">5 Setoran Terakhir</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="tbl"><thead><tr><th>Tanggal</th><th>Ref.</th><th>Nasabah</th><th className="text-right">Berat</th><th className="text-right">Total</th></tr></thead><tbody>{riwayat.map(r => <tr key={r.no_referensi}><td>{tglID(r.tgl_setor)}</td><td className="font-mono text-[10px]">{r.no_referensi}</td><td>{r.nama_nasabah}</td><td className="text-right font-mono">{fkg(r.total_berat)}</td><td className="text-right font-mono">{rupiah(r.total_nilai)}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  )
}

