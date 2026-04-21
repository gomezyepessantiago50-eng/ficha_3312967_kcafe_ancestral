const CRUMBS = { dashboard:'Dashboard', reservas:'Reservas', calendario:'Calendario', clientes:'Clientes', bloqueos:'Bloquear Fechas', cabanas:'Cabañas', paquetes:'Paquetes' };
let _editId = null, _delId = null, _viewId = null, _viewReservaData = null;

// Estado de paginación para reservas
let _reservasPaginacion = {
  currentPage: 1,
  totalPages: 1,
  total: 0,
  limit: 5
};

// Constantes para paquetes y servicios
const CABANAS = {
  roble: { label:'El Roble', precio:280000, descripcion:'Chimenea · Vista bosque', capacidad:2 },
  ceiba: { label:'La Ceiba', precio:420000, descripcion:'Hamacas · Jardín privado', capacidad:4 },
  ancestral: { label:'Ancestral', precio:650000, descripcion:'Vista panorámica · Artesanal', capacidad:6 },
};

const PAQUETES = {
  basico: { label:'Básico', precio:0, descripcion:'Alojamiento en cabaña sin servicios adicionales' },
  cafetero: { label:'Cafetero', precio:80000, descripcion:'Incluye tour guiado por café y desayuno típico' },
  premium: { label:'Premium', precio:200000, descripcion:'Incluye tour, spa, gastronomía y fogata' },
};

const SERVICIOS = {
  spa: { label:'Spa', precio:90000 },
  fogata: { label:'Fogata', precio:45000 },
  transporte: { label:'Transporte', precio:60000 },
  fotografia: { label:'Fotografía', precio:120000 },
};

// Estado de la nueva reserva del admin
const ADMIN_NUEVA_RES = {
  cabana: 'roble',
  fechaInicio: '',
  fechaFin: '',
  personas: 2,
  documento: '',
  paquete: 'basico',
  servicios: new Set([]),
};

if (typeof _cals !== 'undefined') {
  _cals['dash-cal'] = { y: new Date().getFullYear(), m: new Date().getMonth() };
  _cals['admin-cal'] = { y: new Date().getFullYear(), m: new Date().getMonth() };
}

document.addEventListener('DOMContentLoaded', () => {
  let role = localStorage.getItem('kafe_role');
  if (!role) {
    localStorage.setItem('kafe_role', 'admin');
    role = 'admin';
  }
  if (role !== 'admin') { window.location.href = 'index.html'; return; }
  if (!localStorage.getItem('kafe_token') || localStorage.getItem('kafe_token') !== 'token-demo') {
    localStorage.setItem('kafe_token', 'token-demo');
  }
  if (!localStorage.getItem('kafe_user')) {
    localStorage.setItem('kafe_user', JSON.stringify({ nombre: 'Admin Demo', rol: 'admin' }));
  }
  document.getElementById('admin-username').textContent = 'Admin Demo';
  loadDashboard();
  refreshDashCal();
  loadReservas();
  setInterval(() => {
    const cl = document.getElementById('footer-clock');
    if (cl) cl.textContent = new Date().toLocaleString('es-CO');
  }, 1000);
});

function showSec(name, btn) {
  document.querySelectorAll('.a-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-'+name)?.classList.add('active');
  btn.classList.add('active');
  document.getElementById('topbar-crumb').textContent = CRUMBS[name] || name;
  if (name === 'reservas')   loadReservas(1);
  if (name === 'bloqueos')   loadBloqueos();
  if (name === 'calendario') refreshAdminCal();
}

async function fetchAvail() {
  try { return await ReservasAPI.disponibilidad(); } catch { return { reservadas:[], bloqueadas:[] }; }
}
async function refreshDashCal() {
  const s = _cals['dash-cal']; if(!s) return;
  const d = await fetchAvail();
  buildCal('dash-cal', s.y, s.m, d.reservadas||[], d.bloqueadas||[]);
}
async function refreshAdminCal() {
  const s = _cals['admin-cal']; if(!s) return;
  const d = await fetchAvail();
  buildCal('admin-cal', s.y, s.m, d.reservadas||[], d.bloqueadas||[], 'onCalDayClick');
}
function prevMonth() {
  const s = _cals['admin-cal'];
  s.m--; if(s.m < 0) { s.m = 11; s.y--; }
  refreshAdminCal();
}
function nextMonth() {
  const s = _cals['admin-cal'];
  s.m++; if(s.m > 11) { s.m = 0; s.y++; }
  refreshAdminCal();
}

async function onCalDayClick(ds) {
  document.getElementById('cal-day-title').textContent = 'Reservas — ' + fDate(ds);
  document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Buscando…</p>';
  try {
    const d = await ReservasAPI.listar();
    const rs = (d.reservas||d.data||[]).filter(r => r.fecha_inicio <= ds && r.fecha_fin >= ds);
    document.getElementById('cal-day-body').innerHTML = rs.length
      ? rs.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)}</p></div></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">Sin reservas para este día</p>';
  } catch { document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);">Error al cargar</p>'; }
}

async function loadDashboard() {
  try {
    const [dr, db] = await Promise.allSettled([ReservasAPI.listar(), BloqueosAPI.listar()]);
    const rs = dr.status==='fulfilled' ? (dr.value.reservas||dr.value.data||[]) : [];
    const bl = db.status==='fulfilled' ? (db.value.bloqueos||db.value.data||[]) : [];
    const pend = rs.filter(r=>r.estado==='pendiente').length;
    const conf = rs.filter(r=>r.estado==='confirmada').length;
    document.getElementById('ov-total').textContent = rs.length;
    document.getElementById('ov-pend').textContent  = pend;
    document.getElementById('ov-conf').textContent  = conf;
    document.getElementById('ov-bloq').textContent  = bl.length;
    document.getElementById('nb-pend').textContent  = pend;
    const proximas = rs
      .filter(r => new Date(r.fecha_inicio) >= new Date() && r.estado!=='cancelada')
      .sort((a,b) => new Date(a.fecha_inicio)-new Date(b.fecha_inicio))
      .slice(0,5);
    document.getElementById('prox-count').textContent = proximas.length;
    document.getElementById('prox-list').innerHTML = proximas.length
      ? proximas.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${r.num_personas||1} pers.</p></div><div class="r-right" style="font-size:0.78rem;color:var(--dark-muted);">${r.cabana||'—'}</div></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay próximas llegadas</p>';
  } catch {
    ['ov-total','ov-pend','ov-conf','ov-bloq'].forEach(id=>document.getElementById(id).textContent='?');
    document.getElementById('prox-list').innerHTML='<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver datos</p>';
  }
}

async function loadReservas(page = 1) {
  const estado = document.getElementById('fil-estado').value;
  const fecha  = document.getElementById('fil-fecha').value;
  const tbody  = document.getElementById('res-tbody');

  // Construir parámetros de consulta
  const params = new URLSearchParams();
  if (estado) params.append('estado', estado);
  if (fecha) params.append('fechaDesde', fecha);
  params.append('page', page);
  params.append('limit', _reservasPaginacion.limit);

  try {
    const response = await fetch(`/api/reservas?${params}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('kafe_token')}` }
    });
    const d = await response.json();

    if (d.ok) {
      const rs = d.data || [];
      _reservasPaginacion.currentPage = d.currentPage || 1;
      _reservasPaginacion.totalPages = d.totalPages || 1;
      _reservasPaginacion.total = d.total || 0;

      document.getElementById('res-count').textContent = `${_reservasPaginacion.total} resultado(s)`;

      tbody.innerHTML = rs.length
        ? rs.map(r=>{
            const bloqueadoEdicion = ['cancelada', 'completada'].includes(r.estado);
            return `<tr>
              <td style="font-family:var(--font-display);font-weight:800;color:var(--fire);">#${r.id}</td>
              <td style="color:var(--dark-text);">${r.documento||'—'}</td>
              <td>${fDate(r.fecha_inicio)}</td>
              <td>${fDate(r.fecha_fin)}</td>
              <td>${nights(r.fecha_inicio,r.fecha_fin)}</td>
              <td>${r.num_personas||1}</td>
              <td>${r.cabana||'—'}</td>
              <td>${r.paquete||'Básico'}</td>
              <td>${statusBadge(r.estado)}</td>
              <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                  <button class="btn btn-sm btn-outline" onclick="abrirVerReserva(${r.id})">Ver</button>
                  <button class="btn btn-sm btn-outline" ${bloqueadoEdicion ? 'disabled' : `onclick="abrirDetalle(${r.id})"`}>Editar</button>
                  <button class="btn btn-sm btn-dark-outline" onclick="abrirEstado(${r.id},'${r.estado}')">Estado</button>
                </div></td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Sin resultados</td></tr>`;

      // Actualizar controles de paginación
      updatePaginationControls();
    } else {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Error al cargar reservas</td></tr>`;
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Inicia el servidor para ver reservas</td></tr>`;
  }
}

function updatePaginationControls() {
  const paginationContainer = document.getElementById('pagination-controls');
  if (!paginationContainer) return;

  const { currentPage, totalPages } = _reservasPaginacion;

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  paginationContainer.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;padding:1rem;">
      <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''}>
        ← Anterior
      </button>
      <span style="color:var(--dark-muted);font-size:0.85rem;">
        Página ${currentPage} de ${totalPages}
      </span>
      <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''}>
        Siguiente →
      </button>
    </div>
  `;
}

function goToPage(page) {
  if (page < 1 || page > _reservasPaginacion.totalPages) return;
  loadReservas(page);
}
function clearFil() { document.getElementById('fil-estado').value=''; document.getElementById('fil-fecha').value=''; loadReservas(1); }

function verTodasReservas() { document.getElementById('fil-estado').value=''; document.getElementById('fil-fecha').value=''; loadReservas(1); }

function abrirEstado(id, curr) { _editId=id; document.getElementById('m-est-id').textContent=id; document.getElementById('m-est-val').value=curr; openM('m-estado'); }
async function guardarEstado() {
  try {
    await ReservasAPI.actualizar(_editId, { estado: document.getElementById('m-est-val').value });
    closeM('m-estado'); toast('Estado actualizado','ok'); loadReservas(1); loadDashboard();
  } catch(e) { toast(e.message,'err'); }
}

async function abrirDetalle(id) {
  _viewId = id;
  document.getElementById('m-det-id').textContent = id;
  document.getElementById('m-det-alert').innerHTML = '';
  try {
    const response = await ReservasAPI.una(id);
    const reserva = response.data || response;
    if (['cancelada', 'completada'].includes(reserva.estado)) {
      toast('No se puede editar una reserva cancelada o completada', 'err');
      return;
    }
    _viewReservaData = reserva;
    document.getElementById('m-det-doc').value = reserva.documento || reserva.NroDocumentoCliente || '';
    document.getElementById('m-det-cabana').value = reserva.cabana || 'roble';
    document.getElementById('m-det-ini').value = reserva.fecha_inicio || '';
    document.getElementById('m-det-fin').value = reserva.fecha_fin || '';
    document.getElementById('m-det-paquete').value = reserva.paquete || 'basico';
    document.getElementById('m-det-personas').value = reserva.num_personas || 1;
    document.getElementById('m-det-notas').value = reserva.notas || '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('m-det-ini').setAttribute('min', tomorrowStr);

    if (reserva.fecha_inicio) {
      const fechaInicio = new Date(reserva.fecha_inicio);
      const minStart = fechaInicio < tomorrow ? tomorrow : fechaInicio;
      const minFinDate = new Date(minStart);
      minFinDate.setDate(minFinDate.getDate() + 1);
      document.getElementById('m-det-fin').setAttribute('min', minFinDate.toISOString().split('T')[0]);
    }
    openM('m-detalle-admin');
  } catch (err) {
    toast(err.message || 'No se pudo cargar la reserva', 'err');
  }
}

async function abrirVerReserva(id) {
  try {
    const response = await ReservasAPI.una(id);
    const reserva = response.data || response;
    const servicios = Array.isArray(reserva.servicios)
      ? reserva.servicios.map(key => SERVICIOS[key]?.label || key).filter(Boolean).join(', ')
      : '';
    document.getElementById('m-view-id').textContent = id;
    document.getElementById('m-view-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div><strong>Cliente</strong><p>${reserva.documento || '—'}</p></div>
        <div><strong>Estado</strong><p>${statusBadge(reserva.estado)}</p></div>
        <div><strong>Cabaña</strong><p>${reserva.cabana || '—'}</p></div>
        <div><strong>Paquete</strong><p>${reserva.paquete || 'Básico'}</p></div>
        <div><strong>Fecha inicio</strong><p>${fDate(reserva.fecha_inicio)}</p></div>
        <div><strong>Fecha fin</strong><p>${fDate(reserva.fecha_fin)}</p></div>
        <div><strong>Noches</strong><p>${nights(reserva.fecha_inicio, reserva.fecha_fin)}</p></div>
        <div><strong>Personas</strong><p>${reserva.num_personas || 1}</p></div>
        <div><strong>Servicios</strong><p>${servicios || 'Ninguno'}</p></div>
        <div><strong>Método de pago</strong><p>${reserva.metodo_pago || '—'}</p></div>
        <div><strong>Fecha reserva</strong><p>${fDate(reserva.fecha_reserva)}</p></div>
        <div><strong>Usuario</strong><p>${reserva.usuario_id || '—'}</p></div>
      </div>
      <div style="margin-top:1rem;padding:1rem;background:rgba(255,255,255,0.05);border-radius:var(--r-lg);">
        <h4 style="margin:0 0 0.75rem;">Resumen de costos</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;line-height:1.5;">
          <div><strong>Subtotal</strong><p>${fCop(reserva.subtotal ?? reserva.SubTotal ?? 0)}</p></div>
          <div><strong>Descuento</strong><p>${fCop(reserva.descuento ?? reserva.Descuento ?? 0)}</p></div>
          <div><strong>IVA</strong><p>${fCop(reserva.iva ?? reserva.IVA ?? 0)}</p></div>
          <div><strong>Total</strong><p style="font-weight:700;color:var(--fire);">${fCop(reserva.monto_total ?? reserva.MontoTotal ?? 0)}</p></div>
        </div>
      </div>
      <div style="margin-top:1rem;">
        <strong>Notas</strong>
        <p style="white-space:pre-wrap;color:var(--dark-muted);margin-top:0.35rem;">${reserva.notas || 'Sin notas'}</p>
      </div>
      <div style="margin-top:1rem;">
        <strong>Motivo</strong>
        <p style="white-space:pre-wrap;color:var(--dark-muted);margin-top:0.35rem;">${reserva.motivo || 'Sin motivo'}</p>
      </div>
    `;
    openM('m-view-reserva');
  } catch (err) {
    toast(err.message || 'No se pudo cargar la reserva', 'err');
  }
}

function mDetRangeCheck() {
  const iniEl = document.getElementById('m-det-ini');
  const finEl = document.getElementById('m-det-fin');
  const ini = iniEl.value;
  const fin = finEl.value;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (ini && ini < tomorrowStr) {
    iniEl.value = '';
    finEl.value = '';
    finEl.setAttribute('min', tomorrowStr);
    return;
  }

  if (ini && fin && new Date(fin) <= new Date(ini)) {
    finEl.value = '';
  }

  if (ini) {
    const minFinDate = new Date(ini);
    minFinDate.setDate(minFinDate.getDate() + 1);
    finEl.setAttribute('min', minFinDate.toISOString().split('T')[0]);
  }
}

async function guardarDetalleReserva() {
  if (!_viewId) return;
  const fechaInicio = document.getElementById('m-det-ini').value;
  const fechaFin = document.getElementById('m-det-fin').value;
  const cabana = document.getElementById('m-det-cabana').value;
  const paquete = document.getElementById('m-det-paquete').value;
  const personas = Number(document.getElementById('m-det-personas').value) || 1;
  const notas = document.getElementById('m-det-notas').value.trim();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minStart = new Date(today);
  minStart.setDate(minStart.getDate() + 1);
  const minStartStr = minStart.toISOString().split('T')[0];

  if (!fechaInicio || !fechaFin) {
    document.getElementById('m-det-alert').innerHTML = `<div class="alert alert-error">⚠ Debes seleccionar fechas válidas.</div>`;
    return;
  }
  if (fechaInicio < minStartStr) {
    document.getElementById('m-det-alert').innerHTML = `<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de ${minStartStr}.</div>`;
    return;
  }
  if (new Date(fechaFin) <= new Date(fechaInicio)) {
    document.getElementById('m-det-alert').innerHTML = `<div class="alert alert-error">⚠ La fecha de fin debe ser posterior a la fecha de inicio.</div>`;
    return;
  }

  const servicios = _viewReservaData?.servicios || [];
  const cabanaData = CABANAS[cabana] || CABANAS.roble;
  const paqueteData = PAQUETES[paquete] || PAQUETES.basico;
  const serviciosPrecio = Array.isArray(servicios)
    ? servicios.reduce((sum, key) => sum + (SERVICIOS[key]?.precio || 0), 0)
    : 0;
  const noches = nights(fechaInicio, fechaFin);
  const subtotal = (cabanaData.precio + paqueteData.precio) * Math.max(noches, 1) + serviciosPrecio * personas;
  const iva = Math.round(subtotal * 0.19);
  const montoTotal = subtotal + iva;

  const payload = {
    FechaInicio: fechaInicio,
    FechaFinalizacion: fechaFin,
    cabana,
    paquete,
    num_personas: personas,
    notas,
    servicios,
    SubTotal: subtotal,
    IVA: iva,
    MontoTotal: montoTotal,
  };

  try {
    await ReservasAPI.actualizar(_viewId, payload);
    closeM('m-detalle-admin');
    toast('Reserva actualizada correctamente', 'ok');
    loadReservas(1);
    loadDashboard();
  } catch (err) {
    document.getElementById('m-det-alert').innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}

function abrirDel(id) { _delId=id; document.getElementById('m-del-id').textContent=id; openM('m-del'); }
async function doEliminar() {
  try {
    await ReservasAPI.eliminar(_delId);
    closeM('m-del'); toast('Reserva eliminada','ok'); loadReservas(1); loadDashboard();
  } catch(e) { toast(e.message,'err'); }
}

async function doNuevaAdmin() {
  const ini = document.getElementById('mn-ini').value;
  const fin = document.getElementById('mn-fin').value;
  const cab = document.getElementById('mn-cab').value;
  const doc = document.getElementById('mn-doc').value.trim();
  const personas = CABANAS[cab]?.capacidad || 2;
  
  // Validación detallada de campos requeridos
  if (!doc) { 
    document.getElementById('mn-alert').innerHTML='<div class="alert alert-error">⚠ Debes seleccionar un cliente (campo marcado con *)</div>'; 
    return; 
  }
  if (!ini) { 
    document.getElementById('mn-alert').innerHTML='<div class="alert alert-error">⚠ Debes ingresar la fecha de inicio (campo marcado con *)</div>'; 
    return; 
  }
  if (!fin) { 
    document.getElementById('mn-alert').innerHTML='<div class="alert alert-error">⚠ Debes ingresar la fecha de fin (campo marcado con *)</div>'; 
    return; 
  }

  const [y, m, d] = ini.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0,0,0,0);
  if (startDate <= today) {
    document.getElementById('mn-alert').innerHTML = `<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de mañana.</div>`;
    return;
  }
  
  try {
    const noches = nights(ini, fin);
    const cabanaData = CABANAS[cab];
    const paqueteData = PAQUETES[ADMIN_NUEVA_RES.paquete];
    const serviciosData = Array.from(ADMIN_NUEVA_RES.servicios).map(s => SERVICIOS[s]);
    const serviciosPrecio = serviciosData.reduce((acc, item) => acc + (item?.precio || 0), 0);
    const subtotal = (cabanaData.precio + paqueteData.precio) * Math.max(noches, 1) + serviciosPrecio * personas;
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    await ReservasAPI.crear({
      NroDocumentoCliente: doc,
      FechaInicio: ini,
      FechaFinalizacion: fin,
      SubTotal: subtotal,
      Descuento: 0,
      IVA: iva,
      MontoTotal: total,
      MetodoPago: 1,
      num_personas: personas,
      cabana: cab,
      paquete: ADMIN_NUEVA_RES.paquete,
      servicios: Array.from(ADMIN_NUEVA_RES.servicios),
    });
    
    // Limpiar y cerrar
    closeM('m-nueva');
    toast('Reserva creada','ok');
    adminResetNuevaRES();
    loadReservas(1);
    loadDashboard();
  } catch(e) { 
    document.getElementById('mn-alert').innerHTML=`<div class="alert alert-error">⚠ ${e.message}</div>`; 
  }
}

async function doBloquear() {
  const ini = document.getElementById('b-ini').value;
  const fin = document.getElementById('b-fin').value;
  const alEl = document.getElementById('blq-alert');
  if (!ini||!fin) { alEl.innerHTML='<div class="alert alert-error">⚠ Selecciona las fechas</div>'; return; }
  try {
    await BloqueosAPI.crear({ fecha_inicio:ini, fecha_fin:fin, motivo:document.getElementById('b-motivo').value });
    alEl.innerHTML=''; ['b-ini','b-fin','b-motivo'].forEach(id=>document.getElementById(id).value='');
    toast('Fechas bloqueadas','ok'); loadBloqueos(); refreshAdminCal(); refreshDashCal();
  } catch(e) { alEl.innerHTML=`<div class="alert alert-error">⚠ ${e.message}</div>`; }
}

async function loadBloqueos() {
  const c = document.getElementById('blq-list');
  try {
    const d = await BloqueosAPI.listar();
    const bs = d.bloqueos||d.data||[];
    document.getElementById('ov-bloq').textContent = bs.length;
    c.innerHTML = bs.length
      ? bs.map(b=>`<div class="blq-item"><div class="blq-ico">🔒</div><div class="blq-txt"><h4>${fDate(b.fecha_inicio)} → ${fDate(b.fecha_fin)}</h4><p>${b.motivo||'Sin motivo'}</p></div><button class="btn btn-sm btn-danger" onclick="doDesbloquear(${b.id})">Quitar</button></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay fechas bloqueadas</p>';
  } catch { c.innerHTML='<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver bloqueos</p>'; }
}

async function doDesbloquear(id) {
  try { await BloqueosAPI.eliminar(id); toast('Fecha desbloqueada','ok'); loadBloqueos(); refreshAdminCal(); }
  catch(e) { toast(e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PARA NUEVA RESERVA EN ADMIN
// ═══════════════════════════════════════════════════════════════════════════

async function adminAbrirNuevaReserva() {
  adminResetNuevaRES();
  setMinDateInputs();
  
  // Cargar clientes desde las reservas existentes
  try {
    const d = await ReservasAPI.listar();
    const reservas = d.reservas || d.data || [];
    const clientesUnicos = [...new Set(reservas.map(r => r.documento || r.NroDocumentoCliente).filter(Boolean))];
    
    const selectDoc = document.getElementById('mn-doc');
    selectDoc.innerHTML = '<option value="">— Selecciona un cliente —</option><option value="demo-new">+ Crear nuevo cliente</option>';
    
    clientesUnicos.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc;
      opt.textContent = doc;
      selectDoc.appendChild(opt);
    });
  } catch (err) {
    console.log('No se pudieron cargar clientes:', err.message);
  }
  
  openM('m-nueva');
  adminResumenUpdate();
}

async function modalSearchClientByDoc() {
  const doc = document.getElementById('modal-cli-doc').value.trim();
  const msgEl = document.getElementById('modal-cli-msg');
  const selectEl = document.getElementById('mn-doc');
  
  if (!doc) {
    msgEl.textContent = '⚠ Ingresa un documento para buscar';
    msgEl.style.color = 'var(--fire)';
    return;
  }
  
  try {
    msgEl.textContent = 'Buscando…';
    msgEl.style.color = 'var(--mist)';
    
    const d = await ReservasAPI.listar();
    const reservas = d.reservas || d.data || [];
    
    // Buscar clientes que contengan el documento
    const foundDocs = [...new Set(
      reservas
        .map(r => r.documento || r.NroDocumentoCliente)
        .filter(docVal => docVal && docVal.toLowerCase().includes(doc.toLowerCase()))
    )];
    
    if (foundDocs.length === 0) {
      msgEl.textContent = '✕ No se encontraron clientes con ese documento';
      msgEl.style.color = 'var(--fire)';
      selectEl.innerHTML = `
        <option value="">— No se encontraron resultados —</option>
        <option value="demo-new">+ Crear nuevo cliente</option>
      `;
      return;
    }
    
    // Actualizar el select con los clientes encontrados
    selectEl.innerHTML = `<option value="">— Selecciona un cliente de los resultados —</option>`;
    
    foundDocs.forEach(clientDoc => {
      const opt = document.createElement('option');
      opt.value = clientDoc;
      opt.textContent = clientDoc;
      selectEl.appendChild(opt);
    });
    
    // Agregar opción de crear nuevo
    const newOpt = document.createElement('option');
    newOpt.value = 'demo-new';
    newOpt.textContent = '+ Crear nuevo cliente';
    selectEl.appendChild(newOpt);
    
    msgEl.textContent = `✓ Se encontraron ${foundDocs.length} cliente(s)`;
    msgEl.style.color = '#4caf50';
  } catch (err) {
    msgEl.textContent = `⚠ Error: ${err.message}`;
    msgEl.style.color = 'var(--fire)';
  }
}


function adminSelectPaquete(key) {
  ADMIN_NUEVA_RES.paquete = key;
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn => {
    btn.classList.toggle('selected', btn.id === `adm-p-${key}`);
  });
  adminResumenUpdate();
}

function adminToggleSrv(key) {
  if (ADMIN_NUEVA_RES.servicios.has(key)) {
    ADMIN_NUEVA_RES.servicios.delete(key);
  } else {
    ADMIN_NUEVA_RES.servicios.add(key);
  }
  document.getElementById(`adm-srv-${key}`).classList.toggle('selected', ADMIN_NUEVA_RES.servicios.has(key));
  adminResumenUpdate();
}

function adminCabanaChange() {
  ADMIN_NUEVA_RES.cabana = document.getElementById('mn-cab').value;
  adminResumenUpdate();
}

function adminResumenUpdate() {
  const ini = document.getElementById('mn-ini').value;
  const fin = document.getElementById('mn-fin').value;
  
  // Validar que fin sea después de inicio
  if (ini && fin && new Date(fin) <= new Date(ini)) {
    document.getElementById('mn-fin').value = '';
    const finEl = document.getElementById('mn-fin');
    if (finEl) {
      const minFinDate = new Date(ini);
      minFinDate.setDate(minFinDate.getDate() + 1);
      finEl.setAttribute('min', minFinDate.toISOString().split('T')[0]);
    }
  } else if (ini) {
    const finEl = document.getElementById('mn-fin');
    if (finEl) {
      const minFinDate = new Date(ini);
      minFinDate.setDate(minFinDate.getDate() + 1);
      finEl.setAttribute('min', minFinDate.toISOString().split('T')[0]);
    }
  }
  
  const personas = CABANAS[ADMIN_NUEVA_RES.cabana]?.capacidad || 2;
  const noches = nights(ini, fin);
  const cab = CABANAS[ADMIN_NUEVA_RES.cabana] || CABANAS.roble;
  const paquete = PAQUETES[ADMIN_NUEVA_RES.paquete] || PAQUETES.basico;
  const servicios = Array.from(ADMIN_NUEVA_RES.servicios)
    .map(s => SERVICIOS[s])
    .filter(Boolean);
  const serviciosPrecio = servicios.reduce((acc, item) => acc + item.precio, 0);
  const subtotal = (cab.precio + paquete.precio) * Math.max(noches, 1) + serviciosPrecio * personas;
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const valido = ini && fin && new Date(fin) > new Date(ini);

  const body = document.getElementById('admin-price-body');
  const totalRow = document.getElementById('admin-price-total');

  if (!valido) {
    body.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;font-size:0.85rem;">Selecciona fechas válidas</p>';
    if (totalRow) totalRow.style.display = 'none';
    return;
  }

  body.innerHTML = `
    <div class="price-row" style="color:#3f3f3f;border-bottom:1px solid rgba(46,26,14,0.12);">
      <span class="pk">Cabaña</span>
      <span class="pv">${cab.label} x ${noches} noche(s)</span>
    </div>
    <div class="price-row" style="color:#3f3f3f;border-bottom:1px solid rgba(46,26,14,0.12);">
      <span class="pk">Precio cabaña</span>
      <span class="pv">${fCop(cab.precio)} / noche</span>
    </div>
    <div class="price-row" style="color:#3f3f3f;border-bottom:1px solid rgba(46,26,14,0.12);">
      <div>
        <div>${paquete.label}</div>
        <div style="font-size:0.75rem;color:var(--dark-muted);">${paquete.descripcion}</div>
      </div>
      <span class="pv">${paquete.precio ? `+${fCop(paquete.precio)}` : 'Incluido'}</span>
    </div>
    <div class="price-row" style="color:#3f3f3f;border-bottom:1px solid rgba(46,26,14,0.12);">
      <span class="pk">Precio paquete</span>
      <span class="pv">${paquete.precio ? `+${fCop(paquete.precio)} / noche` : 'Incluido'}</span>
    </div>
    ${servicios.map(s => `<div class="price-row" style="color:#3f3f3f;border-bottom:1px solid rgba(46,26,14,0.12);"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio)}</span></div>`).join('')}
    <div class="price-row" style="color:#3f3f3f;border:none;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(46,26,14,0.12);">
      <span class="pk">Subtotal</span>
      <span class="pv">${fCop(subtotal)}</span>
    </div>
    <div class="price-row" style="color:var(--dark-muted);font-size:0.78rem;border:none;">
      <span class="pk">IVA (19%)</span>
      <span class="pv">${fCop(iva)}</span>
    </div>
    <div class="price-row" style="color:#3f3f3f;font-weight:700;border:none;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(46,26,14,0.12);">
      <span class="pk">Total</span>
      <span class="pv">${fCop(total)}</span>
    </div>
  `;
  const totalEl = document.getElementById('admin-pt-val');
  if (totalEl) totalEl.textContent = fCop(total);
  if (totalRow) totalRow.style.display = 'flex';
}

function adminResetNuevaRES() {
  ADMIN_NUEVA_RES.cabana = 'roble';
  ADMIN_NUEVA_RES.fechaInicio = '';
  ADMIN_NUEVA_RES.fechaFin = '';
  ADMIN_NUEVA_RES.documento = '';
  ADMIN_NUEVA_RES.paquete = 'basico';
  ADMIN_NUEVA_RES.servicios.clear();
  
  document.getElementById('mn-ini').value = '';
  document.getElementById('mn-fin').value = '';
  document.getElementById('mn-cab').value = 'roble';
  document.getElementById('mn-doc').value = '';
  document.getElementById('mn-alert').innerHTML = '';
  document.getElementById('modal-cli-doc').value = '';
  document.getElementById('modal-cli-msg').textContent = '';
  
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn => {
    btn.classList.toggle('selected', btn.id === 'adm-p-basico');
  });
  document.querySelectorAll('.srv-chip[id^="adm-srv-"]').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  adminResumenUpdate();
}

// ═══════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y GESTIÓN DE CLIENTES
// ═══════════════════════════════════════════════════════════════════════════

async function searchClientByDoc() {
  const doc = document.getElementById('cli-search').value.trim();
  const resultContainer = document.getElementById('cli-results');
  
  if (!doc) {
    resultContainer.innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;font-size:0.9rem;">Introduce un número de documento para buscar</div>';
    return;
  }
  
  try {
    resultContainer.innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;padding:2rem;text-align:center;">Buscando…</p>';
    
    const d = await ReservasAPI.listar();
    const reservas = d.reservas || d.data || [];
    
    // Buscar reservas del cliente
    const clientReservas = reservas.filter(r => {
      const docField = r.documento || r.NroDocumentoCliente || '';
      return docField.toLowerCase().includes(doc.toLowerCase());
    });
    
    if (clientReservas.length === 0) {
      resultContainer.innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;font-size:0.9rem;">No se encontraron clientes con ese documento</div>';
      return;
    }
    
    // Obtener documento único(s)
    const docs = [...new Set(clientReservas.map(r => r.documento || r.NroDocumentoCliente))];
    
    let html = '';
    
    docs.forEach(clientDoc => {
      const clientRes = clientReservas.filter(r => (r.documento || r.NroDocumentoCliente) === clientDoc);
      const totalReservas = clientRes.length;
      const confirmadas = clientRes.filter(r => r.estado === 'confirmada').length;
      const pendientes = clientRes.filter(r => r.estado === 'pendiente').length;
      const canceladas = clientRes.filter(r => r.estado === 'cancelada').length;
      
      html += `
        <div style="background:var(--dark-card2);border:1px solid var(--dark-border);border-radius:var(--r-xl);padding:1.5rem;margin-bottom:1.5rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-bottom:1.5rem;">
            <div>
              <h3 style="color:#fff;margin-bottom:1rem;font-size:1.1rem;">📋 Datos del Cliente</h3>
              <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <div><span style="color:var(--dark-muted);font-size:0.85rem;">Documento</span><div style="color:#fff;font-weight:600;font-family:var(--font-display);font-size:1rem;">${clientDoc}</div></div>
              </div>
            </div>
            <div>
              <h3 style="color:#fff;margin-bottom:1rem;font-size:1.1rem;">📊 Resumen de Reservas</h3>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
                <div style="background:rgba(255,255,255,0.03);padding:1rem;border-radius:var(--r-lg);text-align:center;">
                  <div style="color:var(--dark-muted);font-size:0.75rem;margin-bottom:0.3rem;">Total</div>
                  <div style="color:#fff;font-family:var(--font-display);font-size:1.5rem;font-weight:800;">${totalReservas}</div>
                </div>
                <div style="background:rgba(232,93,4,0.12);padding:1rem;border-radius:var(--r-lg);text-align:center;">
                  <div style="color:var(--fire);font-size:0.75rem;margin-bottom:0.3rem;">Confirmadas</div>
                  <div style="color:var(--fire);font-family:var(--font-display);font-size:1.5rem;font-weight:800;">${confirmadas}</div>
                </div>
                <div style="background:rgba(255,193,7,0.12);padding:1rem;border-radius:var(--r-lg);text-align:center;">
                  <div style="color:#ffc107;font-size:0.75rem;margin-bottom:0.3rem;">Pendientes</div>
                  <div style="color:#ffc107;font-family:var(--font-display);font-size:1.5rem;font-weight:800;">${pendientes}</div>
                </div>
                <div style="background:rgba(244,67,54,0.12);padding:1rem;border-radius:var(--r-lg);text-align:center;">
                  <div style="color:#f44336;font-size:0.75rem;margin-bottom:0.3rem;">Canceladas</div>
                  <div style="color:#f44336;font-family:var(--font-display);font-size:1.5rem;font-weight:800;">${canceladas}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div style="border-top:1px solid var(--dark-border);padding-top:1.5rem;">
            <h4 style="color:#fff;margin-bottom:1rem;">Historial de Reservas</h4>
            <div>
              ${clientRes.map(r => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem;background:rgba(255,255,255,0.03);border-radius:var(--r-lg);margin-bottom:0.5rem;">
                  <div>
                    <div style="color:#fff;font-weight:600;font-size:0.9rem;">
                      #${r.id} · ${r.cabana || '—'} · ${r.paquete || 'Básico'}
                    </div>
                    <div style="color:var(--dark-muted);font-size:0.8rem;margin-top:0.2rem;">
                      ${fDate(r.fecha_inicio || r.FechaInicio)} → ${fDate(r.fecha_fin || r.FechaFinalizacion)} · ${nights(r.fecha_inicio || r.FechaInicio, r.fecha_fin || r.FechaFinalizacion)} noche(s) · ${r.num_personas || 1} pers.
                    </div>
                  </div>
                  <div style="text-align:right;">
                    ${statusBadge(r.estado || r.Estado || 'pendiente')}
                    ${r.MontoTotal || r.monto_total ? `<div style="color:var(--fire);font-family:var(--font-display);font-weight:800;font-size:0.95rem;margin-top:0.3rem;">${fCop(r.MontoTotal || r.monto_total)}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    });
    
    resultContainer.innerHTML = html;
  } catch (err) {
    resultContainer.innerHTML = `<div style="text-align:center;color:#f44336;padding:2rem;font-size:0.9rem;">⚠ Error al buscar: ${err.message}</div>`;
  }
}

function clearClientSearch() {
  document.getElementById('cli-search').value = '';
  document.getElementById('cli-results').innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;font-size:0.9rem;">Introduce un número de documento para buscar</div>';
}

function doLogout() { localStorage.removeItem('kafe_role'); toast('Sesión cerrada','ok'); setTimeout(()=>window.location.href='index.html',600); }
