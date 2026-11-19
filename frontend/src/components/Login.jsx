/* Login (US-02) + tab Registrasi mandiri nasabah (US-01) */
import { useState } from 'react'
import { api, setToken } from '../api'

export default function Login({ onOk }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '' })
  const [reg, setReg] = useState({ nama_lengkap: '', no_hp: '', alamat: '', username: '', password: '', password2: '' })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const submitLogin = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      setToken(r.token)
      await onOk()
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  const submitRegister = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true)
    try {
      if (reg.password !== reg.password2) throw new Error('Password tidak sama.')
      await api('/auth/register', { method: 'POST', body: JSON.stringify({ nama_lengkap: reg.nama_lengkap, no_hp: reg.no_hp, alamat: reg.alamat, username: reg.username, password: reg.password }) })
      setMsg('Registrasi berhasil! Silakan login.')
      setTab('login'); setForm({ username: reg.username, password: '' })
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }

  const demo = [
    ['admin', 'Admin'], ['ketua', 'Ketua'], ['petugas', 'Petugas Timbang'], ['petugas2', 'Petugas Timbang 2'], ['bendahara', 'Bendahara'],
    ['nasabah', 'Nasabah (BS-0000001)'], ['nasabah2', 'Nasabah (BS-0000002)'], ['nasabah3', 'Nasabah (BS-0000003)'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex bg-[#f2faf5]">
      {/* Brand panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#0c3a2d] via-[#114534] to-[#081f17] text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -right-16 -bottom-20 text-[300px] opacity-10"><i className="fa-solid fa-recycle"></i></div>
        <div className="relative">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 via-emerald-600 to-emerald-800 ring-1 ring-emerald-300/40 flex items-center justify-center shadow-lg"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4.5 12.6C4.5 8.36 8.02 4.6 20 4.5c-.1 11.98-3.86 15.5-8.1 15.5-2.6 0-4.94-.86-6.75-2.67-.63-.63.8-2.17 1.32-2.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.7 11.9c1.05-1.1 3-1.75 6.8-1.65" stroke="#d9fbe6" stroke-width="1.4" stroke-linecap="round"/></svg></div>
            <div><h1 className="text-xl font-black">Bank Sampah Lestari</h1><p className="text-emerald-300 text-xs">SIM · Kelurahan Airmadidi</p></div>
          </div>
          <h2 className="text-4xl font-black leading-tight mt-14">Sampah bernilai,<br/>tabungan bertumbuh.</h2>
          <p className="text-emerald-100/90 text-sm mt-4 max-w-md">Setoran Sabtu pagi · 90% tabungan, 10% kas operasional · harga ditetapkan Ketua tiap awal bulan.</p>
        </div>
        <p className="relative text-[11px] text-emerald-200/70">TAHAP 5 — IMPLEMENTASI · Data contoh = DATA DUMMY</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex bg-white rounded-2xl shadow-soft border border-emerald-100 p-1.5 mb-5">
            <button className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition ${tab === 'login' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500'}`} onClick={() => { setTab('login'); setErr(''); setMsg('') }}>Masuk</button>
            <button className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition ${tab === 'register' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500'}`} onClick={() => { setTab('register'); setErr(''); setMsg('') }}>Daftar</button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={submitLogin} className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div><h3 className="text-lg font-black text-slate-800 mt-2">Login Pengguna</h3><p className="text-[11px] text-slate-500">Hak akses menyesuaikan peran akun.</p></div>
              <div><label className="lbl" htmlFor="u">Username</label><input id="u" className="input" required autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
              <div><label className="lbl" htmlFor="p">Password</label><input id="p" type="password" className="input" required autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{msg}</p>}
              {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center !py-3">{loading ? 'Memproses…' : 'Masuk'}</button>
              <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="font-extrabold text-slate-600 mb-1.5"><span className="dummy-badge">Data Dummy</span> Akun uji (klik untuk isi)</p>
                <table className="w-full text-[10px]"><tbody>{demo.map(([u, r]) => <tr key={u} className="border-b border-slate-200 last:border-0"><td className="py-1 font-mono cursor-pointer text-emerald-700" onClick={() => setForm({ username: u, password: u + '123' })}>{u}</td><td className="py-1">{r}</td><td className="py-1 text-right text-slate-400">pw: {u}123</td></tr>)}</tbody></table>
              </div>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div><h3 className="text-lg font-black text-slate-800 mt-2">Registrasi Akun Nasabah</h3><p className="text-[11px] text-slate-500">Akun otomatis berperan <strong>Nasabah</strong>. Peran pengurus ditetapkan Admin/Ketua (US-03).</p></div>
              <div><label className="lbl" htmlFor="rn">Nama Lengkap *</label><input id="rn" className="input" required value={reg.nama_lengkap} onChange={e => setReg({ ...reg, nama_lengkap: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl" htmlFor="hp">Nomor HP *</label><input id="hp" className="input" required value={reg.no_hp} onChange={e => setReg({ ...reg, no_hp: e.target.value })} /></div>
                <div><label className="lbl" htmlFor="ru">Username *</label><input id="ru" className="input" required minLength={3} value={reg.username} onChange={e => setReg({ ...reg, username: e.target.value })} /></div>
              </div>
              <div><label className="lbl" htmlFor="al">Alamat *</label><input id="al" className="input" required value={reg.alamat} onChange={e => setReg({ ...reg, alamat: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl" htmlFor="rp">Password *</label><input id="rp" type="password" className="input" required minLength={4} value={reg.password} onChange={e => setReg({ ...reg, password: e.target.value })} /></div>
                <div><label className="lbl" htmlFor="rp2">Ulangi *</label><input id="rp2" type="password" className="input" required minLength={4} value={reg.password2} onChange={e => setReg({ ...reg, password2: e.target.value })} /></div>
              </div>
              {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center !py-3">{loading ? 'Memproses…' : 'Daftar Sekarang'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
