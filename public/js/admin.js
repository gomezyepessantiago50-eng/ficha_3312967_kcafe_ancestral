/* ═══════════════════════════════════════════════════════════
   KAFE ANCESTRAL — admin.js  (v1.1 corregido)
   FIXES:
   1.  doLogout() usaba req() no global → usa AuthAPI.logout()
   2.  _cals en top-level antes de DOMContentLoaded → movido adentro
   3.  Validación admin acepta idRol o IDRol (compatibilidad JWT)
   4.  onCalDayClick() solo 5 registros → limit=500
   5.  loadDashboard() paginado → limit=500
   6.  adminAbrirNuevaReserva() ya no busca clientes en reservas
   7.  mn-doc es <input text> no <select>; modal-cli-doc/msg eliminados
   8.  Botón "Cancelar" de m-nueva diferenciado visualmente de "Crear"
   9.  doBloquear() enviaba fecha_inicio → ahora FechaInicio/FechaFinalizacion
   10. MontoTotal: subtotal + IVA correcto (no multiplicado)
   11. guardarEstado() mantiene página actual
═══════════════════════════════════════════════════════════ */

const CRUMBS = {
  dashboard:'Panel General', reservas:'Reservas', calendario:'Calendario',
  clientes:'Clientes', bloqueos:'Bloquear Fechas', cabanas:'Cabañas', paquetes:'Paquetes',
};

let _editId = null, _delId = null, _viewId = null, _viewReservaData = null;
const _pag = { currentPage:1, totalPages:1, total:0, limit:5 };

const CABANAS = {
  roble:     { label:'El Roble',   precio:280000, capacidad:2 },
  ceiba:     { label:'La Ceiba',   precio:420000, capacidad:4 },
  ancestral: { label:'Ancestral',  precio:650000, capacidad:6 },
};
const PAQUETES = {
  basico:   { label:'Básico',   precio:0      },
  cafetero: { label:'Cafetero', precio:80000  },
  premium:  { label:'Premium',  precio:200000 },
};
const SERVICIOS = {
  spa:        { label:'Spa',        precio:90000  },
  fogata:     { label:'Fogata',     precio:45000  },
  transporte: { label:'Transporte', precio:60000  },
  fotografia: { label:'Fotografía', precio:120000 },
};

const ADMIN_NUEVA_RES = { cabana:'roble', paquete:'basico', servicios:new Set() };

/* FIX 10 — cálculo correcto: subtotal + IVA */
function calcMontos(sub) {
  const iva   = Math.round(sub * 0.19);
  const total = sub + iva;
  return { subtotal: sub, iva, total };
}

/* ════════ INIT ════════ */
document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.getUser();
  /* FIX 3 */
  if (!user || !user.id || (user.idRol !== 1 && user.IDRol !== 1)) {
    window.location.replace('landing.html'); return;
  }
  document.getElementById('admin-username').textContent = user.nombre || 'Admin';

  /* FIX 2 */
  if (typeof _cals !== 'undefined') {
    _cals['dash-cal']  = { y:new Date().getFullYear(), m:new Date().getMonth(), refresh:refreshDashCal };
    _cals['admin-cal'] = { y:new Date().getFullYear(), m:new Date().getMonth(), refresh:refreshAdminCal };
  }

  loadDashboard();
  refreshDashCal();
  loadReservas();
  initNotificaciones();

  // Establecer fecha mínima en inputs de bloqueo (mañana)
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomStr = tom.toISOString().split('T')[0];
  const bIni = document.getElementById('b-ini');
  const bFin = document.getElementById('b-fin');
  if (bIni) bIni.setAttribute('min', tomStr);
  if (bFin) bFin.setAttribute('min', tomStr);

  setInterval(() => {
    const cl = document.getElementById('footer-clock');
    if (cl) cl.textContent = new Date().toLocaleString('es-CO');
  }, 1000);
});

/* ════════ NAVEGACIÓN ════════ */
function showSec(name, btn) {
  document.querySelectorAll('.a-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + name)?.classList.add('active');
  btn.classList.add('active');
  document.getElementById('topbar-crumb').textContent = CRUMBS[name] || name;
  if (name === 'reservas')   loadReservas(1);
  if (name === 'bloqueos')   loadBloqueos();
  if (name === 'calendario') refreshAdminCal();
}

/* ════════ CALENDARIOS ════════ */
async function fetchAvail() {
  try {
    const d = await ReservasAPI.disponibilidad();
    return { reservadas: d.data?.reservadas || d.reservadas || [], bloqueadas: d.data?.bloqueadas || d.bloqueadas || [] };
  } catch { return { reservadas:[], bloqueadas:[] }; }
}
async function refreshDashCal() {
  const s = _cals?.['dash-cal']; if (!s) return;
  const d = await fetchAvail();
  buildCal('dash-cal', s.y, s.m, d.reservadas, d.bloqueadas);
}
async function refreshAdminCal() {
  const s = _cals?.['admin-cal']; if (!s) return;
  const d = await fetchAvail();
  buildCal('admin-cal', s.y, s.m, d.reservadas, d.bloqueadas, 'onCalDayClick');
}
function prevMonth() { const s=_cals['admin-cal']; s.m--; if(s.m<0){s.m=11;s.y--;} refreshAdminCal(); }
function nextMonth() { const s=_cals['admin-cal']; s.m++; if(s.m>11){s.m=0;s.y++;} refreshAdminCal(); }

/* FIX 4 */
async function onCalDayClick(ds) {
  document.getElementById('cal-day-title').textContent = 'Reservas — ' + fDate(ds);
  document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Buscando…</p>';
  try {
    const resp = await fetch(`/api/reservas?limit=500&page=1`, { headers:{ 'Authorization':`Bearer ${Auth.getToken()}` } });
    const d    = await resp.json();
    const rs   = (d.data||[]).filter(r => r.fecha_inicio <= ds && r.fecha_fin >= ds);
    document.getElementById('cal-day-body').innerHTML = rs.length
      ? rs.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${CABANAS[r.cabana]?.label||r.cabana||'—'}</p></div></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">Sin reservas para este día</p>';
  } catch { document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);">Error al cargar</p>'; }
}

/* ════════ DASHBOARD ════════ */
/* FIX 5 */
async function loadDashboard() {
  try {
    const token = Auth.getToken();
    const [rR, rB] = await Promise.allSettled([
      fetch('/api/reservas?limit=500&page=1', { headers:{ 'Authorization':`Bearer ${token}` } }).then(r=>r.json()),
      BloqueosAPI.listar(),
    ]);
    const rs = rR.status==='fulfilled' ? (rR.value.data||[]) : [];
    const bl = rB.status==='fulfilled' ? (rB.value.data||rB.value.bloqueos||[]) : [];
    const pend = rs.filter(r=>r.estado==='pendiente').length;
    const conf = rs.filter(r=>r.estado==='confirmada').length;
    document.getElementById('ov-total').textContent = rs.length;
    document.getElementById('ov-pend').textContent  = pend;
    const ventas = rs.filter(r=>['confirmada','completada'].includes(r.estado)).reduce((sum, r) => sum + parseFloat(r.monto_total || 0), 0);
    if (document.getElementById('ov-ventas')) document.getElementById('ov-ventas').textContent = fCop(ventas);
    document.getElementById('ov-bloq').textContent  = bl.length;
    const badge = document.getElementById('nb-pend');
    badge.textContent = pend || '';
    badge.setAttribute('data-empty', pend===0 ? 'true' : 'false');

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const prox = rs.filter(r=>new Date(r.fecha_inicio+'T00:00:00')>=hoy && r.estado!=='cancelada')
                   .sort((a,b)=>new Date(a.fecha_inicio)-new Date(b.fecha_inicio)).slice(0,5);
    document.getElementById('prox-count').textContent = prox.length;
    document.getElementById('prox-list').innerHTML = prox.length
      ? prox.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${r.num_personas||1} pers.</p></div><div class="r-right" style="font-size:0.78rem;color:var(--dark-muted);">${CABANAS[r.cabana]?.label||r.cabana||'—'}</div></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay próximas llegadas</p>';
  } catch(e) {
    console.error('Dashboard Error:', e);
    ['ov-total','ov-pend','ov-ventas','ov-bloq'].forEach(id=>{ const el = document.getElementById(id); if (el) el.textContent='?'; });
    const px = document.getElementById('prox-list');
    if (px) px.innerHTML='<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver datos</p>';
  }
}

/* ════════ RESERVAS ════════ */
async function loadReservas(page=1) {
  const estado = document.getElementById('fil-estado').value;
  const fecha  = document.getElementById('fil-fecha').value;
  const tbody  = document.getElementById('res-tbody');
  const params = new URLSearchParams();
  if (estado) params.append('estado', estado);
  if (fecha)  params.append('fechaDesde', fecha);
  params.append('page',  page);
  params.append('limit', _pag.limit);
  try {
    const resp = await fetch(`/api/reservas?${params}`, { headers:{ 'Authorization':`Bearer ${Auth.getToken()}` } });
    const d    = await resp.json();
    if (d.ok) {
      const rs = d.data||[];
      _pag.currentPage = d.currentPage||1;
      _pag.totalPages  = d.totalPages||1;
      _pag.total       = d.total||0;
      document.getElementById('res-count').textContent = `${_pag.total} resultado(s)`;
      tbody.innerHTML = rs.length
        ? rs.map(r=>{
            const bl = ['cancelada','completada'].includes(r.estado);
            return `<tr>
              <td style="font-family:var(--font-display);font-weight:800;color:var(--fire);">#${r.id}</td>
              <td style="color:var(--dark-text);">${r.documento||'—'}</td>
              <td>${fDate(r.fecha_inicio)}</td><td>${fDate(r.fecha_fin)}</td>
              <td>${nights(r.fecha_inicio,r.fecha_fin)}</td><td>${r.num_personas||1}</td>
              <td>${CABANAS[r.cabana]?.label||r.cabana||'—'}</td>
              <td>${PAQUETES[r.paquete]?.label||r.paquete||'Básico'}</td>
              <td>${statusBadge(r.estado)}</td>
              <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-sm btn-outline" onclick="abrirVerReserva(${r.id})">Ver</button>
                <button class="btn btn-sm btn-outline" ${bl?'disabled title="No editable"':`onclick="abrirDetalle(${r.id})"`}>Editar</button>
                <button class="btn btn-sm btn-dark-outline" onclick="abrirEstado(${r.id},'${r.estado}')">Estado</button>
              </div></td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Sin resultados</td></tr>`;
      updatePagCtrl();
    } else {
      tbody.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Error al cargar reservas</td></tr>`;
    }
  } catch {
    tbody.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--dark-muted);">Inicia el servidor para ver reservas</td></tr>`;
  }
}

function updatePagCtrl() {
  const el = document.getElementById('pagination-controls'); if(!el) return;
  const {currentPage,totalPages} = _pag;
  if (totalPages<=1) { el.innerHTML=''; return; }
  el.innerHTML=`<div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;padding:1rem;">
    <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage-1})" ${currentPage<=1?'disabled':''}>← Anterior</button>
    <span style="color:var(--dark-muted);font-size:0.85rem;">Página ${currentPage} de ${totalPages}</span>
    <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage+1})" ${currentPage>=totalPages?'disabled':''}>Siguiente →</button>
  </div>`;
}
function goToPage(p) { if(p<1||p>_pag.totalPages) return; loadReservas(p); }
function clearFil() { document.getElementById('fil-estado').value=''; document.getElementById('fil-fecha').value=''; loadReservas(1); }
function verTodasReservas() { clearFil(); }

/* ════════ ESTADO ════════ */
function abrirEstado(id,curr) { _editId=id; document.getElementById('m-est-id').textContent=id; document.getElementById('m-est-val').value=curr; openM('m-estado'); }
/* FIX 11 */
async function guardarEstado() {
  try {
    await ReservasAPI.actualizar(_editId, { estado: document.getElementById('m-est-val').value });
    closeM('m-estado'); toast('Estado actualizado','ok');
    loadReservas(_pag.currentPage); loadDashboard();
  } catch(e) { toast(e.message,'err'); }
}

/* ════════ VER RESERVA ════════ */
async function abrirVerReserva(id) {
  try {
    const res     = await ReservasAPI.una(id);
    const reserva = res.data || res;
    const srvs    = Array.isArray(reserva.servicios) ? reserva.servicios.map(k=>SERVICIOS[k]?.label||k).filter(Boolean).join(', ') : '';
    document.getElementById('m-view-id').textContent = id;
    document.getElementById('m-view-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div><strong>Cliente</strong><p>${reserva.documento||'—'}</p></div>
        <div><strong>Estado</strong><p>${statusBadge(reserva.estado)}</p></div>
        <div><strong>Cabaña</strong><p>${CABANAS[reserva.cabana]?.label||reserva.cabana||'—'}</p></div>
        <div><strong>Paquete</strong><p>${PAQUETES[reserva.paquete]?.label||reserva.paquete||'Básico'}</p></div>
        <div><strong>Fecha inicio</strong><p>${fDate(reserva.fecha_inicio)}</p></div>
        <div><strong>Fecha fin</strong><p>${fDate(reserva.fecha_fin)}</p></div>
        <div><strong>Noches</strong><p>${nights(reserva.fecha_inicio,reserva.fecha_fin)}</p></div>
        <div><strong>Personas</strong><p>${reserva.num_personas||1}</p></div>
        <div><strong>Servicios</strong><p>${srvs||'Ninguno'}</p></div>
        <div><strong>Fecha reserva</strong><p>${fDate(reserva.fecha_reserva)}</p></div>
      </div>
      <div style="margin-top:1rem;padding:1rem;background:rgba(255,255,255,0.05);border-radius:var(--r-lg);">
        <h4 style="margin:0 0 0.75rem;">Costos</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;line-height:1.5;">
          <div><strong>Subtotal</strong><p>${fCop(reserva.subtotal??0)}</p></div>
          <div><strong>Descuento</strong><p>${fCop(reserva.descuento??0)}</p></div>
          <div><strong>IVA (19%)</strong><p>${fCop(reserva.iva??0)}</p></div>
          <div><strong>Total</strong><p style="font-weight:700;color:var(--fire);">${fCop(reserva.monto_total??0)}</p></div>
        </div>
      </div>
      <div style="margin-top:1rem;">
        <strong>Notas</strong>
        <p style="white-space:pre-wrap;color:var(--dark-muted);margin-top:0.35rem;">${reserva.notas||'Sin notas'}</p>
      </div>`;
    openM('m-view-reserva');
  } catch(err) { toast(err.message||'No se pudo cargar','err'); }
}

/* ════════ EDITAR RESERVA ════════ */
async function abrirDetalle(id) {
  _viewId=id;
  document.getElementById('m-det-id').textContent  = id;
  document.getElementById('m-det-alert').innerHTML = '';
  try {
    const res=await ReservasAPI.una(id); const reserva=res.data||res;
    if (['cancelada','completada'].includes(reserva.estado)) { toast('No editable','err'); return; }
    _viewReservaData=reserva;
    document.getElementById('m-det-doc').value      = reserva.documento||'';
    document.getElementById('m-det-cabana').value   = reserva.cabana||'roble';
    document.getElementById('m-det-ini').value      = reserva.fecha_inicio||'';
    document.getElementById('m-det-fin').value      = reserva.fecha_fin||'';
    document.getElementById('m-det-paquete').value  = reserva.paquete||'basico';
    document.getElementById('m-det-personas').value = reserva.num_personas||1;
    document.getElementById('m-det-notas').value    = reserva.notas||'';
    const tom=new Date(); tom.setDate(tom.getDate()+1); const tomStr=tom.toISOString().split('T')[0];
    document.getElementById('m-det-ini').setAttribute('min',tomStr);
    if (reserva.fecha_inicio) {
      const mf=new Date(reserva.fecha_inicio); mf.setDate(mf.getDate()+1);
      document.getElementById('m-det-fin').setAttribute('min',mf.toISOString().split('T')[0]);
    }
    openM('m-detalle-admin');
  } catch(err) { toast(err.message||'Error','err'); }
}

function mDetRangeCheck() {
  const iniEl=document.getElementById('m-det-ini'), finEl=document.getElementById('m-det-fin');
  const ini=iniEl.value; const tom=new Date(); tom.setDate(tom.getDate()+1); const tomStr=tom.toISOString().split('T')[0];
  if (ini&&ini<tomStr) { iniEl.value=''; finEl.value=''; return; }
  if (ini&&finEl.value&&new Date(finEl.value)<=new Date(ini)) finEl.value='';
  if (ini) { const mf=new Date(ini); mf.setDate(mf.getDate()+1); finEl.setAttribute('min',mf.toISOString().split('T')[0]); }
}

async function guardarDetalleReserva() {
  if (!_viewId) return;
  const ini=document.getElementById('m-det-ini').value, fin=document.getElementById('m-det-fin').value;
  const cabana=document.getElementById('m-det-cabana').value, paquete=document.getElementById('m-det-paquete').value;
  const personas=Number(document.getElementById('m-det-personas').value)||1;
  const notas=document.getElementById('m-det-notas').value.trim();
  const alertEl=document.getElementById('m-det-alert');
  const tom=new Date(); tom.setDate(tom.getDate()+1); const tomStr=tom.toISOString().split('T')[0];
  if (!ini||!fin) { alertEl.innerHTML=`<div class="alert alert-error">⚠ Selecciona fechas.</div>`; return; }
  if (ini<tomStr)  { alertEl.innerHTML=`<div class="alert alert-error">⚠ Fecha inicio debe ser desde mañana.</div>`; return; }
  if (new Date(fin)<=new Date(ini)) { alertEl.innerHTML=`<div class="alert alert-error">⚠ Fecha fin debe ser posterior.</div>`; return; }
  const srvs=_viewReservaData?.servicios||[];
  const srvP=Array.isArray(srvs)?srvs.reduce((s,k)=>s+(SERVICIOS[k]?.precio||0),0):0;
  const noches=nights(ini,fin);
  const rawSub=(CABANAS[cabana].precio+PAQUETES[paquete].precio)*Math.max(noches,1)+srvP*personas;
  const {subtotal,iva,total}=calcMontos(rawSub);
  try {
    await ReservasAPI.actualizar(_viewId,{ FechaInicio:ini, FechaFinalizacion:fin, cabana, paquete, num_personas:personas, notas, servicios:srvs, SubTotal:subtotal, IVA:iva, MontoTotal:total });
    closeM('m-detalle-admin'); toast('Reserva actualizada','ok');
    loadReservas(_pag.currentPage); loadDashboard();
  } catch(err) { alertEl.innerHTML=`<div class="alert alert-error">⚠ ${err.message}</div>`; }
}

/* ════════ ELIMINAR ════════ */
function abrirDel(id) { _delId=id; document.getElementById('m-del-id').textContent=id; openM('m-del'); }
async function doEliminar() {
  try { await ReservasAPI.eliminar(_delId); closeM('m-del'); toast('Reserva cancelada','ok'); loadReservas(1); loadDashboard(); }
  catch(e) { toast(e.message,'err'); }
}

/* ════════ NUEVA RESERVA ════════ */
/* FIX 6,7,8 */
function adminAbrirNuevaReserva() {
  adminResetNuevaRES();
  setMinDateInputs();
  openM('m-nueva');
  adminResumenUpdate();
}
function adminSelectPaquete(key) {
  ADMIN_NUEVA_RES.paquete=key;
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn=>btn.classList.toggle('selected',btn.id===`adm-p-${key}`));
  adminResumenUpdate();
}
function adminToggleSrv(key) {
  ADMIN_NUEVA_RES.servicios.has(key)?ADMIN_NUEVA_RES.servicios.delete(key):ADMIN_NUEVA_RES.servicios.add(key);
  document.getElementById(`adm-srv-${key}`)?.classList.toggle('selected',ADMIN_NUEVA_RES.servicios.has(key));
  adminResumenUpdate();
}
function adminCabanaChange() { ADMIN_NUEVA_RES.cabana=document.getElementById('mn-cab').value; adminResumenUpdate(); }

function adminResumenUpdate() {
  const ini=document.getElementById('mn-ini').value, fin=document.getElementById('mn-fin').value;
  if (ini) {
    const finEl=document.getElementById('mn-fin'); const mf=new Date(ini); mf.setDate(mf.getDate()+1);
    finEl.setAttribute('min',mf.toISOString().split('T')[0]);
    if (fin&&new Date(fin)<=new Date(ini)) finEl.value='';
  }
  const noches=nights(ini,fin);
  const cab=CABANAS[ADMIN_NUEVA_RES.cabana]||CABANAS.roble;
  const paq=PAQUETES[ADMIN_NUEVA_RES.paquete]||PAQUETES.basico;
  const srvs=Array.from(ADMIN_NUEVA_RES.servicios).map(s=>SERVICIOS[s]).filter(Boolean);
  const srvP=srvs.reduce((a,s)=>a+s.precio,0);
  const rawSub=(cab.precio+paq.precio)*Math.max(noches,1)+srvP*cab.capacidad;
  const {subtotal,iva,total}=calcMontos(rawSub);
  const valido=ini&&fin&&new Date(fin)>new Date(ini);
  const body=document.getElementById('admin-price-body'), totalRow=document.getElementById('admin-price-total');
  if (!valido) { body.innerHTML='<p style="color:rgba(100,80,60,0.6);text-align:center;font-size:0.85rem;">Selecciona fechas válidas</p>'; if(totalRow) totalRow.style.display='none'; return; }
  body.innerHTML=`
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} × ${noches} noche(s)</span></div>
    <div class="price-row"><span class="pk">Precio/noche</span><span class="pv">${fCop(cab.precio)}</span></div>
    <div class="price-row"><span class="pk">Paquete</span><span class="pv">${paq.label} ${paq.precio?`+${fCop(paq.precio)}`:'(incluido)'}</span></div>
    ${srvs.map(s=>`<div class="price-row"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio)}</span></div>`).join('')}
    <div class="price-row" style="border-top:1px solid rgba(46,26,14,0.12);margin-top:0.4rem;padding-top:0.4rem;">
      <span class="pk">Subtotal</span><span class="pv">${fCop(subtotal)}</span>
    </div>
    <div class="price-row"><span class="pk">IVA (19%)</span><span class="pv">${fCop(iva)}</span></div>`;
  const tEl=document.getElementById('admin-pt-val'); if(tEl) tEl.textContent=fCop(total);
  if(totalRow) totalRow.style.display='flex';
}

async function doNuevaAdmin() {
  const ini=document.getElementById('mn-ini').value, fin=document.getElementById('mn-fin').value;
  const cab=document.getElementById('mn-cab').value;
  /* FIX 7: mn-doc es input text */
  const doc=document.getElementById('mn-doc').value.trim();
  const alertEl=document.getElementById('mn-alert');
  if (!doc) { alertEl.innerHTML='<div class="alert alert-error">⚠ Ingresa el documento del cliente.</div>'; return; }
  if (!ini) { alertEl.innerHTML='<div class="alert alert-error">⚠ Selecciona la fecha de inicio.</div>'; return; }
  if (!fin) { alertEl.innerHTML='<div class="alert alert-error">⚠ Selecciona la fecha de fin.</div>'; return; }
  const [y,m,d]=ini.split('-').map(Number); const start=new Date(y,m-1,d);
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  if (start<=hoy) { alertEl.innerHTML=`<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de mañana.</div>`; return; }
  try {
    const noches=nights(ini,fin); const cabData=CABANAS[cab]; const paqData=PAQUETES[ADMIN_NUEVA_RES.paquete];
    const serviciosArr=Array.from(ADMIN_NUEVA_RES.servicios);
    const srvP=serviciosArr.reduce((acc,k)=>acc+(SERVICIOS[k]?.precio||0),0);
    const rawSub=(cabData.precio+paqData.precio)*Math.max(noches,1)+srvP*cabData.capacidad;
    const {subtotal,iva,total}=calcMontos(rawSub);
    await ReservasAPI.crear({ NroDocumentoCliente:doc, FechaInicio:ini, FechaFinalizacion:fin, SubTotal:subtotal, Descuento:0, IVA:iva, MontoTotal:total, MetodoPago:_metodoPago, num_personas:cabData.capacidad, cabana:cab, paquete:ADMIN_NUEVA_RES.paquete, servicios:serviciosArr });
    closeM('m-nueva'); toast('Reserva creada','ok'); adminResetNuevaRES(); loadReservas(1); loadDashboard();
  } catch(e) { alertEl.innerHTML=`<div class="alert alert-error">⚠ ${e.message}</div>`; }
}

function adminResetNuevaRES() {
  ADMIN_NUEVA_RES.cabana='roble'; ADMIN_NUEVA_RES.paquete='basico'; ADMIN_NUEVA_RES.servicios.clear();
  ['mn-ini','mn-fin'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mn-cab').value='roble';
  document.getElementById('mn-doc').value='';
  document.getElementById('mn-alert').innerHTML='';
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn=>btn.classList.toggle('selected',btn.id==='adm-p-basico'));
  document.querySelectorAll('.srv-chip[id^="adm-srv-"]').forEach(btn=>btn.classList.remove('selected'));
}

/* ════════ BLOQUEOS ════════ */
/* FIX 9: nombres de campo correctos */

/* ════════ SYNC FECHAS BLOQUEO ════════ */
function syncBloqueoDates() {
  const iniEl = document.getElementById('b-ini');
  const finEl = document.getElementById('b-fin');
  const ini   = iniEl.value;
  if (ini) {
    finEl.setAttribute('min', ini);
    if (finEl.value && finEl.value < ini) finEl.value = '';
  }
}

async function doBloquear() {
  const ini=document.getElementById('b-ini').value, fin=document.getElementById('b-fin').value;
  const alEl=document.getElementById('blq-alert');
  if (!ini||!fin) { alEl.innerHTML='<div class="alert alert-error">⚠ Selecciona las fechas</div>'; return; }

  // Validar que no sean fechas pasadas ni hoy
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [yi,mi,di] = ini.split('-').map(Number);
  const fechaIni = new Date(yi, mi-1, di);
  if (fechaIni <= hoy) {
    alEl.innerHTML='<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de mañana</div>'; return;
  }
  if (new Date(fin)<new Date(ini)) { alEl.innerHTML='<div class="alert alert-error">⚠ Fecha fin no puede ser anterior al inicio</div>'; return; }
  try {
    await BloqueosAPI.crear({ FechaInicio:ini, FechaFinalizacion:fin, Motivo:document.getElementById('b-motivo').value });
    alEl.innerHTML=''; ['b-ini','b-fin','b-motivo'].forEach(id=>document.getElementById(id).value='');
    toast('Fechas bloqueadas','ok'); loadBloqueos(); refreshAdminCal(); refreshDashCal();
  } catch(e) { alEl.innerHTML=`<div class="alert alert-error">⚠ ${e.message}</div>`; }
}

async function loadBloqueos() {
  const c=document.getElementById('blq-list');
  try {
    const d=await BloqueosAPI.listar(); const bs=d.data||d.bloqueos||[];
    document.getElementById('ov-bloq').textContent=bs.length;
    c.innerHTML=bs.length
      ? bs.map(b=>`<div class="blq-item"><div class="blq-ico">🔒</div><div class="blq-txt"><h4>${fDate(b.fecha_inicio)} → ${fDate(b.fecha_fin)}</h4><p>${b.motivo||'Sin motivo'}</p></div><button class="btn btn-sm btn-danger" onclick="doDesbloquear(${b.id})">Quitar</button></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay fechas bloqueadas</p>';
  } catch { c.innerHTML='<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver bloqueos</p>'; }
}

async function doDesbloquear(id) {
  try { await BloqueosAPI.eliminar(id); toast('Fecha desbloqueada','ok'); loadBloqueos(); refreshAdminCal(); refreshDashCal(); }
  catch(e) { toast(e.message,'err'); }
}

/* ════════ USUARIOS ════════ */
let _usuarioActual = null;
let _rolSeleccion  = null;

async function searchUsuario() {
  const email    = document.getElementById('cli-search').value.trim();
  const resultEl = document.getElementById('cli-results');
  if (!email) {
    resultEl.innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;font-size:0.9rem;">Introduce un correo electrónico para buscar</div>';
    return;
  }
  resultEl.innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;padding:2rem;text-align:center;">Buscando…</p>';
  try {
    const data = await UsuariosAPI.buscar(email);
    const u    = data.usuario;
    if (!u) { resultEl.innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;">No se encontró ningún usuario con ese correo</div>'; return; }
    _usuarioActual = u;

    const rolBadge = u.rol === 'admin'
      ? '<span class="badge" style="background:rgba(232,93,4,0.15);color:var(--fire);border:1px solid rgba(232,93,4,0.3);">🔑 Administrador</span>'
      : '<span class="badge" style="background:rgba(45,122,79,0.15);color:#4caf50;border:1px solid rgba(45,122,79,0.3);">👤 Cliente</span>';

    resultEl.innerHTML = `
      <div style="background:var(--dark-card2);border:1px solid var(--dark-border);border-radius:var(--r-xl);padding:1.75rem;max-width:640px;">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--dark-border);">
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--fire),var(--amber));display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">👤</div>
          <div style="flex:1;">
            <h3 style="color:#fff;margin:0 0 0.25rem;font-size:1.05rem;">${u.nombre} ${u.apellido || ''}</h3>
            <p style="color:var(--dark-muted);font-size:0.85rem;margin:0;">${u.email}</p>
          </div>
          ${rolBadge}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
          <div><p style="color:var(--dark-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">Teléfono</p><p style="color:#fff;font-size:0.9rem;">${u.telefono || '—'}</p></div>
          <div><p style="color:var(--dark-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">Documento</p><p style="color:#fff;font-size:0.9rem;">${u.tipoDocumento ? u.tipoDocumento + ' ' + u.numeroDocumento : '—'}</p></div>
          <div><p style="color:var(--dark-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">País</p><p style="color:#fff;font-size:0.9rem;">${u.pais || '—'}</p></div>
          <div><p style="color:var(--dark-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">ID Usuario</p><p style="color:#fff;font-size:0.9rem;">#${u.id}</p></div>
        </div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-fire btn-sm" onclick="abrirCambioRol()">🔄 Cambiar rol</button>
          <button class="btn btn-sm" style="background:rgba(91,141,238,0.15);border:1px solid rgba(91,141,238,0.3);color:#7eb3ff;" onclick="abrirResetUsuario()">🔑 Restablecer contraseña</button>
          <button class="btn btn-danger btn-sm" onclick="abrirEliminarUsuario()">🗑 Eliminar cuenta</button>
        </div>
      </div>`;
  } catch(err) {
    resultEl.innerHTML = `<div style="text-align:center;color:#f44336;padding:2rem;">⚠ ${err.message}</div>`;
  }
}

function clearUsuarioSearch() {
  document.getElementById('cli-search').value = '';
  _usuarioActual = null;
  document.getElementById('cli-results').innerHTML = '<div style="text-align:center;color:var(--dark-muted);padding:3rem;font-size:0.9rem;">Introduce un correo electrónico para buscar un usuario</div>';
}

/* ── Cambiar Rol ── */
function abrirCambioRol() {
  if (!_usuarioActual) return;
  _rolSeleccion = _usuarioActual.rol;
  document.getElementById('m-rol-email').textContent = _usuarioActual.email;
  document.getElementById('m-rol-alert').innerHTML   = '';
  setRolSeleccion(_usuarioActual.rol);
  openM('m-rol');
}

function setRolSeleccion(rol) {
  _rolSeleccion = rol;
  const btnCliente = document.getElementById('m-rol-btn-cliente');
  const btnAdmin   = document.getElementById('m-rol-btn-admin');
  if (rol === 'cliente') {
    btnCliente.style.border     = '2px solid var(--fire)';
    btnCliente.style.background = 'rgba(232,93,4,0.08)';
    btnAdmin.style.border       = '2px solid rgba(46,26,14,0.15)';
    btnAdmin.style.background   = '#fff';
  } else {
    btnAdmin.style.border       = '2px solid var(--fire)';
    btnAdmin.style.background   = 'rgba(232,93,4,0.08)';
    btnCliente.style.border     = '2px solid rgba(46,26,14,0.15)';
    btnCliente.style.background = '#fff';
  }
}

async function confirmarCambioRol() {
  if (!_usuarioActual || !_rolSeleccion) return;
  try {
    await UsuariosAPI.cambiarRol(_usuarioActual.id, _rolSeleccion);
    _usuarioActual.rol = _rolSeleccion;
    closeM('m-rol');
    toast(`Rol cambiado a ${_rolSeleccion} correctamente`, 'ok');
    searchUsuario();
  } catch(err) {
    document.getElementById('m-rol-alert').innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}

/* ── Eliminar Usuario ── */
function abrirEliminarUsuario() {
  if (!_usuarioActual) return;
  document.getElementById('m-del-usuario-email').textContent = _usuarioActual.email;
  openM('m-del-usuario');
}

async function confirmarEliminarUsuario() {
  if (!_usuarioActual) return;
  try {
    await UsuariosAPI.eliminar(_usuarioActual.id);
    closeM('m-del-usuario');
    toast('Cuenta eliminada correctamente', 'ok');
    clearUsuarioSearch();
  } catch(err) { toast(err.message, 'err'); }
}

/* ── Reset Password ── */
function abrirResetUsuario() {
  if (!_usuarioActual) return;
  document.getElementById('m-reset-email').textContent    = _usuarioActual.email;
  document.getElementById('m-reset-result').style.display = 'none';
  document.getElementById('m-reset-content').style.display= 'block';
  document.getElementById('m-reset-ft').innerHTML = `
    <button class="btn btn-dark-outline" onclick="closeM('m-reset-usuario')">Cancelar</button>
    <button class="btn btn-fire" onclick="confirmarResetUsuario()">Generar enlace</button>`;
  openM('m-reset-usuario');
}

async function confirmarResetUsuario() {
  if (!_usuarioActual) return;
  try {
    const data = await UsuariosAPI.reset(_usuarioActual.id);
    document.getElementById('m-reset-content').style.display = 'none';
    document.getElementById('m-reset-result').style.display  = 'block';
    document.getElementById('m-reset-url').textContent       = window.location.origin + data.resetUrl;
    document.getElementById('m-reset-ft').innerHTML = `
      <button class="btn btn-fire" onclick="navigator.clipboard.writeText(window.location.origin+'${data.resetUrl}');toast('Enlace copiado','ok')">📋 Copiar enlace</button>
      <button class="btn btn-dark-outline" onclick="closeM('m-reset-usuario')">Cerrar</button>`;
  } catch(err) { toast(err.message, 'err'); }
}

/* Alias para compatibilidad con HTML viejo */
function searchClientByDoc()  { searchUsuario(); }
function clearClientSearch()  { clearUsuarioSearch(); }


/* ════════════════════════════════════════════════════════
   NOTIFICACIONES — polling cada 60s
════════════════════════════════════════════════════════ */
let _notifUltimaRevision = Date.now();
let _notifLeidas         = JSON.parse(localStorage.getItem('kafe_notif_leidas') || '[]');
let _notifLista          = [];
let _notifPanelAbierto   = false;

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  _notifPanelAbierto = !_notifPanelAbierto;
  panel.classList.toggle('open', _notifPanelAbierto);
  if (_notifPanelAbierto) renderNotifPanel();
}

// Cerrar panel al hacer click fuera
document.addEventListener('click', e => {
  const wrap = document.getElementById('notif-btn')?.closest('.notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-panel')?.classList.remove('open');
    _notifPanelAbierto = false;
  }
});

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifLista.length) {
    list.innerHTML = '<div class="notif-empty">Sin notificaciones nuevas</div>';
    return;
  }
  list.innerHTML = _notifLista.map(n => {
    const leida   = _notifLeidas.includes(n.id);
    const tiempo  = timeAgo(n.timestamp);
    return `
      <div class="notif-item ${leida ? '' : 'unread'}">
        <div class="notif-ico">📋</div>
        <div class="notif-txt">
          <p>${n.mensaje}</p>
          <span>${tiempo}</span>
        </div>
      </div>`;
  }).join('');
}

function marcarTodasLeidas() {
  _notifLeidas = _notifLista.map(n => n.id);
  localStorage.setItem('kafe_notif_leidas', JSON.stringify(_notifLeidas));
  document.getElementById('notif-btn')?.classList.remove('has-new');
  renderNotifPanel();
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return 'Hace un momento';
  if (diff < 3600)  return `Hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff/3600)} h`;
  return new Date(ts).toLocaleDateString('es-CO');
}

async function checkNuevasReservas() {
  try {
    const token = Auth.getToken(); if (!token) return;
    const resp  = await fetch('/api/reservas?limit=500&page=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d  = await resp.json();
    const rs = d.data || [];

    // Reservas creadas después de la última revisión
    const nuevas = rs.filter(r => {
      const fechaReserva = new Date(r.fecha_reserva).getTime();
      return fechaReserva > _notifUltimaRevision;
    });

    if (nuevas.length > 0) {
      nuevas.forEach(r => {
        const id = `res-${r.id}`;
        if (!_notifLista.find(n => n.id === id)) {
          _notifLista.unshift({
            id,
            mensaje: `Nueva reserva #${r.id} — ${r.cabana ? (CABANAS[r.cabana]?.label || r.cabana) : 'Cabaña'} · ${r.documento || 'Cliente'}`,
            timestamp: new Date(r.fecha_reserva).getTime(),
          });
        }
      });

      // Limitar a 20 notificaciones
      _notifLista = _notifLista.slice(0, 20);

      // Animar campanita si hay no leídas
      const noLeidas = _notifLista.filter(n => !_notifLeidas.includes(n.id));
      if (noLeidas.length > 0) {
        const btn = document.getElementById('notif-btn');
        btn?.classList.add('has-new');
      }

      if (_notifPanelAbierto) renderNotifPanel();
    }

    _notifUltimaRevision = Date.now();
  } catch { /* silencioso */ }
}

function initNotificaciones() {
  // Primera carga — cargar reservas existentes como "leídas" para no notificar las viejas
  setTimeout(async () => {
    try {
      const token = Auth.getToken(); if (!token) return;
      const resp  = await fetch('/api/reservas?limit=500&page=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d  = await resp.json();
      const rs = d.data || [];
      // Marcar todas las existentes como ya leídas
      const idsExistentes = rs.map(r => `res-${r.id}`);
      _notifLeidas = [...new Set([..._notifLeidas, ...idsExistentes])];
      localStorage.setItem('kafe_notif_leidas', JSON.stringify(_notifLeidas));
      _notifUltimaRevision = Date.now();
    } catch { /* silencioso */ }
    // Iniciar polling cada 60 segundos
    setInterval(checkNuevasReservas, 60000);
  }, 3000);
}

/* ════════ LOGOUT — FIX 1 ════════ */
async function doLogout() {
  try { await AuthAPI.logout(); } catch { /* silencioso */ }
  Auth.clear();
  toast('Sesión cerrada','ok');
  setTimeout(()=>window.location.replace('landing.html'),600);
}

/* ════════ PROTECCIÓN BOTÓN ATRÁS ════════ */
window.addEventListener('pageshow', (event) => {
  if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
    if (!Auth.isLogged()) {
      window.location.replace('landing.html');
    }
  }
});


/* ════════ CABANAS Y HABITACIONES ════════ */

async function loadCabanas() {
  try {
    const res = await req('/cabanas');
    const grid = document.getElementById('cab-grid');
    if (!res.success) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Error al cargar cabañas.</div>';
      return;
    }
    const cabanas = res.data;
    if (cabanas.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay cabañas registradas.</div>';
      return;
    }

    grid.innerHTML = cabanas.map(c => `
      <div class="cab-card">
        <div class="cab-img" style="background:linear-gradient(135deg,rgba(139,69,19,0.3),rgba(210,105,30,0.2));">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:44px;height:44px;color:var(--amber);"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14"/><path d="m17 8 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 8"/><line x1="12" y1="22" x2="12" y2="19"/></svg>
        </div>
        <div class="cab-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3>${c.Nombre}</h3>
            ${c.Estado ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-danger">Inactiva</span>'}
          </div>
          <p style="height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${c.Descripcion || 'Sin descripción'}</p>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${c.CapacidadMaxima} pers.</span>
            <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;"><path d="M3 22v-8"/><path d="M21 22v-8"/><path d="M3 14h18"/><path d="M7 14v-4a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v4"/><path d="M12 6V2"/></svg> ${c.NumeroHabitaciones} hab.</span>
          </div>
          <div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--fire);">$${Number(c.Costo).toLocaleString('es-CO')}<small style="font-size:0.7rem;color:var(--dark-muted);font-family:var(--font-body);font-weight:400;">/noche</small></div>
        </div>
        <div class="cab-foot" style="padding:0 1.1rem 1.1rem;">
          <button class="btn btn-sm btn-dark-outline" onclick="adminEditarCabana('${c.IDCabaña}')">Editar</button>
          <button class="btn btn-sm btn-dark-outline" style="color:var(--danger);border-color:rgba(239,83,80,0.3);" onclick="adminEliminarCabana('${c.IDCabaña}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

window.adminNuevaCabana = function() {
  document.getElementById('m-cab-id').value = '';
  document.getElementById('m-cab-nombre').value = '';
  document.getElementById('m-cab-desc').value = '';
  document.getElementById('m-cab-cap').value = '';
  document.getElementById('m-cab-costo').value = '';
  document.getElementById('m-cab-numhab').value = '1';
  document.getElementById('m-cab-est').value = 'true';
  document.getElementById('m-cab-title').textContent = 'Nueva Cabaña';
  openM('m-cab');
};

window.adminEditarCabana = async function(id) {
  try {
    const res = await req('/cabanas/' + id);
    if (!res.success) return alert(res.message || 'Error al obtener cabaña');
    const c = res.data;
    document.getElementById('m-cab-id').value = c.IDCabaña;
    document.getElementById('m-cab-nombre').value = c.Nombre;
    document.getElementById('m-cab-desc').value = c.Descripcion || '';
    document.getElementById('m-cab-cap').value = c.CapacidadMaxima;
    document.getElementById('m-cab-costo').value = c.Costo;
    document.getElementById('m-cab-numhab').value = c.NumeroHabitaciones;
    document.getElementById('m-cab-est').value = c.Estado ? 'true' : 'false';
    document.getElementById('m-cab-title').textContent = 'Editar Cabaña';
    openM('m-cab');
  } catch (err) {
    console.error(err);
  }
};

window.saveCabana = async function() {
  const id = document.getElementById('m-cab-id').value;
  const data = {
    Nombre: document.getElementById('m-cab-nombre').value,
    Descripcion: document.getElementById('m-cab-desc').value,
    CapacidadMaxima: parseInt(document.getElementById('m-cab-cap').value),
    Costo: parseFloat(document.getElementById('m-cab-costo').value),
    NumeroHabitaciones: parseInt(document.getElementById('m-cab-numhab').value),
    Estado: document.getElementById('m-cab-est').value === 'true'
  };

  if (!data.Nombre || isNaN(data.CapacidadMaxima) || isNaN(data.Costo) || isNaN(data.NumeroHabitaciones)) {
    return alert('Por favor, completa los campos requeridos correctamente.');
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? '/api/cabanas/' + id : '/api/cabanas';
    const res = await req(url, method, data);
    if (res.success) {
      closeM('m-cab');
      loadCabanas();
      loadHabitaciones(); // Update rooms too!
    } else {
      alert(res.message || 'Error al guardar cabaña');
    }
  } catch (err) {
    console.error(err);
  }
};

window.adminEliminarCabana = async function(id) {
  if (!confirm('¿Estás seguro de eliminar esta cabaña? Se eliminarán también sus habitaciones.')) return;
  try {
    const res = await req('/cabanas/' + id, 'DELETE');
    if (res.success) {
      loadCabanas();
      loadHabitaciones();
    } else {
      alert(res.message || 'Error al eliminar cabaña');
    }
  } catch (err) {
    console.error(err);
  }
};

// Override loadHabitaciones to fetch from our new API
window.loadHabitaciones = async function() {
  try {
    const res = await req('/habitaciones');
    const grid = document.getElementById('hab-grid');
    if (!res.success) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Error al cargar habitaciones.</div>';
      return;
    }
    const habitaciones = res.data;
    if (habitaciones.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay habitaciones registradas.</div>';
      return;
    }

    grid.innerHTML = habitaciones.map(h => `
      <div class="blq-item" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="blq-txt">
            <h4>${h.NombreHabitacion}</h4>
            <p style="color:var(--fire); font-weight:600;">Cabaña: ${h.NombreCabaña || 'Desconocida'}</p>
          </div>
          ${h.Estado ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-danger">Inactiva</span>'}
        </div>
        <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem;">
          <button class="btn btn-sm btn-dark-outline" onclick="adminEditarHabitacion('${h.IDHabitacion}')">Editar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
};

window.adminNuevaHabitacion = async function() {
  document.getElementById('m-hab-id').value = '';
  document.getElementById('m-hab-nombre').value = '';
  document.getElementById('m-hab-est').value = 'true';
  window._currentHabFoto = null;
  document.getElementById('m-hab-foto').value = '';
  const preview = document.getElementById('m-hab-foto-preview');
  if(preview) preview.style.display='none';
  document.getElementById('m-hab-title').textContent = 'Nueva Habitación';
  
  // Load cabanas into select
  const select = document.getElementById('m-hab-cabana');
  select.innerHTML = '<option value="">Cargando...</option>';
  try {
    const res = await req('/cabanas');
    if (res.success && res.data.length > 0) {
      select.innerHTML = '<option value="">-- Seleccione Cabaña --</option>' + res.data.map(c => `<option value="${c.IDCabaña}">${c.Nombre}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No hay cabañas creadas</option>';
    }
  } catch(e) {}

  openM('m-hab');
};

window.adminEditarHabitacion = async function(id) {
  try {
    const res = await req('/habitaciones/' + id);
    if (!res.success) return alert(res.message);
    const h = res.data;
    
    document.getElementById('m-hab-id').value = h.IDHabitacion;
    document.getElementById('m-hab-nombre').value = h.NombreHabitacion;
    document.getElementById('m-hab-est').value = h.Estado ? 'true' : 'false';
    window._currentHabFoto = h.ImagenHabitacion || null;
    document.getElementById('m-hab-foto').value = '';
    const preview = document.getElementById('m-hab-foto-preview');
    if(preview) { if(h.ImagenHabitacion) { preview.innerHTML = '<img src="'+h.ImagenHabitacion+'" style="width:100%; height:auto; display:block;"/>'; preview.style.display='block'; } else { preview.style.display='none'; } }
    document.getElementById('m-hab-title').textContent = 'Editar Habitación';

    const select = document.getElementById('m-hab-cabana');
    const cRes = await req('/cabanas');
    if (cRes.success) {
      select.innerHTML = '<option value="">-- Seleccione Cabaña --</option>' + cRes.data.map(c => `<option value="${c.IDCabaña}" ${c.IDCabaña === h.IDCabaña ? 'selected' : ''}>${c.Nombre}</option>`).join('');
    }
    openM('m-hab');
  } catch (err) {
    console.error(err);
  }
};

window.saveHabitacion = async function() {
  const id = document.getElementById('m-hab-id').value;
  const data = {
    NombreHabitacion: document.getElementById('m-hab-nombre').value,
    IDCabaña: parseInt(document.getElementById('m-hab-cabana').value),
    Estado: document.getElementById('m-hab-est').value === 'true',
    ImagenHabitacion: window._currentHabFoto || undefined
  };

  if (!data.NombreHabitacion || isNaN(data.IDCabaña)) {
    return alert('Completa los campos requeridos.');
  }

  try {
    // If id exists, it's PUT, otherwise POST
    const method = id ? 'PUT' : 'POST';
    const url = id ? '/api/habitaciones/' + id : '/api/habitaciones';
    
    let res = await req(url, method, data);
    
    // Si cambio el estado, usar PATCH para estado
    if (id && res.success) {
      await req('/habitaciones/' + id + '/estado', 'PATCH', { Estado: data.Estado });
    }

    if (res.success) {
      closeM('m-hab');
      loadHabitaciones();
      loadCabanas(); // In case state changed
    } else {
      alert(res.message || 'Error');
    }
  } catch (err) {
    console.error(err);
  }
};

/* ════════ DASHBOARD ════════ */
// Override loadDashboard
window.loadDashboard = async function() {
  try {
    const res = await req('/dashboard');
    if (!res.success) return;
    const stats = res.data;

    document.getElementById('ov-ventas').textContent = '$' + Number(stats.totalSales || 0).toLocaleString('es-CO');
    document.getElementById('ov-total').textContent = stats.totalReservations || 0;
    
    // The rest of ov-pend and ov-bloq can remain unchanged if populated elsewhere, or we could update them here.

    // Chart.js Setup
    if (window.Chart) {
      // Cabanas Chart
      const ctxCabanas = document.getElementById('cabanasChart');
      if (ctxCabanas && !window.cabChartInst) {
        window.cabChartInst = new Chart(ctxCabanas, {
          type: 'doughnut',
          data: {
            labels: stats.topCabins.map(c => c.name),
            datasets: [{
              data: stats.topCabins.map(c => c.value),
              backgroundColor: ['#e85d04', '#faa307', '#ffba08', '#f48c06', '#dc2f02'],
              borderWidth: 0
            }]
          },
          options: {
            plugins: { legend: { position: 'right', labels: { color: '#fff' } } },
            maintainAspectRatio: false
          }
        });
      }

      // Reservas por mes Chart
      const ctxReservas = document.getElementById('reservasChart');
      if (ctxReservas && !window.resChartInst) {
        window.resChartInst = new Chart(ctxReservas, {
          type: 'bar',
          data: {
            labels: stats.reservationsByMonth.map(m => m.month),
            datasets: [{
              label: 'Reservas',
              data: stats.reservationsByMonth.map(m => m.count),
              backgroundColor: '#e85d04',
              borderRadius: 4
            }]
          },
          options: {
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
              x: { grid: { display: false }, ticks: { color: '#fff' } }
            },
            plugins: { legend: { display: false } },
            maintainAspectRatio: false
          }
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};

// Link showSec properly
const oldShowSec = window.showSec;
window.showSec = function(name, btn) {
  if (oldShowSec) oldShowSec(name, btn);
  if (name === 'cabanas') loadCabanas();
  if (name === 'dashboard') loadDashboard();
};


/* ════════ DYNAMIC SERVICES IN RESERVATION ════════ */
async function refreshGlobalServices() {
  try {
    const data = await ServiciosAPI.listar();
    const srvs = data.servicios || data.data || [];
    
    for (const key in SERVICIOS) delete SERVICIOS[key];
    
    let html = '';
    srvs.forEach(s => {
      if (!s.Estado && s.Estado !== 1) return; // Only show active services
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo };
      html += `
        <button type="button" class="srv-chip" id="adm-srv-\${s.IDServicio}" onclick="adminToggleSrv('\${s.IDServicio}')" style="border:1.5px solid rgba(46,26,14,0.15);background:#fff;color:var(--bark);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M5 12l5 5L20 7"/></svg> \${s.NombreServicio} <span class="srv-price" style="margin-left:0.3rem;">+$\${s.Costo/1000}K</span>
        </button>`;
    });

    const srvGrid = document.querySelector('#m-nueva .srv-grid');
    if (srvGrid) srvGrid.innerHTML = html;
  } catch(e) { console.error('Error refreshing services', e); }
}

const oldLoadServicios2 = window.loadServicios;
window.loadServicios = async function() {
  if (oldLoadServicios2) await oldLoadServicios2();
  await refreshGlobalServices();
};

document.addEventListener('DOMContentLoaded', refreshGlobalServices);
// Just in case DOM is already loaded:
refreshGlobalServices();


/* ════════ DYNAMIC PACKAGES IN RESERVATION ════════ */
async function refreshGlobalPackages() {
  try {
    const data = await PaquetesAPI.listar();
    const paqs = data.paquetes || data.data || [];
    
    for (const key in PAQUETES) delete PAQUETES[key];
    
    let html = '';
    let firstPaq = null;
    paqs.forEach(p => {
      if (!p.Estado && p.Estado !== 1) return; // Active only
      if (!firstPaq) firstPaq = p.IDPaquete;
      PAQUETES[p.IDPaquete] = { label: p.NombrePaquete, precio: p.Precio, descripcion: p.Descripcion };
    });
    
    // Fallback default selection
    if (!PAQUETES[ADMIN_NUEVA_RES.paquete] && firstPaq) {
      ADMIN_NUEVA_RES.paquete = firstPaq;
    }

    paqs.forEach(p => {
      if (!PAQUETES[p.IDPaquete]) return;
      const isSelected = ADMIN_NUEVA_RES.paquete == p.IDPaquete;
      html += `
        <button type="button" class="paq-opt \${isSelected?'selected':''}" id="adm-p-\${p.IDPaquete}" onclick="adminSelectPaquete('\${p.IDPaquete}')" style="border:2px solid rgba(46,26,14,0.1);background:#fff;">
          <div class="paq-ico" style="color:var(--amber);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
          <div class="paq-name">\${p.NombrePaquete}</div>
          <div class="paq-desc" style="font-size:0.9rem;color:var(--mist);">\${p.Descripcion||''}</div>
          <div class="paq-price" style="font-size:0.75rem;color:var(--dark-text);">\${p.Precio>0 ? '+'+fCop(p.Precio) : 'Incluido'}</div>
        </button>`;
    });

    const grid = document.getElementById('adm-p-basico')?.parentNode || document.querySelector('#m-nueva .paquete-grid') || document.querySelector('#m-nueva [style*="grid-template-columns:repeat(3"]');
    if (grid) {
      grid.classList.add('paquete-grid');
      grid.innerHTML = html;
    }
    
    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch(e) { console.error('Error refreshing packages', e); }
}

const oldLoadPaquetes2 = window.loadPaquetes;
window.loadPaquetes = async function() {
  if (oldLoadPaquetes2) await oldLoadPaquetes2();
  await refreshGlobalPackages();
};

document.addEventListener('DOMContentLoaded', refreshGlobalPackages);
refreshGlobalPackages();


/* ════════ DYNAMIC CABANAS IN RESERVATION ════════ */
async function refreshGlobalCabanas() {
  try {
    const data = await req('/cabanas');
    const cabanas = data.data || [];
    
    for (const key in CABANAS) delete CABANAS[key];
    
    let html = '';
    let firstCab = null;
    cabanas.forEach(c => {
      if (!c.Estado && c.Estado !== 1) return; // Active only
      if (!firstCab) firstCab = c.IDCabana;
      CABANAS[c.IDCabana] = { label: c.Nombre, precio: c.Costo, descripcion: c.Descripcion, capacidad: c.CapacidadMaxima };
      
      const isSelected = ADMIN_NUEVA_RES.cabana == c.IDCabana;
      html += `<option value="\${c.IDCabana}" \${isSelected?'selected':''}>\${c.Nombre} (\${c.CapacidadMaxima} pers.) — \${fCop(c.Costo)}</option>`;
    });
    
    if (!CABANAS[ADMIN_NUEVA_RES.cabana] && firstCab) {
      ADMIN_NUEVA_RES.cabana = firstCab;
    }
    
    const select = document.getElementById('mn-cab');
    if (select) {
      if (html) select.innerHTML = html;
      else select.innerHTML = '<option value="">No hay cabañas registradas</option>';
    }
    
    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch(e) { console.error('Error refreshing cabanas', e); }
}

const oldLoadCabanas3 = window.loadCabanas;
window.loadCabanas = async function() {
  if (oldLoadCabanas3) await oldLoadCabanas3();
  await refreshGlobalCabanas();
};

document.addEventListener('DOMContentLoaded', refreshGlobalCabanas);
refreshGlobalCabanas();


/* ════════ ROOM PHOTO LOGIC ════════ */
window._currentHabFoto = null;
window.adminPreviewHabFoto = function(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window._currentHabFoto = e.target.result;
      const preview = document.getElementById('m-hab-foto-preview');
      if (preview) {
        preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%; height:auto; display:block;" />';
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
};


/* ════════ DYNAMIC CLIENTS IN RESERVATION ════════ */
async function refreshGlobalClients() {
  try {
    const data = await ClientesAPI.listar();
    const clients = data.clientes || data.data || [];
    
    const select = document.getElementById('mn-doc');
    if (!select) return;

    let html = '<option value="">— Selecciona un cliente —</option>';
    clients.forEach(c => {
      // Ignorar administradores si la API los devuelve
      if (c.IDRol === 1 || c.IdRol === 1 || c.rol === 'admin') return; 
      
      const doc = c.NroDocumento || c.numeroDocumento || '';
      const nom = c.Nombre || c.nombre || '';
      const ape = c.Apellido || c.apellido || '';
      const label = `${doc} - ${nom} ${ape}`.trim();
      
      html += `<option value="${doc}">${label}</option>`;
    });

    select.innerHTML = html;
  } catch(e) { console.error('Error refreshing clients', e); }
}

// Intercept modal open to refresh clients if needed
const oldAdminNuevaReserva = window.adminNuevaReserva;
window.adminNuevaReserva = function() {
  refreshGlobalClients();
  if (oldAdminNuevaReserva) oldAdminNuevaReserva();
};

document.addEventListener('DOMContentLoaded', refreshGlobalClients);
refreshGlobalClients();


/* ════════ SEARCH CLIENT BY EMAIL OR NAME ════════ */
async function modalSearchClientByEmail() {
  const q = document.getElementById('modal-cli-email').value.trim();
  const msg = document.getElementById('modal-cli-msg');
  const sel = document.getElementById('mn-doc');
  
  if (!q) {
    // Si vacían la búsqueda, recargar todos
    msg.innerHTML = '';
    msg.style.color = 'var(--mist)';
    return refreshGlobalClients();
  }
  
  msg.innerHTML = 'Buscando...';
  msg.style.color = 'var(--mist)';
  
  try {
    const data = await ClientesAPI.buscar(q);
    const clis = data.clientes || data.data || [];
    
    // Filtrar admins y poblar selector
    let count = 0;
    let html = '<option value="">— Selecciona un cliente —</option>';
    clis.forEach(c => {
      if (c.IDRol === 1 || c.IdRol === 1 || c.rol === 'admin') return; 
      count++;
      const doc = c.NroDocumento || c.numeroDocumento || '';
      const nom = c.Nombre || c.nombre || '';
      const ape = c.Apellido || c.apellido || '';
      html += `<option value="${doc}">${doc} - ${nom} ${ape}</option>`;
    });
    
    sel.innerHTML = html;
    
    if (count > 0) {
      msg.innerHTML = `Se encontraron ${count} cliente(s)`;
      msg.style.color = '#4caf50'; // green
      // Autoseleccionar el primero si solo hay 1
      if (count === 1) {
        sel.selectedIndex = 1;
        adminResumenUpdate();
      }
    } else {
      msg.innerHTML = 'No se encontró ningún cliente con esos datos';
      msg.style.color = 'var(--fire)';
    }
  } catch(e) {
    msg.innerHTML = 'Error al buscar el cliente';
    msg.style.color = 'var(--fire)';
  }
}
window.modalSearchClientByEmail = modalSearchClientByEmail;
