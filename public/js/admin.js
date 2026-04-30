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
    document.getElementById('ov-conf').textContent  = conf;
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
  } catch {
    ['ov-total','ov-pend','ov-conf','ov-bloq'].forEach(id=>document.getElementById(id).textContent='?');
    document.getElementById('prox-list').innerHTML='<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver datos</p>';
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
