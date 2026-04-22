/* ═══════════════════════════════════════════
   KAFE ANCESTRAL — API Layer
═══════════════════════════════════════════ */
const API_URL = `${window.location.origin}/api`;

const Auth = {
  getToken : ()      => localStorage.getItem('kafe_token') || 'token-cliente-demo',
  getUser  : ()      => JSON.parse(localStorage.getItem('kafe_user') || 'null'),
  save     : (t, u)  => { localStorage.setItem('kafe_token', t); localStorage.setItem('kafe_user', JSON.stringify(u)); },
  clear    : ()      => { localStorage.removeItem('kafe_token'); localStorage.removeItem('kafe_user'); },
  isLogged : ()      => true, // Siempre logged para demo
  isAdmin  : ()      => localStorage.getItem('kafe_role') === 'admin',
};

async function req(path, opts = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(API_URL + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token !== 'token-demo') {
      Auth.clear();
      localStorage.setItem('kafe_token', 'token-demo');
      return req(path, opts);
    }
    // Construir mensaje detallado con errores de validación si existen
    let errorMsg = data.mensaje || data.message || `Error ${res.status}`;
    if (data.errores && Array.isArray(data.errores)) {
      const detalles = data.errores.map(e => `${e.campo}: ${e.mensaje}`).join('\n');
      errorMsg = `${errorMsg}\n${detalles}`;
    }
    throw new Error(errorMsg);
  }

  return data;
}

/* ── Auth endpoints ─────────────────────── */
const AuthAPI = {
  login    : (email, password) => req('/auth/login',    { method:'POST', body: JSON.stringify({ email, password }) }),
  registro : (body)            => req('/auth/registro', { method:'POST', body: JSON.stringify(body) }),
};

/* ── Reservas ───────────────────────────── */
const ReservasAPI = {
  disponibilidad : ()     => req('/reservas/disponibilidad'),
  listar         : ()     => req('/reservas'),
  misReservas    : ()     => req('/reservas/mis-reservas'),
  una            : (id)   => req(`/reservas/${id}`),
  crear          : (body) => req('/reservas',       { method:'POST',   body: JSON.stringify(body) }),
  actualizar     : (id,b) => req(`/reservas/${id}`, { method:'PUT',    body: JSON.stringify(b) }),
  eliminar       : (id)   => req(`/reservas/${id}`, { method:'DELETE' }),
};

/* ── Bloqueos ───────────────────────────── */
const BloqueosAPI = {
  listar   : ()     => req('/reservas/bloquear'),
  crear    : (body) => req('/reservas/bloquear',      { method:'POST',   body: JSON.stringify(body) }),
  eliminar : (id)   => req(`/reservas/bloquear/${id}`, { method:'DELETE' }),
};

/* ── Cabañas (cuando estén implementadas) ─ */
const CabanasAPI = {
  listar   : ()     => req('/cabanas'),
  una      : (id)   => req(`/cabanas/${id}`),
  crear    : (body) => req('/cabanas',       { method:'POST',   body: JSON.stringify(body) }),
  actualizar:(id,b) => req(`/cabanas/${id}`, { method:'PUT',    body: JSON.stringify(b) }),
  eliminar : (id)   => req(`/cabanas/${id}`, { method:'DELETE' }),
};

/* ── Paquetes ───────────────────────────── */
const PaquetesAPI = {
  listar   : ()     => req('/paquetes'),
  uno      : (id)   => req(`/paquetes/${id}`),
};
