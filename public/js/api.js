/* ═══════════════════════════════════════════
   KAFE ANCESTRAL — API Layer  (v1.1 corregido)
   FIXES:
   1. Auth.isLogged() ya no retorna siempre true
   2. Auth.getToken() sin fallback inseguro a token-demo
   3. req() expuesto como window.req para que doLogout funcione en admin/cliente
   4. En 401 redirige a login (no silenciosamente a token-demo)
   5. Auth.user() alias añadido para compatibilidad legacy
═══════════════════════════════════════════ */
const API_URL = `${window.location.origin}/api`;

const Auth = {
  getToken : ()     => localStorage.getItem('kafe_token'),
  getUser  : ()     => { try { return JSON.parse(localStorage.getItem('kafe_user') || 'null'); } catch { return null; } },
  user     : ()     => Auth.getUser(),
  save     : (t, u) => { localStorage.setItem('kafe_token', t); localStorage.setItem('kafe_user', JSON.stringify(u)); },
  clear    : ()     => { localStorage.removeItem('kafe_token'); localStorage.removeItem('kafe_user'); localStorage.removeItem('kafe_role'); },
  isLogged : ()     => !!localStorage.getItem('kafe_token'),
  isAdmin  : ()     => { const u = Auth.getUser(); return u?.idRol === 1 || u?.IDRol === 1; },
};

async function req(path, opts = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(API_URL + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      Auth.clear();
      window.location.href = 'index.html';
      return;
    }
    let errorMsg = data.mensaje || data.message || `Error ${res.status}`;
    if (data.errores && Array.isArray(data.errores)) {
      const detalles = data.errores.map(e => `${e.campo || e.path}: ${e.mensaje || e.msg}`).join('\n');
      errorMsg = `${errorMsg}\n${detalles}`;
    }
    throw new Error(errorMsg);
  }

  return data;
}
window.req = req;

const AuthAPI = {
  login    : (email, password) => req('/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
  registro : (body)            => req('/auth/registro', { method: 'POST', body: JSON.stringify(body) }),
  logout   : ()                => req('/auth/logout',   { method: 'POST' }),
};

const ReservasAPI = {
  disponibilidad : ()      => req('/reservas/disponibilidad'),
  listar         : ()      => req('/reservas?limit=500&page=1'),
  misReservas    : ()      => req('/reservas/mis-reservas'),
  una            : (id)    => req(`/reservas/${id}`),
  crear          : (body)  => req('/reservas',       { method: 'POST',   body: JSON.stringify(body) }),
  actualizar     : (id, b) => req(`/reservas/${id}`, { method: 'PUT',    body: JSON.stringify(b) }),
  eliminar       : (id)    => req(`/reservas/${id}`, { method: 'DELETE' }),
};

const BloqueosAPI = {
  listar   : ()     => req('/reservas/bloquear'),
  crear    : (body) => req('/reservas/bloquear',       { method: 'POST',   body: JSON.stringify(body) }),
  eliminar : (id)   => req(`/reservas/bloquear/${id}`, { method: 'DELETE' }),
};

const CabanasAPI = {
  listar    : ()      => req('/cabanas'),
  una       : (id)    => req(`/cabanas/${id}`),
  crear     : (body)  => req('/cabanas',       { method: 'POST', body: JSON.stringify(body) }),
  actualizar: (id, b) => req(`/cabanas/${id}`, { method: 'PUT',  body: JSON.stringify(b) }),
  eliminar  : (id)    => req(`/cabanas/${id}`, { method: 'DELETE' }),
};

const PaquetesAPI = {
  listar : ()    => req('/paquetes'),
  uno    : (id)  => req(`/paquetes/${id}`),
};

/* ── Usuarios (admin) ───────────────────────────── */
const UsuariosAPI = {
  buscar   : (email)  => req(`/usuarios/buscar?email=${encodeURIComponent(email)}`),
  listar   : ()       => req('/usuarios'),
  cambiarRol: (id, rol) => req(`/usuarios/${id}/rol`, { method: 'PUT', body: JSON.stringify({ rol }) }),
  eliminar : (id)     => req(`/usuarios/${id}`, { method: 'DELETE' }),
  reset    : (id)     => req(`/usuarios/${id}/reset`, { method: 'POST' }),
};
