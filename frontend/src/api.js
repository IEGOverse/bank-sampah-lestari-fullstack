/* Wrapper fetch ke backend dengan token JWT (localStorage 'bsl_token'). */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function token() {
  return localStorage.getItem('bsl_token');
}

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const t = token();
  if (t) headers.Authorization = 'Bearer ' + t;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const message = (body && (body.message || body.error)) || ('HTTP ' + res.status);
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const getToken = token;
export const setToken = (t) => t ? localStorage.setItem('bsl_token', t) : localStorage.removeItem('bsl_token');
export const API = API_BASE;
