/* US-12 — Mengoreksi transaksi (Ketua) — Setoran & Kas; riwayat audit */
import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, tglID } from '../App'

export default function Koreksi() {
  const [tipe, setTipe] = useState('setoran')
  const [ref, setRef] = useState('')
  const [panel, setPanel] = useState(null)
  const [audit, setAudit] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const loadAudit = () => api('/audit').then(setAudit).catch(e => setErr(e.message))
  useEffect(() => { loadAudit() }, [])

  const cari = async () => {
    setErr(''); setMsg(''); setPanel(null)
    try {
      if (tipe === 'setoran') setPanel({ kind: 'setoran', data: await api('/setoran/by-ref/' + ref.trim().toUpperCase()) })
      else {
        const d = await api('/kas'); const k = d.kas.find(x => x.no_referensi === ref.trim().toUpperCase()); if (!k) throw new Error('Transaksi kas tidak ditemukan.')
        setPanel({ kind: 'kas', data: k })
      }
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 sm:p-6 rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
          <div><div className="flex items-center gap-2 flex-wrap"><span className="us-chip">US-12</span><span className="actor-badge actor-ketua">Aktor: Ketua (berwenang)</span><span className="dummy-badge">Data Dummy</span></div>
            <h3 className="text-lg font-black text-slate-800 mt-2">Koreksi Transaksi</h3>
            <p className="text-[11px] text-slate-500">Setoran &amp; Kas didukung; wajib alasan; tercatat di audit log; 90:10 &amp; stok otomatis disesuaikan.</p></div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg"><i className="fa-solid fa-pen-to-square"></i></div>
        </div>
        {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
        {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
        <div className="flex flex-wrap gap-2 max-w-2xl mb-4">
          <select className="input w-36" value={tipe} onChange={e => { setTipe(e.target.value); setPanel(null) }}><option value="setoran">Setoran</option><option value="kas">Kas</option></select>
          <input className="input font-mono flex-1" placeholder="No. referensi, mis. SET-202611-00001" value={ref} onChange={e => setRef(e.target.value)} onKeyDown={e => e.key === 'Enter' && cari()} />
          <button className="btn btn-slate" onClick={cari}><i className="fa-solid fa-magnifying-glass"></i> Cari</button>
        </div>
        {panel?.kind === 'setoran' && <SetoranEditor data={panel.data} onDone={(m) => { setMsg(m); setPanel(null); setRef(''); loadAudit() }} onErr={setErr} />}
        {panel?.kind === 'kas' && <KasEditor data={panel.data} onDone={(m) => { setMsg(m); setPanel(null); setRef(''); loadAudit() }} onErr={setErr} />}
      </div>

      <div className="glass-card p-5 sm:p-6 rounded-3xl">
        <h4 className="font-extrabold text-sm text-slate-800 mb-3">Riwayat Koreksi / Audit Log</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-72 overflow-y-auto">
          <table className="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Tabel / Ref.</th><th>Aksi</th><th>Alasan</th></tr></thead><tbody>{audit.map((a, i) => <tr key={i}><td className="text-slate-500">{String(a.waktu).replace('T', ' ').slice(0, 16)}</td><td>{a.pengguna || '-'}</td><td className="font-mono text-[10px]">{a.tabel_terkait} / {a.id_referensi}</td><td><span className="pill pill-warn">{a.aksi}</span></td><td>{a.alasan || '-'}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  )
}

function SetoranEditor({ data, onDone, onErr }) {
  const [items, setItems] = useState(data.items.map(it => ({ id_jenis: it.id_jenis, nama_jenis: it.nama_jenis, harga_saat_setor: Number(it.harga_saat_setor), berat_kg: String(it.berat_kg) })))
  const [alasan, setAlasan] = useState('')
  const save = async () => {
    try {
      if (!alasan.trim()) throw new Error('Alasan koreksi wajib diisi.')
      const payload = items.map(it => ({ id_jenis: it.id_jenis, berat_kg: Number(it.berat_kg) }))
      if (payload.some(p => !Number.isFinite(p.berat_kg) || p.berat_kg <= 0)) throw new Error('Semua berat harus > 0.')
      await api('/koreksi', { method: 'POST', body: JSON.stringify({ tipe: 'setoran', no_referensi: data.no_referensi, items_baru: payload, alasan }) })
      onDone('Setoran terkoreksi & tercatat di audit log.')
    } catch (e) { onErr(e.message) }
  }
  const total = items.reduce((a, b) => a + Number(b.berat_kg || 0) * b.harga_saat_setor, 0)
  return (
    <div className="text-xs">
      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-2">Sebelum — DUMMY · Ref {data.no_referensi} · Nasabah {data.nama_nasabah}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="font-bold flex-1">{it.nama_jenis} · Rp{it.harga_saat_setor.toLocaleString('id-ID')}/kg</span>
            <input type="number" min="0.01" step="0.01" className="input !py-1.5 !text-xs text-right font-mono w-28" value={it.berat_kg} onChange={e => { const arr = [...items]; arr[i] = { ...arr[i], berat_kg: e.target.value }; setItems(arr) }} />
          </div>
        ))}
        <div className="flex justify-between font-bold pt-2 border-t border-slate-200"><span>Estimasi total</span><span className="font-mono">{rupiah(total)}</span></div>
        <div><label className="lbl">Alasan Koreksi *</label><textarea className="input" rows={2} required placeholder="mis. Salah input berat" value={alasan} onChange={e => setAlasan(e.target.value)}></textarea></div>
        <div className="flex justify-end"><button className="btn btn-primary" onClick={save}><i className="fa-solid fa-check"></i> Simpan Koreksi</button></div>
      </div>
    </div>
  )
}

function KasEditor({ data, onDone, onErr }) {
  const [nominal, setNominal] = useState(String(data.nominal))
  const [ket, setKet] = useState(data.keterangan)
  const [alasan, setAlasan] = useState('')
  const save = async () => {
    try {
      if (!alasan.trim()) throw new Error('Alasan koreksi wajib diisi.')
      await api('/koreksi', { method: 'POST', body: JSON.stringify({ tipe: 'kas', no_referensi: data.no_referensi, nominal_baru: Number(nominal), keterangan_baru: ket, alasan }) })
      onDone('Kas terkoreksi & tercatat di audit log.')
    } catch (e) { onErr(e.message) }
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
        <p className="font-extrabold text-slate-500 uppercase text-[10px]">Sebelum — DUMMY · Ref {data.no_referensi}</p>
        <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className="font-bold">{data.tipe_kas}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Nominal</span><span className="font-mono">{rupiah(data.nominal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Keterangan</span><span>{data.keterangan}</span></div>
      </div>
      <div className="space-y-2">
        <div><label className="lbl">Nominal Baru (Rp)</label><input type="number" min="0" step="500" className="input font-mono" value={nominal} onChange={e => setNominal(e.target.value)} /></div>
        <div><label className="lbl">Keterangan Baru</label><input className="input" value={ket} onChange={e => setKet(e.target.value)} /></div>
        <div><label className="lbl">Alasan Koreksi *</label><textarea className="input" rows={2} required placeholder="mis. Salah input nominal" value={alasan} onChange={e => setAlasan(e.target.value)}></textarea></div>
        <div className="flex justify-end"><button className="btn btn-primary" onClick={save}><i className="fa-solid fa-check"></i> Simpan Koreksi</button></div>
      </div>
    </div>
  )
}

