import { useEffect, useState } from 'react'
import { api } from '../api'
import { rupiah, fkg } from '../App'

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api('/laporan/ringkasan').then(setD).catch(e => setErr(e.message)) }, [])
  if (err) return <p className="text-red-600 text-sm">{err}</p>
  if (!d) return <p className="text-slate-500 text-sm">Memuat…</p>
  const cards = [
    ['Nasabah Aktif', d.nasabah_aktif + ' nasabah'],
    ['Stok Gudang', fkg(d.stok_total)],
    ['Tabungan (90%)', rupiah(d.saldo_nasabah)],
    ['Kas (10%)', rupiah(d.saldo_kas)],
  ]
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute -right-8 -bottom-12 opacity-10 text-[150px]"><i className="fa-solid fa-recycle"></i></div>
        <div className="relative">
          <span className="actor-badge actor-ketua mb-2">Aktor: Ketua</span>
          <h2 className="text-xl sm:text-2xl font-black">Sistem Informasi Manajemen<br/>Bank Sampah Lestari</h2>
          <p className="text-emerald-100 text-xs mt-2">Pengawasan: nasabah, stok, tabungan (90%) &amp; kas operasional (10%).</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([t, v]) => (
          <div key={t} className="glass-card p-4 sm:p-5 rounded-2xl">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase">{t}</p>
            <h3 className="text-lg sm:text-xl font-black mt-1 font-mono">{v}</h3>
            <p className="text-[9px] text-slate-400 mt-1">DATA DUMMY</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-5 sm:p-6 rounded-3xl text-[11px] text-slate-600">
        <h3 className="font-extrabold text-sm text-slate-800 mb-2">Pengingat Operasional</h3>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Setoran setiap <strong>Sabtu pagi</strong> (BR-01).</li>
          <li>Harga ditetapkan <strong>awal bulan</strong> (BR-04) → US-05.</li>
          <li>Pengepul datang <strong>± 2 mingguan</strong> (BR-10) → US-09.</li>
          <li>Penarikan min <strong>Rp50.000</strong>, maks <strong>1×/bulan</strong> (BR-08); Desember boleh seluruh saldo (BR-09).</li>
        </ul>
      </div>
    </div>
  )
}

