/* App: routing sederhana berbasis tab + auth via JWT.
   RBAC praktis: menu disembunyikan sesuai peran (otorisasi server tetap di API). */
import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { api, getToken, setToken } from './api'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import US03Peran from './components/US03Peran'
import Setoran from './components/Setoran'
import Harga from './components/Harga'
import Saldo from './components/Saldo'
import Penarikan from './components/Penarikan'
import Stok from './components/Stok'
import Penimbangan from './components/Penimbangan'
import Penjualan from './components/Penjualan'
import Kas from './components/Kas'
import Koreksi from './components/Koreksi'
import Laporan from './components/Laporan'

export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)
export const rupiah = (n) => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID')
export const fkg = (n) => Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' kg'
export const tglID = (iso) => { if (!iso) return '-'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', roles: ['Ketua'] },
  { id: 'us03', label: 'US-03 · Peran Pengurus', icon: 'fa-user-shield', roles: ['Ketua'] },
  { id: 'us04', label: 'US-04 · Catat Setoran', icon: 'fa-scale-balanced', roles: ['Petugas Timbang', 'Ketua'] },
  { id: 'us05', label: 'US-05 · Harga Sampah', icon: 'fa-tags', roles: ['Ketua'] },
  { id: 'us06', label: 'US-06 · Saldo & Riwayat', icon: 'fa-wallet', roles: ['Nasabah', 'Bendahara', 'Ketua'] },
  { id: 'us07', label: 'US-07 · Penarikan', icon: 'fa-money-bill-transfer', roles: ['Bendahara', 'Ketua'] },
  { id: 'us08', label: 'US-08 · Stok Gudang', icon: 'fa-warehouse', roles: ['Ketua'] },
  { id: 'us09', label: 'US-09 · Penimbangan Ulang', icon: 'fa-weight-scale', roles: ['Petugas Timbang', 'Ketua'] },
  { id: 'us10', label: 'US-10 · Penjualan Pengepul', icon: 'fa-truck-ramp-box', roles: ['Ketua'] },
  { id: 'us11', label: 'US-11 · Kas Operasional', icon: 'fa-cash-register', roles: ['Bendahara', 'Ketua'] },
  { id: 'us12', label: 'US-12 · Koreksi Transaksi', icon: 'fa-pen-to-square', roles: ['Ketua'] },
  { id: 'us13', label: 'US-13 · Laporan', icon: 'fa-file-chart-column', roles: ['Ketua'] },
]

const PAGES = {
  dashboard: Dashboard, us03: US03Peran, us04: Setoran, us05: Harga, us06: Saldo,
  us07: Penarikan, us08: Stok, us09: Penimbangan, us10: Penjualan,
  us11: Kas, us12: Koreksi, us13: Laporan,
}
const META = {
  dashboard: ['Dashboard', 'Ringkasan Pengawasan — Ketua'],
  us03: ['US-03 · Ketua', 'Penetapan Peran Pengurus'], us04: ['US-04 · Petugas Timbang', 'Mencatat Setoran Sampah'],
  us05: ['US-05 · Ketua', 'Mengatur Harga Sampah'], us06: ['US-06 · Nasabah', 'Memeriksa Saldo dan Riwayat'],
  us07: ['US-07 · Bendahara', 'Mencatat Penarikan Tabungan'], us08: ['US-08 · Ketua', 'Melihat Stok Sampah'],
  us09: ['US-09 · Petugas Timbang', 'Penimbangan Ulang & Penyusutan'], us10: ['US-10 · Ketua', 'Mencatat Penjualan kepada Pengepul'],
  us11: ['US-11 · Bendahara', 'Mencatat Kas Operasional'], us12: ['US-12 · Ketua', 'Mengoreksi Transaksi'],
  us13: ['US-13 · Ketua', 'Melihat Laporan'],
}

export default function App() {
  const [me, setMe] = useState(undefined) // undefined=memuat, null=belum login
  const [tab, setTab] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  const loadMe = useCallback(async () => {
    if (!getToken()) { setMe(null); return }
    try { setMe(await api('/auth/me')) } catch { setToken(null); setMe(null) }
  }, [])
  useEffect(() => { loadMe() }, [loadMe])

  if (me === undefined) return <div className="h-screen flex items-center justify-center text-slate-500">Memuat…</div>
  if (me === null) return <Login onOk={loadMe} />

  const peran = me.pengguna.peran
  const nav = NAV.filter(n => n.roles.includes(peran))
  const defaultTab = peran === 'Ketua' ? 'dashboard' : nav[0]?.id || 'us06'
  const activeTab = nav.some(n => n.id === tab) ? tab : defaultTab
  const Page = PAGES[activeTab]
  const meta = META[activeTab]

  return (
    <AuthCtx.Provider value={{ me, reload: loadMe }}>
      <div className="bg-slate-100/70 text-slate-800 flex h-screen overflow-hidden antialiased">
        {/* SIDEBAR */}
        <aside className={`w-64 bg-slate-950 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 z-30 h-full transition-transform duration-200 ${menuOpen ? 'block' : 'hidden lg:flex'} lg:static fixed inset-y-0 left-0`}>
          <div className="flex flex-col min-h-0 h-full">
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-recycle text-lg"></i></div>
                <div><h1 className="font-extrabold text-white text-sm">Bank Sampah</h1><p className="text-[10px] text-slate-400">SIM · Kelurahan Airmadidi</p></div>
              </div>
              <button className="lg:hidden text-slate-400 hover:text-white p-2" onClick={() => setMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-[9px] text-amber-300"><strong>DATA DUMMY.</strong> Data tersimpan di basis data aplikasi; ini bukan produksi multi-user.</div>
            <nav className="px-3 py-3 space-y-1 overflow-y-auto text-xs font-medium flex-1 scrollbar-thin">
              {nav.map(n => (
                <button key={n.id} className={`nav-item ${activeTab === n.id ? 'active' : ''}`} onClick={() => { setTab(n.id); setMenuOpen(false) }}>
                  <i className={`fa-solid ${n.icon} w-5 text-emerald-400`}></i><span>{n.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="p-4 border-t border-slate-800/90 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white text-xs">{me.pengguna.nama_lengkap.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
              <div><div className="text-[11px] font-bold text-white leading-tight">{me.pengguna.nama_lengkap}</div><div className="text-[9px] text-emerald-400">{peran}</div></div>
            </div>
            <button title="Keluar" onClick={() => { setToken(null); setMe(null) }} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800"><i className="fa-solid fa-right-from-bracket text-xs"></i></button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
          <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <button className="lg:hidden text-slate-600 hover:text-slate-900 p-2 -ml-2" onClick={() => setMenuOpen(true)}><i className="fa-solid fa-bars text-lg"></i></button>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">{meta[0]}</span>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">{meta[1]}</h2>
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200 text-[10px] font-bold text-amber-800"><i className="fa-solid fa-flask"></i> DATA DUMMY</span>
          </header>
          <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6"><Page /></div>
          <footer className="border-t border-slate-200 bg-white/80 px-4 py-2 text-center text-[10px] text-slate-400">Bank Sampah Lestari · Tahap 5 Implementasi · Seluruh data <strong>DATA DUMMY</strong></footer>
        </main>
      </div>
    </AuthCtx.Provider>
  )
}
