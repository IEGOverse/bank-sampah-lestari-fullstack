/* US-06 — Memeriksa saldo & riwayat (Nasabah: milik sendiri; pengurus: cari rek.) */
import { useEffect, useState } from 'react'
import { useAuth, rupiah, tglID } from '../App'
import { api } from '../api'

export default function Saldo() {
  const { me } = useAuth()
  const [data, setData] = useState(null)
  const [cari, setCari] = useState('')
  const [hasil, setHasil] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const peran = me.pengguna.peran
    if (peran === 'Nasabah') api('/nasabah/me').then(setData).catch(e => setErr(e.message))
    else setErr('') // pengurus: pakai panel pencarian
  }, [me])

  const peran = me.pengguna.peran
  const bisaCari = peran === 'Ketua' || peran === 'Bendahara'

  if (peran === 'Nasabah') {
    return (
      <div className="space-y-5">
        {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        {data && (
          <>
            <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-tr from-slate-950 via-emerald-950 to-slate-900 text-white shadow-2xl border border-emerald-500/30">
              <span className="us-chip">US-06</span><span className="dummy-badge ml-2">Data Dummy</span>
              <h3 className="text-xl sm:text-2xl font-black mt-3">{data.nama_nasabah}</h3>
              <p className="text-xs text-slate-300 font-mono">No. Rekening: {data.no_rekening} · Terdaftar {tglID(data.tgl_daftar)}</p>
              <div className="pt-5 mt-5 border-t border-white/10"><p className="text-[10px] text-slate-400">SALDO TABUNGAN SAYA</p><h2 className="text-3xl font-black text-emerald-400 font-mono mt-1">{rupiah(data.saldo)}</h2></div>
            </div>
            <div className="glass-card p-5 sm:p-6 rounded-3xl">
              <h4 className="font-extrabold text-sm text-slate-800 mb-3">Riwayat Setoran &amp; Penarikan Saya</h4>
              <RiwayatTable />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl border-l-4 !border-l-amber-400">
      <div className="flex items-center gap-2 flex-wrap mb-2"><span className="actor-badge actor-ketua">Aktor: Ketua / Bendahara (terbatas)</span><span className="dummy-badge">Data Dummy</span></div>
      <h3 className="text-lg font-black text-slate-800">Pemeriksaan Nasabah oleh Pengurus</h3>
      <p className="text-[11px] text-slate-500 mb-3">Cari berdasarkan no. rekening untuk kasus buku tabungan hilang/berbeda.</p>
      {bisaCari ? (
        <>
          <div className="flex gap-2 max-w-md">
            <input className="input font-mono" placeholder="No. rekening, mis. BS-0000001" value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => e.key === 'Enter' && api('/nasabah/' + cari.toUpperCase() + '/riwayat').then(setHasil).catch(e2 => setErr(e2.message))} />
            <button className="btn btn-slate" onClick={() => api('/nasabah/' + cari.toUpperCase() + '/riwayat').then(setHasil).catch(e2 => setErr(e2.message))}><i className="fa-solid fa-magnifying-glass"></i> Tampilkan</button>
          </div>
          {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-3">{err}</p>}
          {hasil && (
            <div className="mt-4 text-xs max-w-lg">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Nama</span><span className="font-bold">{hasil.nama_nasabah}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Saldo</span><span className="font-mono font-bold">{rupiah(hasil.saldo)}</span></div>
              </div>
              <div className="mt-3"><h4 className="font-extrabold text-xs mb-2">Mutasi</h4><RiwayatTable rek={hasil.no_rekening} compact /></div>
            </div>
          )}
        </>
      ) : <p className="text-[11px] text-slate-400">Petugas Timbang tidak memiliki akses saldo.</p>}
    </div>
  )
}

function RiwayatTable({ rek }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    const url = rek ? `/nasabah/${rek}/riwayat` : '/nasabah/me/riwayat'
    api(url).then(d => setRows(d.riwayat || [])).catch(() => {})
  }, [rek])
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="tbl">
        <thead><tr><th>Tanggal</th><th>Aktivitas</th><th>Ref.</th><th className="text-right">Nominal</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td className="text-slate-500">{tglID(r.iso)}</td><td><span className={`pill ${r.plus ? 'pill-ok' : 'pill-red'}`}>{r.tipe}</span></td><td className="font-mono text-[10px]">{r.ref}</td><td className={`text-right font-bold ${r.plus ? 'text-emerald-600' : 'text-red-600'}`}>{r.plus ? '+' : '−'} {rupiah(r.nominal)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="text-center text-slate-400 py-3">Belum ada transaksi.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
