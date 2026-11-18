/* US-03 — Penetapan peran pengurus (Ketua) */
import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

export default function US03Peran() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try { setErr(''); setRows(await api('/pengguna')) } catch (e) { setErr(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const tetapkan = async (id, peranBaru, username) => {
    try { await api(`/pengguna/${id}/peran`, { method: 'PATCH', body: JSON.stringify({ peran: peranBaru }) }); setMsg(`Peran ${username} → ${peranBaru}`); load() }
    catch (e) { setErr(e.message) }
  }
  const toggleStatus = async (p) => {
    try { await api(`/pengguna/${p.id_pengguna}/status`, { method: 'PATCH', body: JSON.stringify({ status: !p.status }) }); setMsg(`Status ${p.username} diperbarui`); load() }
    catch (e) { setErr(e.message) }
  }
  const saveBuku = async (noRek, buku, username) => {
    try { await api(`/nasabah/${noRek}/no-buku-tabungan`, { method: 'PATCH', body: JSON.stringify({ no_buku_tabungan: buku }) }); setMsg(`Buku tabungan ${username} diperbarui`); load() }
    catch (e) { setErr(e.message) }
  }

  const peranOpts = ['Nasabah', 'Ketua', 'Petugas Timbang', 'Bendahara', 'Admin']
  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b pb-4 mb-5 flex-wrap">
        <div><div className="flex items-center gap-2 flex-wrap"><span className="us-chip">US-03</span><span className="actor-badge actor-ketua">Aktor: Admin / Ketua</span><span className="dummy-badge">Data Dummy</span></div>
          <h3 className="text-lg font-black text-slate-800 mt-2">Penetapan Peran Pengurus</h3>
          <p className="text-[11px] text-slate-500">Setiap perubahan peran tercatat di audit log.</p></div>
        <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg"><i className="fa-solid fa-user-shield"></i></div>
      </div>
      {msg && <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {err && <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="tbl">
          <thead><tr><th>Nama</th><th>Username</th><th>No. Rekening</th><th>No. Buku</th><th>Peran</th><th>Tetapkan</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id_pengguna}>
                <td className="font-bold">{p.nama_lengkap}</td>
                <td className="font-mono">{p.username}</td>
                <td className="font-mono">{p.no_rekening || '—'}</td>
                <td className="font-mono">
                  {p.peran === 'Nasabah' || p.no_rekening ? (
                    <input className="input !py-1.5 !text-xs font-mono w-32" defaultValue={p.no_buku_tabungan || ''} placeholder="belum dicatat" onBlur={e => saveBuku(p.no_rekening, e.target.value, p.username)} aria-label="No. buku tabungan" />
                  ) : '—'}
                </td>
                <td><span className="pill pill-ok">{p.peran}</span></td>
                <td>
                  <select className="input !py-1.5 !text-xs" defaultValue={p.peran} onChange={e => tetapkan(p.id_pengguna, e.target.value, p.username)}>
                    {peranOpts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <button className={`pill ${p.status ? 'pill-ok' : 'pill-red'}`} onClick={() => toggleStatus(p)}>{p.status ? 'Aktif' : 'Nonaktif'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
