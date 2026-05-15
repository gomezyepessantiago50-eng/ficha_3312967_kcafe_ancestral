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

const ADMIN_NUEVA_RES = { cabana:null, paquete:null, servicios:new Set() };

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
    _cals['admin-cal'] = { y:new Date().getFullYear(), m:new Date().getMonth(), refresh:refreshAdminCal };
  }

  loadDashboard();
  refreshAdminCal();
  loadReservas();
  initNotificaciones();

  // Establecer fecha mínima en inputs de bloqueo (hoy)
  const hoyStr = new Date().toISOString().split('T')[0];
  const bIni = document.getElementById('b-ini');
  const bFin = document.getElementById('b-fin');
  if (bIni) bIni.setAttribute('min', hoyStr);
  if (bFin) bFin.setAttribute('min', hoyStr);

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
}

/* ════════ CALENDARIOS ════════ */
async function fetchAvail() {
  try {
    const d = await ReservasAPI.disponibilidad();
    return { reservadas: d.data?.reservadas || d.reservadas || [], bloqueadas: d.data?.bloqueadas || d.bloqueadas || [], registros: d.data?.registros || d.registros || [] };
  } catch { return { reservadas:[], bloqueadas:[], registros:[] }; }
}
async function refreshAdminCal() {
  const s = _cals?.['admin-cal']; if (!s) return;
  const cabFilter = document.getElementById('cal-cab-filter')?.value || '';
  
  // Always fetch from disponibilidad (includes blockages + reservations)
  const d = await fetchAvail();
  
  if (cabFilter && d.registros) {
    // Filter by cabin using the raw records from disponibilidad
    var reservadas = [], bloqueadas = [];
    d.registros.forEach(function(r) {
      if (String(r.cabana) !== String(cabFilter)) return;
      var dates = rangeDatesClient(r.fecha_inicio, r.fecha_fin);
      if (r.estado === 'bloqueada') {
        bloqueadas = bloqueadas.concat(dates);
      } else if (r.estado === 'pendiente' || r.estado === 'confirmada') {
        reservadas = reservadas.concat(dates);
      }
    });
    buildCal('admin-cal', s.y, s.m, reservadas, bloqueadas, 'onCalDayClick');
  } else {
    // No filter: show everything
    buildCal('admin-cal', s.y, s.m, d.reservadas, d.bloqueadas, 'onCalDayClick');
  }

  // Keep GLOBAL_RESERVAS in sync with full availability (includes blockages)
  if (d.registros && d.registros.length) {
    window.GLOBAL_RESERVAS = d.registros;
  }
}

// Helper: generar array de fechas YYYY-MM-DD entre inicio y fin
function rangeDatesClient(start, end) {
  var dates = [];
  var d = new Date(start + 'T00:00:00');
  var e = new Date(end + 'T00:00:00');
  while (d <= e) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
function prevMonth() { const s=_cals['admin-cal']; s.m--; if(s.m<0){s.m=11;s.y--;} refreshAdminCal(); }
function nextMonth() { const s=_cals['admin-cal']; s.m++; if(s.m>11){s.m=0;s.y++;} refreshAdminCal(); }
function onCalCabChange() { refreshAdminCal(); }

/* FIX 4 */
async function onCalDayClick(ds) {
  document.getElementById('cal-day-title').textContent = 'Reservas — ' + fDate(ds);
  document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Buscando…</p>';
  try {
    const [resResp, blqResp] = await Promise.allSettled([
      fetch(`/api/reservas?limit=500&page=1`, { headers:{ 'Authorization':`Bearer ${Auth.getToken()}` } }).then(r=>r.json()),
      BloqueosAPI.listar()
    ]);
    
    const d = resResp.status === 'fulfilled' ? resResp.value : {};
    const dBlq = blqResp.status === 'fulfilled' ? blqResp.value : {};
    
    const rs = (d.data||[]).filter(r => r.fecha_inicio <= ds && r.fecha_fin >= ds);
    const bs = (dBlq.data||dBlq.bloqueos||[]).filter(b => b.fecha_inicio <= ds && b.fecha_fin >= ds);
    
    let html = '';
    
    if (rs.length === 0 && bs.length === 0) {
      html += '<p style="color:var(--dark-muted);font-size:0.85rem;">Sin reservas o bloqueos para este día</p>';
    } else {
      if (rs.length > 0) {
        html += rs.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${CABANAS[r.cabana]?.label||r.cabana||'—'}</p></div></div>`).join('');
      }
      if (bs.length > 0) {
        html += bs.map(b=>`<div class="r-row" style="border-left-color:var(--danger);"><div class="r-num" style="color:var(--danger);">Bloqueo</div><div class="r-info"><h4>${b.motivo||'Mantenimiento / Bloqueado'}</h4><p>${fDate(b.fecha_inicio)} → ${fDate(b.fecha_fin)}</p></div><button class="btn btn-sm btn-danger" onclick="doDesbloquear(${b.id})" style="margin-left:auto;">Quitar</button></div>`).join('');
      }
    }
      
    html += `
      <div style="margin-top:1.5rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-dark-outline" onclick="adminAbrirBloqueoDia('${ds}')">Bloquear Fecha</button>
      </div>`;
      
    document.getElementById('cal-day-body').innerHTML = html;
  } catch(e) { console.error(e); document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);">Error al cargar</p>'; }
}

window.adminAbrirBloqueoDia = function(ds) {
  document.getElementById('b-ini').value = ds;
  document.getElementById('b-fin').value = ds;
  document.getElementById('b-motivo').value = '';
  openM('m-bloqueo');
};

/* ════════ DASHBOARD ════════ */
/* FIX 5 */
window.loadDashboard = async function() {
  try {
    const token = Auth.getToken();
    
    // Obtenemos los KPIs nuevos (ventas/total), las reservas y bloqueos para el resto de métricas.
    const [resDash, rR, rB] = await Promise.allSettled([
      req('/dashboard'),
      fetch('/api/reservas?limit=500&page=1', { headers:{ 'Authorization':`Bearer ${token}` } }).then(r=>r.json()),
      BloqueosAPI.listar()
    ]);
    
    // Métricas del nuevo dashboard
    if (resDash.status === 'fulfilled' && resDash.value.success) {
      const stats = resDash.value.data;
      document.getElementById('ov-ventas').textContent = '$' + Number(stats.totalSales || 0).toLocaleString('es-CO');
      document.getElementById('ov-total').textContent = stats.totalReservations || 0;
      
      // Chart.js Setup
      if (window.Chart) {
        const ctxCabanas = document.getElementById('cabanasChart');
        if (ctxCabanas && !window.cabChartInst && stats.topCabins) {
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
        if (ctxReservas && !window.resChartInst && stats.reservationsByMonth) {
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
    }

    refreshAdminCal();

    // Métricas anteriores (pendientes, bloqueos, llegadas)
    const rs = rR.status==='fulfilled' ? (rR.value.data||[]) : [];
    window.GLOBAL_RESERVAS = rs;
    const bl = rB.status==='fulfilled' ? (rB.value.data||rB.value.bloqueos||[]) : [];
    
    const pend = rs.filter(r=>r.estado==='pendiente').length;
    
    const ovPendEl = document.getElementById('ov-pend');
    if(ovPendEl) ovPendEl.textContent = pend;
    
    const ovBloqEl = document.getElementById('ov-bloq');
    if(ovBloqEl) ovBloqEl.textContent = bl.length;
    
    const badge = document.getElementById('nb-pend');
    if (badge) {
      badge.textContent = pend || '';
      badge.setAttribute('data-empty', pend===0 ? 'true' : 'false');
    }

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const prox = rs.filter(r=>new Date(r.fecha_inicio+'T00:00:00')>=hoy && r.estado!=='cancelada')
                   .sort((a,b)=>new Date(a.fecha_inicio)-new Date(b.fecha_inicio)).slice(0,5);
                   
    const proxCountEl = document.getElementById('prox-count');
    if(proxCountEl) proxCountEl.textContent = prox.length;
    
    const proxListEl = document.getElementById('prox-list');
    if (proxListEl) {
      proxListEl.innerHTML = prox.length
        ? prox.map(r=>`<div class="r-row"><div class="r-num">#${r.id}</div><div class="r-info"><h4>${r.documento||'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${r.num_personas||1} pers.</p></div><div class="r-right" style="font-size:0.78rem;color:var(--dark-muted);">${CABANAS[r.cabana]?.label||r.cabana||'—'}</div></div>`).join('')
        : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay próximas llegadas</p>';
    }
  } catch(e) {
    console.error('Dashboard Error:', e);
    ['ov-total','ov-pend','ov-ventas','ov-bloq'].forEach(id=>{ const el = document.getElementById(id); if (el) el.textContent='?'; });
    const px = document.getElementById('prox-list');
    if (px) px.innerHTML=`<p style="color:var(--danger);font-size:0.85rem;">Error: ${e.message}</p>`;
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
                <button class="btn btn-sm btn-dark-outline" onclick="abrirVerReserva(${r.id})">Ver</button>
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
    const hoyStr=new Date().toISOString().split('T')[0];
    document.getElementById('m-det-ini').setAttribute('min',hoyStr);
    if (reserva.fecha_inicio) {
      const mf=new Date(reserva.fecha_inicio); mf.setDate(mf.getDate()+1);
      document.getElementById('m-det-fin').setAttribute('min',mf.toISOString().split('T')[0]);
    }
    openM('m-detalle-admin');
  } catch(err) { toast(err.message||'Error','err'); }
}

function mDetRangeCheck() {
  const iniEl=document.getElementById('m-det-ini'), finEl=document.getElementById('m-det-fin');
  const ini=iniEl.value; const hoyStr=new Date().toISOString().split('T')[0];
  if (ini&&ini<hoyStr) { iniEl.value=''; finEl.value=''; return; }
  if (ini&&finEl.value&&new Date(finEl.value)<new Date(ini)) finEl.value='';
  if (ini) { finEl.setAttribute('min',ini); }
}

async function guardarDetalleReserva() {
  if (!_viewId) return;
  const ini=document.getElementById('m-det-ini').value, fin=document.getElementById('m-det-fin').value;
  const cabana=document.getElementById('m-det-cabana').value, paquete=document.getElementById('m-det-paquete').value;
  const personas=Number(document.getElementById('m-det-personas').value)||1;
  const notas=document.getElementById('m-det-notas').value.trim();
  const alertEl=document.getElementById('m-det-alert');
  const hoyStr=new Date().toISOString().split('T')[0];
  if (!ini||!fin) { alertEl.innerHTML=`<div class="alert alert-error">⚠ Selecciona fechas.</div>`; return; }
  if (ini<hoyStr)  { alertEl.innerHTML=`<div class="alert alert-error">⚠ Fecha inicio debe ser desde hoy.</div>`; return; }
  if (new Date(fin)<new Date(ini)) { alertEl.innerHTML=`<div class="alert alert-error">⚠ Fecha fin debe ser igual o posterior.</div>`; return; }
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
  // Toggle: click again on selected package to deselect
  if (ADMIN_NUEVA_RES.paquete === key) {
    ADMIN_NUEVA_RES.paquete = null;
  } else {
    ADMIN_NUEVA_RES.paquete = key;
  }
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn =>
    btn.classList.toggle('selected', btn.id === `adm-p-${ADMIN_NUEVA_RES.paquete}`)
  );
  
  const paq = ADMIN_NUEVA_RES.paquete ? PAQUETES[ADMIN_NUEVA_RES.paquete] : null;
  const includedIds = paq && paq.serviciosIncluidos
    ? (Array.isArray(paq.serviciosIncluidos) ? paq.serviciosIncluidos : JSON.parse(paq.serviciosIncluidos))
    : [];
  
  document.querySelectorAll('.srv-chip').forEach(btn => {
    const srvId = btn.id.replace('adm-srv-', '');
    const isIncluded = includedIds.some(id => String(id) === String(srvId));
    if (isIncluded) {
      ADMIN_NUEVA_RES.servicios.delete(srvId);
      btn.classList.remove('selected');
      btn.classList.add('disabled');
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      btn.title = 'Incluido en el paquete seleccionado';
    } else {
      btn.classList.remove('disabled');
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.title = '';
    }
  });

  adminResumenUpdate();
}
function adminToggleSrv(key) {
  ADMIN_NUEVA_RES.servicios.has(key)?ADMIN_NUEVA_RES.servicios.delete(key):ADMIN_NUEVA_RES.servicios.add(key);
  document.getElementById(`adm-srv-${key}`)?.classList.toggle('selected',ADMIN_NUEVA_RES.servicios.has(key));
  adminResumenUpdate();
}


// Filtra cabañas disponibles según fechas seleccionadas y actualiza el select
async function adminResumenUpdate() {
  const ini = document.getElementById('mn-ini').value;
  const fin = document.getElementById('mn-fin').value;
  const select = document.getElementById('mn-cab');
  const prompt = document.getElementById('mn-cab-prompt');
  let valido = false;
  let disponibles = [];

  if (ini && fin && new Date(fin) >= new Date(ini)) {
    valido = true;
    // Obtener reservas y bloqueos globales
    const reservas = window.GLOBAL_RESERVAS || [];
    // Buscar cabañas ocupadas en el rango
    const ocupadas = new Set();
    reservas.forEach(r => {
      // Si hay cruce de fechas
      if (
        (r.fecha_inicio <= fin && r.fecha_fin >= ini) &&
        ['confirmada', 'pendiente', 'bloqueada'].includes(r.estado)
      ) {
        ocupadas.add(r.cabana);
      }
    });
    // Filtrar cabañas disponibles
    disponibles = Object.entries(CABANAS)
      .filter(([key]) => !ocupadas.has(key))
      .map(([key, cab]) => ({ key, ...cab }));
    // Guardar la cabaña seleccionada antes de repoblar
    const prevCab = ADMIN_NUEVA_RES.cabana;
    // Actualizar select
    if (select) {
      select.innerHTML = disponibles.length
        ? '<option value="">Selecciona una cabaña...</option>' +
          disponibles.map(c => `<option value="${c.key}">${c.label} (${c.capacidad} pers.) — ${fCop(c.precio)}</option>`).join('')
        : '<option value="">No hay cabañas disponibles</option>';
      select.disabled = !disponibles.length;
      // Si la cabaña anterior sigue disponible, mantenerla seleccionada
      if (prevCab && disponibles.some(c => c.key === prevCab)) {
        select.value = prevCab;
        ADMIN_NUEVA_RES.cabana = prevCab;
      } else {
        // Solo limpiar la selección si la anterior ya no está disponible
        ADMIN_NUEVA_RES.cabana = null;
        select.value = '';
      }
    }
    if (prompt) {
      prompt.textContent = disponibles.length ? '' : '(No hay cabañas disponibles para esas fechas)';
    }
  } else {
    // Fechas no válidas: deshabilitar select y mostrar prompt
    if (select) {
      select.innerHTML = '<option value="">Selecciona fechas...</option>';
      select.disabled = true;
      // No limpiar la selección de fechas aquí
    }
    if (prompt) {
      prompt.textContent = '(Selecciona fechas primero)';
    }
    ADMIN_NUEVA_RES.cabana = null;
  }

  // Mostrar resumen de precio solo si hay selección válida
  const cabKey = ADMIN_NUEVA_RES.cabana;
  const cab = cabKey ? CABANAS[cabKey] : null;
  const paq = ADMIN_NUEVA_RES.paquete ? PAQUETES[ADMIN_NUEVA_RES.paquete] : { label: 'Ninguno', precio: 0 };
  const srvs = Array.from(ADMIN_NUEVA_RES.servicios).map(s => SERVICIOS[s]).filter(Boolean);
  const srvP = srvs.reduce((a, s) => a + s.precio, 0);
  const noches = (ini && fin && valido && cab) ? nights(ini, fin) : 0;
  const rawSub = cab ? (cab.precio + paq.precio) * Math.max(noches, 1) + srvP * cab.capacidad : 0;
  const { subtotal, iva, total } = calcMontos(rawSub);
  const body = document.getElementById('admin-price-body'), totalRow = document.getElementById('admin-price-total');
  if (!valido || !cab) {
    body.innerHTML = '<p style="color:rgba(100,80,60,0.6);text-align:center;font-size:0.85rem;">Selecciona fechas y cabaña válidas</p>';
    if (totalRow) totalRow.style.display = 'none';
    return;
  }
  body.innerHTML = `
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} × ${noches} noche(s)</span></div>
    ${cab.ubicacion ? `<div class="price-row" style="padding-top:0;"><span class="pk" style="font-size:0.75rem;">Ubicación</span><span class="pv" style="font-size:0.75rem;font-weight:normal;color:var(--dark-muted);">${cab.ubicacion}</span></div>` : ''}
    <div class="price-row"><span class="pk">Precio/noche</span><span class="pv">${fCop(cab.precio)}</span></div>
    <div class="price-row"><span class="pk">Paquete</span><span class="pv">${paq.label} ${paq.precio ? `+${fCop(paq.precio)}` : ''}</span></div>
    ${srvs.map(s => `<div class="price-row"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio)}</span></div>`).join('')}
    <div class="price-row" style="border-top:1px solid rgba(46,26,14,0.12);margin-top:0.4rem;padding-top:0.4rem;">
      <span class="pk">Subtotal</span><span class="pv">${fCop(subtotal)}</span>
    </div>
    <div class="price-row"><span class="pk">IVA (19%)</span><span class="pv">${fCop(iva)}</span></div>
    <div style="margin-top:0.5rem;padding:0.5rem;background:rgba(232,93,4,0.1);border-radius:4px;text-align:center;font-size:0.8rem;color:var(--fire);">
      <strong>🕒 Check-in:</strong> 1:00 PM | <strong>Check-out:</strong> 12:00 PM
    </div>`;
  const tEl = document.getElementById('admin-pt-val'); if (tEl) tEl.textContent = fCop(total);
  if (totalRow) totalRow.style.display = 'flex';
}

async function doNuevaAdmin() {
  const ini=document.getElementById('mn-ini').value, fin=document.getElementById('mn-fin').value;
  const cab=document.getElementById('mn-cab').value;
  const doc=document.getElementById('mn-doc').value.trim();
  const alertEl=document.getElementById('mn-alert');
  
  if (!doc) { alertEl.innerHTML='<div class="alert alert-error">⚠ Ingresa el documento del cliente.</div>'; return; }
  if (!ini) { alertEl.innerHTML='<div class="alert alert-error">⚠ Selecciona la fecha de inicio.</div>'; return; }
  if (!fin) { alertEl.innerHTML='<div class="alert alert-error">⚠ Selecciona la fecha de fin.</div>'; return; }
  
  const method = 'tarjeta';
  let comprobante = '';
  
  const tNum = document.getElementById('mn-tarjeta-num').value.replace(/\s+/g,'');
  const tTitular = document.getElementById('mn-tarjeta-titular').value.trim();
  const tExp = document.getElementById('mn-tarjeta-exp').value.trim();
  const tCvv = document.getElementById('mn-tarjeta-cvv').value.trim();
  
  if (tNum.length < 14 || !/^\d+$/.test(tNum)) { alertEl.innerHTML='<div class="alert alert-error">⚠ Número de tarjeta inválido.</div>'; return; }
  if (!tTitular) { alertEl.innerHTML='<div class="alert alert-error">⚠ Ingresa el titular de la tarjeta.</div>'; return; }
  if (!tExp) { alertEl.innerHTML='<div class="alert alert-error">⚠ Ingresa la fecha de vencimiento.</div>'; return; }
  if (!tCvv || tCvv.length < 3) { alertEl.innerHTML='<div class="alert alert-error">⚠ CVV inválido.</div>'; return; }
  
  comprobante = 'XXXX-XXXX-XXXX-' + tNum.slice(-4);

  const [y,m,d]=ini.split('-').map(Number); const start=new Date(y,m-1,d);
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  if (start<hoy) { alertEl.innerHTML=`<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de hoy.</div>`; return; }
  try {
    const noches=nights(ini,fin); const cabData=CABANAS[cab]; const paqData=ADMIN_NUEVA_RES.paquete ? PAQUETES[ADMIN_NUEVA_RES.paquete] : { precio: 0 };
    const serviciosArr=Array.from(ADMIN_NUEVA_RES.servicios);
    const srvP=serviciosArr.reduce((acc,k)=>acc+(SERVICIOS[k]?.precio||0),0);
    const rawSub=(cabData.precio+paqData.precio)*Math.max(noches,1)+srvP*cabData.capacidad;
    const {subtotal,iva,total}=calcMontos(rawSub);
    
    // Para tarjeta cobramos el monto total de la reserva
    let monto = total;
    
    await ReservasAPI.crear({ 
      NroDocumentoCliente:doc, FechaInicio:ini, FechaFinalizacion:fin, 
      SubTotal:subtotal, Descuento:0, IVA:iva, MontoTotal:total, 
      MetodoPago:method, num_personas:cabData.capacidad, cabana:cab, 
      paquete:ADMIN_NUEVA_RES.paquete, servicios:serviciosArr,
      comprobante_pago: comprobante, monto_pagado: monto
    });
    
    closeM('m-nueva'); 
    adminResetNuevaRES(); 
    loadReservas(1); 
    loadDashboard();
    openM('m-success');
    // Notificacion directa e inmediata en la campana
    notificarNuevaReservaDirecta();
  } catch(e) { alertEl.innerHTML=`<div class="alert alert-error">⚠ ${e.message}</div>`; }
}

function adminResetNuevaRES() {
  ADMIN_NUEVA_RES.cabana = null;
  ADMIN_NUEVA_RES.paquete = null;
  ADMIN_NUEVA_RES.servicios.clear();
  ['mn-ini', 'mn-fin'].forEach(id => document.getElementById(id).value = '');
  const cabSel = document.getElementById('mn-cab');
  if (cabSel) {
    cabSel.value = '';
    cabSel.disabled = true;
    cabSel.innerHTML = '<option value="">Selecciona fechas...</option>';
  }
  const cabPrompt = document.getElementById('mn-cab-prompt');
  if (cabPrompt) cabPrompt.textContent = '(Selecciona fechas primero)';
  document.getElementById('mn-doc').value = '';
  const searchInput = document.getElementById('mn-cli-search'); if (searchInput) searchInput.value = '';
  const selDiv = document.getElementById('mn-cli-selected'); if (selDiv) { selDiv.style.display = 'none'; selDiv.innerHTML = ''; }
  const resDiv = document.getElementById('mn-cli-results'); if (resDiv) { resDiv.style.display = 'none'; resDiv.innerHTML = ''; }
  document.getElementById('mn-alert').innerHTML = '';
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn => btn.classList.remove('selected'));
  document.querySelectorAll('.srv-chip[id^="adm-srv-"]').forEach(btn => btn.classList.remove('selected'));

  ['mn-tarjeta-num', 'mn-tarjeta-titular', 'mn-tarjeta-exp', 'mn-tarjeta-cvv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
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
  const cab=document.getElementById('cal-cab-filter')?.value;
  const alEl=document.getElementById('blq-alert');
  if (!cab) { alEl.innerHTML='<div class="alert alert-error">\u26a0 Selecciona una caba\u00f1a en el calendario antes de bloquear.</div>'; return; }
  if (!ini||!fin) { alEl.innerHTML='<div class="alert alert-error">⚠ Selecciona las fechas</div>'; return; }

  // Validar que no sean fechas pasadas
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [yi,mi,di] = ini.split('-').map(Number);
  const fechaIni = new Date(yi, mi-1, di);
  if (fechaIni < hoy) {
    alEl.innerHTML='<div class="alert alert-error">⚠ La fecha de inicio no puede ser en el pasado</div>'; return;
  }
  if (new Date(fin)<new Date(ini)) { alEl.innerHTML='<div class="alert alert-error">⚠ Fecha fin no puede ser anterior al inicio</div>'; return; }
  try {
    await BloqueosAPI.crear({ FechaInicio:ini, FechaFinalizacion:fin, Motivo:document.getElementById('b-motivo').value, cabana: cab });
    alEl.innerHTML=''; ['b-ini','b-fin','b-motivo'].forEach(id=>{if(document.getElementById(id))document.getElementById(id).value=''});
    closeM('m-bloqueo');
    toast('Fechas bloqueadas','ok'); refreshAdminCal();
    loadDashboard();
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
  try { await BloqueosAPI.eliminar(id); toast('Fecha desbloqueada','ok'); loadBloqueos(); refreshAdminCal(); }
  catch(e) { toast(e.message,'err'); }
}

/* ════════ USUARIOS — LISTADO PAGINADO ════════ */
let _usuarioActual = null;
let _rolSeleccion  = null;
const _usrPag = { currentPage: 1, totalPages: 1, total: 0, limit: 10 };

// Helper: generar fila de usuario
function _usrRow(u) {
    const isActivo = u.estado !== 'inactivo';
    const isAdmin = u.rol === 'admin';
    const safeEmail = (u.email||'').replace(/'/g,"\\'");
    
    return `<tr>
      <td style="font-family:var(--font-display);font-weight:800;color:var(--fire);">#${u.id}</td>
      <td><strong>${u.nombre || ''}</strong> ${u.apellido || ''}</td>
      <td>${u.email || '\u2014'}</td>
      <td>${u.telefono || '\u2014'}</td>
      <td>
        <label class="toggle-label" title="Cambiar rol">
          <span style="font-size:0.75rem; color:${isAdmin ? 'var(--fire)' : '#4caf50'};">${isAdmin ? 'Admin' : 'Cliente'}</span>
          <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
            <input type="checkbox" onchange="toggleUsuarioRol('${u.id}', this)" ${isAdmin ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </div>
        </label>
      </td>
      <td>
        <label class="toggle-label" title="Cambiar estado">
          <span style="font-size:0.75rem; color:var(--dark-muted);">${isActivo ? 'Activo' : 'Inactivo'}</span>
          <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
            <input type="checkbox" onchange="toggleEstadoGlobal('usuarios', '${u.id}', this)" ${isActivo ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </div>
        </label>
      </td>
      <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
        <button class="btn btn-sm btn-dark-outline" onclick="usrAbrirReset(${u.id},'${safeEmail}')" title="Restablecer contraseña">Clave</button>
        <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:rgba(239,83,80,0.3);" onclick="usrAbrirEliminar(${u.id},'${safeEmail}')" title="Eliminar cuenta">Eliminar</button>
      </div></td>
    </tr>`;
  }

// Cargar listado de usuarios
window.loadUsuariosAdmin = async function(page = 1) {
  const adminTb = document.getElementById('usr-admin-tbody');
  const cliTb   = document.getElementById('usr-cli-tbody');
  if (!adminTb || !cliTb) return;

  const q = document.getElementById('fil-usuario-q')?.value?.trim() || '';
  try {
    const params = new URLSearchParams({ page, limit: _usrPag.limit });
    if (q) params.append('q', q);
    const data = await req(`/usuarios?${params}`);
    const admins   = data.admins   || [];
    const clientes = data.clientes || [];
    _usrPag.currentPage = data.currentPage || 1;
    _usrPag.totalPages  = data.totalPages  || 1;
    _usrPag.total       = data.total       || 0;

    // Contador
    const countEl = document.getElementById('usr-count');
    if (countEl) countEl.textContent = `${_usrPag.total} usuario(s)`;
    document.getElementById('usr-admin-count').textContent = admins.length;
    document.getElementById('usr-cli-count').textContent = clientes.length;

    // Admins
    adminTb.innerHTML = admins.length
      ? admins.map(_usrRow).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--dark-muted);font-size:0.85rem;">No hay administradores en esta página</td></tr>';

    // Clientes
    cliTb.innerHTML = clientes.length
      ? clientes.map(_usrRow).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--dark-muted);font-size:0.85rem;">No hay clientes en esta página</td></tr>';

    // Paginación
    _updateUsrPag();
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    adminTb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--fire);">Error al cargar</td></tr>';
    cliTb.innerHTML   = '<tr><td colspan="7" style="text-align:center;color:var(--fire);">Error al cargar</td></tr>';
  }
};

function _updateUsrPag() {
  const el = document.getElementById('usr-pagination'); if (!el) return;
  const { currentPage, totalPages } = _usrPag;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;padding:1rem;">
    <button class="btn btn-sm btn-dark-outline" onclick="usrGoToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
    <span style="color:var(--dark-muted);font-size:0.85rem;">Página ${currentPage} de ${totalPages}</span>
    <button class="btn btn-sm btn-dark-outline" onclick="usrGoToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
  </div>`;
}
window.usrGoToPage = function(p) { if (p < 1 || p > _usrPag.totalPages) return; loadUsuariosAdmin(p); };
window.usrSearch = function() { loadUsuariosAdmin(1); };
window.usrClearSearch = function() { document.getElementById('fil-usuario-q').value = ''; loadUsuariosAdmin(1); };
let _usrDebounce = null;
window.usrLiveSearch = function() { clearTimeout(_usrDebounce); _usrDebounce = setTimeout(() => loadUsuariosAdmin(1), 300); };

/* ── Cambiar Rol (desde tabla) ── */
window.usrAbrirCambioRol = function(id, rolActual, email) {
  _usuarioActual = { id, rol: rolActual, email };
  _rolSeleccion = rolActual;
  document.getElementById('m-rol-email').textContent = email;
  document.getElementById('m-rol-alert').innerHTML   = '';
  setRolSeleccion(rolActual);
  openM('m-rol');
};

function setRolSeleccion(rol) {
  _rolSeleccion = rol;
  const btnCliente = document.getElementById('m-rol-btn-cliente');
  const btnAdmin   = document.getElementById('m-rol-btn-admin');
  if (rol === 'cliente') {
    btnCliente.style.border     = '2px solid var(--fire)';
    btnCliente.style.background = 'rgba(232,93,4,0.08)';
    btnAdmin.style.border       = '2px solid var(--dark-border)';
    btnAdmin.style.background   = 'var(--dark-card2)';
  } else {
    btnAdmin.style.border       = '2px solid var(--fire)';
    btnAdmin.style.background   = 'rgba(232,93,4,0.08)';
    btnCliente.style.border     = '2px solid var(--dark-border)';
    btnCliente.style.background = 'var(--dark-card2)';
  }
}

async function confirmarCambioRol() {
  if (!_usuarioActual || !_rolSeleccion) return;
  try {
    await UsuariosAPI.cambiarRol(_usuarioActual.id, _rolSeleccion);
    closeM('m-rol');
    toast(`Rol cambiado a ${_rolSeleccion} correctamente`, 'ok');
    loadUsuariosAdmin(_usrPag.currentPage);
  } catch(err) {
    document.getElementById('m-rol-alert').innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}

/* ── Eliminar Usuario (desde tabla) ── */
window.usrAbrirEliminar = function(id, email) {
  _usuarioActual = { id, email };
  document.getElementById('m-del-usuario-email').textContent = email;
  openM('m-del-usuario');
};

async function confirmarEliminarUsuario() {
  if (!_usuarioActual) return;
  try {
    await UsuariosAPI.eliminar(_usuarioActual.id);
    closeM('m-del-usuario');
    toast('Cuenta eliminada correctamente', 'ok');
    loadUsuariosAdmin(_usrPag.currentPage);
  } catch(err) { toast(err.message, 'err'); }
}

/* ── Reset Password (desde tabla) ── */
window.usrAbrirReset = function(id, email) {
  _usuarioActual = { id, email };
  document.getElementById('m-reset-email').textContent    = email;
  document.getElementById('m-reset-result').style.display = 'none';
  document.getElementById('m-reset-content').style.display= 'block';
  document.getElementById('m-reset-ft').innerHTML = `
    <button class="btn btn-dark-outline" onclick="closeM('m-reset-usuario')">Cancelar</button>
    <button class="btn btn-fire" onclick="confirmarResetUsuario()">Generar enlace</button>`;
  openM('m-reset-usuario');
};

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


/* ════════════════════════════════════════════════════════
   NOTIFICACIONES — polling cada 60s
════════════════════════════════════════════════════════ */
// Migración automática: limpiar sistema viejo y arrancar fresco
if (!localStorage.getItem('kafe_notif_v2')) {
  localStorage.removeItem('kafe_notif_maxId');
  localStorage.removeItem('kafe_notif_leidas');
  localStorage.setItem('kafe_notif_v2', '1');
}
let _notifMaxId          = parseInt(localStorage.getItem('kafe_notif_maxId') || '0');
let _notifLeidas         = JSON.parse(localStorage.getItem('kafe_notif_leidas') || '[]');
let _notifLista = JSON.parse(localStorage.getItem('kafe_notif_lista') || '[]');
let _notifPanelAbierto   = false;
let _notifTimer          = null;

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  _notifPanelAbierto = !_notifPanelAbierto;
  panel.classList.toggle('open', _notifPanelAbierto);
  
  if (_notifPanelAbierto) {
    renderNotifPanel();
    if (_notifTimer) clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => {
      _notifLista = [];
      _notifLeidas = [];
      localStorage.setItem('kafe_notif_lista', '[]');
      localStorage.setItem('kafe_notif_leidas', '[]');
      renderNotifPanel();
      document.getElementById('notif-btn')?.classList.remove('has-new');
    }, 120000); // 2 minutos
  }
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
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    });
    const d  = await resp.json();
    const rs = d.data || [];

    const maxActual = rs.reduce((mx, r) => Math.max(mx, r.id), 0);

    // FIX: Si maxActual es mucho menor que _notifMaxId (ej: se borró BD en desarrollo), resetear
    if (maxActual < _notifMaxId) {
      _notifMaxId = maxActual;
      localStorage.setItem('kafe_notif_maxId', String(_notifMaxId));
      return; // No hay notificaciones nuevas reales
    }

    // Detectar reservas con ID mayor al máximo conocido
    const nuevas = rs.filter(r => r.id > _notifMaxId && r.estado !== 'bloqueada');

    if (nuevas.length > 0) {
      nuevas.forEach(r => {
        const nid = `res-${r.id}`;
        if (!_notifLista.find(n => n.id === nid)) {
          _notifLista.unshift({
            id: nid,
            mensaje: `Nueva reserva #${r.id} — ${r.cabana ? (CABANAS[r.cabana]?.label || r.cabana) : 'Cabaña'} · ${r.documento || 'Cliente'}`,
            timestamp: Date.now(),
          });
          if (typeof toast === 'function') toast(`🔔 Nueva reserva recibida (#${r.id})`, 'ok');
        }
      });

      _notifLista = _notifLista.slice(0, 20);
      localStorage.setItem('kafe_notif_lista', JSON.stringify(_notifLista));

      const noLeidas = _notifLista.filter(n => !_notifLeidas.includes(n.id));
      if (noLeidas.length > 0) {
        const btn = document.getElementById('notif-btn');
        btn?.classList.add('has-new');
      }

      if (_notifPanelAbierto) renderNotifPanel();
      
      // Auto-refresh UI components if new reservations arrive
      if (typeof loadReservas === 'function' && typeof _pag !== 'undefined') loadReservas(_pag.currentPage);
      if (typeof loadDashboard === 'function') loadDashboard();
    }

    _notifMaxId = maxActual;
    localStorage.setItem('kafe_notif_maxId', String(_notifMaxId));
  } catch { /* silencioso */ }
}

/* Notificación directa: se llama inmediatamente tras crear reserva.
   No depende de polling, timestamps ni localStorage. Es 100% fiable. */
function notificarNuevaReservaDirecta() {
  const ahora = Date.now();
  const nid = `res-directo-${ahora}`;
  _notifLista.unshift({
    id: nid,
    mensaje: '🆕 Nueva reserva creada exitosamente',
    timestamp: ahora,
  });
  _notifLista = _notifLista.slice(0, 20);
      localStorage.setItem('kafe_notif_lista', JSON.stringify(_notifLista));
  const btn = document.getElementById('notif-btn');
  if (btn) btn.classList.add('has-new');
  if (_notifPanelAbierto) renderNotifPanel();
}

function initNotificaciones() {
  setTimeout(async () => {
    try {
      const token = Auth.getToken(); if (!token) return;
      const resp  = await fetch('/api/reservas?limit=500&page=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d  = await resp.json();
      const rs = d.data || [];
      // Registrar el ID máximo actual como línea base
      const maxActual = rs.reduce((mx, r) => Math.max(mx, r.id), 0);
      if (_notifMaxId === 0) {
        _notifMaxId = maxActual;
        localStorage.setItem('kafe_notif_maxId', String(_notifMaxId));
        const idsExistentes = rs.map(r => `res-${r.id}`);
        _notifLeidas = [...new Set([..._notifLeidas, ...idsExistentes])];
        localStorage.setItem('kafe_notif_leidas', JSON.stringify(_notifLeidas));
      } else {
        checkNuevasReservas();
      }
    } catch { /* silencioso */ }
    setInterval(checkNuevasReservas, 5000);
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
        <div class="cab-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3>${c.Nombre}</h3>
            <label class="toggle-label" title="Cambiar estado">
              <span style="font-size:0.75rem; color:var(--dark-muted);">${c.Estado ? 'Activa' : 'Inactiva'}</span>
              <div class="toggle-switch">
                <input type="checkbox" onchange="toggleEstadoGlobal('cabanas', '${c.IDCabana}', this)" ${c.Estado ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
          <p style="height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${c.Descripcion || 'Sin descripción'}</p>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${c.CapacidadMaxima} pers.</span>
            <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;"><path d="M3 22v-8"/><path d="M21 22v-8"/><path d="M3 14h18"/><path d="M7 14v-4a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v4"/><path d="M12 6V2"/></svg> ${c.NumeroHabitaciones} hab.</span>
            ${c.Ubicacion ? `<span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${c.Ubicacion}</span>` : ''}
          </div>
          <div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--fire);">$${Number(c.Costo).toLocaleString('es-CO')}<small style="font-size:0.7rem;color:var(--mist);font-family:var(--font-body);font-weight:400;">/noche</small></div>
        </div>
        <div class="cab-foot" style="padding:0 1.1rem 1.1rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
          <button class="btn btn-sm btn-dark-outline" onclick="adminVerCabana('${c.IDCabana}')">Ver</button>
          <button class="btn btn-sm btn-dark-outline" onclick="adminEditarCabana('${c.IDCabana}')">Editar</button>
          <button class="btn btn-sm btn-dark-outline" style="color:var(--danger);border-color:rgba(239,83,80,0.3);" onclick="adminEliminarCabana('${c.IDCabana}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('cab-grid');
    if (grid) grid.innerHTML = `<div style="grid-column: 1 / -1; color: red;">Error: ${error.message} - ${error.stack}</div>`;
  }
}

window.adminVerCabana = async function(id) {
  try {
    const res = await req('/cabanas/' + id);
    if (!res.success) return alert(res.message || 'Error al obtener cabaña');
    const c = res.data;
    
    document.getElementById('m-vc-body').innerHTML = `
      <div style="margin-bottom:1rem;">
          <h4 style="color:var(--fire);font-size:1.4rem;margin-bottom:0.5rem;">${c.Nombre}</h4>
          ${c.Estado ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-danger">Inactiva</span>'}
          <p style="color:var(--mist);margin-top:0.8rem;">${c.Descripcion || 'Sin descripción'}</p>
          ${c.Ubicacion ? `<p style="color:var(--mist);margin-top:0.4rem;font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${c.Ubicacion}</p>` : ''}
      </div>
      <div style="display:flex; gap: 1rem; margin-bottom:1.5rem;">
          <div style="flex:1; background:var(--dark-bg); padding:1rem; border-radius:8px; border:1px solid var(--dark-border);">
              <div style="font-size:0.8rem; color:var(--dark-muted); margin-bottom:0.3rem;">Precio por Noche</div>
              <div style="color:var(--fire); font-weight:bold; font-size:1.1rem;">$${Number(c.Costo).toLocaleString('es-CO')}</div>
          </div>
          <div style="flex:1; background:var(--dark-bg); padding:1rem; border-radius:8px; border:1px solid var(--dark-border);">
              <div style="font-size:0.8rem; color:var(--dark-muted); margin-bottom:0.3rem;">Capacidad</div>
              <div style="color:var(--dark-text); font-weight:bold; font-size:1.1rem;">${c.CapacidadMaxima} pers.</div>
          </div>
          <div style="flex:1; background:var(--dark-bg); padding:1rem; border-radius:8px; border:1px solid var(--dark-border);">
              <div style="font-size:0.8rem; color:var(--dark-muted); margin-bottom:0.3rem;">Habitaciones</div>
              <div style="color:var(--dark-text); font-weight:bold; font-size:1.1rem;">${c.NumeroHabitaciones}</div>
          </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div>
              <strong style="display:block;margin-bottom:0.5rem;color:var(--dark-text);">Foto de la Cabaña</strong>
              ${c.ImagenCabana ? '<img src="'+c.ImagenCabana+'" style="width:100%; border-radius:8px; border:1px solid var(--dark-border);"/>' : '<div style="padding:2rem; background:var(--dark-bg); border-radius:8px; text-align:center; color:var(--dark-muted);">Sin foto</div>'}
          </div>
          <div>
              <strong style="display:block;margin-bottom:0.5rem;color:var(--dark-text);">Foto de las Habitaciones</strong>
              ${c.ImagenHabitacion ? '<img src="'+c.ImagenHabitacion+'" style="width:100%; border-radius:8px; border:1px solid var(--dark-border);"/>' : '<div style="padding:2rem; background:var(--dark-bg); border-radius:8px; text-align:center; color:var(--dark-muted);">Sin foto</div>'}
          </div>
      </div>
    `;
    openM('m-view-cab');
  } catch(err) {
    console.error(err);
    toast('Error al cargar cabaña', 'err');
  }
};

window.adminNuevaCabana = function() {
  document.getElementById('m-cab-id').value = '';
  document.getElementById('m-cab-nombre').value = '';
  document.getElementById('m-cab-desc').value = '';
  document.getElementById('m-cab-ubica').value = '';
  document.getElementById('m-cab-cap').value = '';
  document.getElementById('m-cab-costo').value = '';
  document.getElementById('m-cab-numhab').value = '1';
  document.getElementById('m-cab-est').value = 'true';
  document.getElementById('m-cab-img-cabana').value = '';
  document.getElementById('m-cab-img-hab').value = '';
  document.getElementById('preview-cabana').innerHTML = '';
  document.getElementById('preview-hab').innerHTML = '';
  window._imgCabanaBase64 = null;
  window._imgHabBase64 = null;
  document.getElementById('m-cab-title').textContent = 'Nueva Cabaña';
  openM('m-cab');
};

window.adminEditarCabana = async function(id) {
  try {
    const res = await req('/cabanas/' + id);
    if (!res.success) return alert(res.message || 'Error al obtener cabaña');
    const c = res.data;
    document.getElementById('m-cab-id').value = c.IDCabana;
    document.getElementById('m-cab-nombre').value = c.Nombre;
    document.getElementById('m-cab-desc').value = c.Descripcion || '';
    document.getElementById('m-cab-ubica').value = c.Ubicacion || '';
    document.getElementById('m-cab-cap').value = c.CapacidadMaxima;
    document.getElementById('m-cab-costo').value = c.Costo;
    document.getElementById('m-cab-numhab').value = c.NumeroHabitaciones;
    document.getElementById('m-cab-est').value = c.Estado ? 'true' : 'false';
    document.getElementById('m-cab-title').textContent = 'Editar Cabaña';
    document.getElementById('m-cab-img-cabana').value = '';
    document.getElementById('m-cab-img-hab').value = '';
    window._imgCabanaBase64 = c.ImagenCabana || null;
    window._imgHabBase64 = c.ImagenHabitacion || null;
    document.getElementById('preview-cabana').innerHTML = c.ImagenCabana ? '<img src="'+c.ImagenCabana+'" style="width:100%;height:auto;display:block;"/>' : '';
    document.getElementById('preview-hab').innerHTML = c.ImagenHabitacion ? '<img src="'+c.ImagenHabitacion+'" style="width:100%;height:auto;display:block;"/>' : '';
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
    Ubicacion: document.getElementById('m-cab-ubica').value,
    CapacidadMaxima: parseInt(document.getElementById('m-cab-cap').value),
    Costo: parseFloat(document.getElementById('m-cab-costo').value),
    NumeroHabitaciones: parseInt(document.getElementById('m-cab-numhab').value),
    Estado: document.getElementById('m-cab-est').value === 'true',
    ImagenCabana: window._imgCabanaBase64 || undefined,
    ImagenHabitacion: window._imgHabBase64 || undefined
  };

  if (!data.Nombre || isNaN(data.CapacidadMaxima) || isNaN(data.Costo) || isNaN(data.NumeroHabitaciones)) {
    return alert('Por favor, completa los campos requeridos correctamente.');
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const path = id ? '/cabanas/' + id : '/cabanas';
    await req(path, { method, body: JSON.stringify(data) });
    closeM('m-cab');
    if (window.loadCabanas) loadCabanas();
    if (window.loadHabitaciones) loadHabitaciones();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error al guardar cabaña');
  }
};

window.adminEliminarCabana = async function(id) {
  if (!confirm('¿Estás seguro de eliminar esta cabaña? Se eliminarán también sus habitaciones.')) return;
  try {
    const res = await req('/cabanas/' + id, 'DELETE');
    if (res.success) {
      loadCabanas();
    } else {
      alert(res.message || 'Error al eliminar cabaña');
    }
  } catch (err) {
    console.error(err);
  }
};

window.previewImage = function(input, previewId) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        // Create canvas to resize and compress image
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress as JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        document.getElementById(previewId).innerHTML = '<img src="'+compressedBase64+'" style="width:100%;height:auto;display:block; border-radius:8px;"/>';
        
        if (previewId === 'preview-cabana') window._imgCabanaBase64 = compressedBase64;
        else if (previewId === 'preview-hab') window._imgHabBase64 = compressedBase64;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};



/* ════════ DYNAMIC SERVICES IN RESERVATION ════════ */
async function refreshGlobalServices() {
  try {
    const data = await ServiciosAPI.listar();
    const srvs = data.servicios || data.data || [];
    
    for (const key in SERVICIOS) delete SERVICIOS[key];
    
    let html = '';
    srvs.forEach(s => {
      if (s.Estado !== 1 && s.Estado !== true) return; // Solo activos
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo };
      html += `
        <button type="button" class="srv-chip" id="adm-srv-${s.IDServicio}" onclick="adminToggleSrv('${s.IDServicio}')" style="border:1.5px solid rgba(46,26,14,0.15);background:#fff;color:var(--bark);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M5 12l5 5L20 7"/></svg> ${s.NombreServicio} <span class="srv-price" style="margin-left:0.3rem;">+$${s.Costo/1000}K</span>
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
    paqs.forEach(p => {
      if (p.Estado !== 1 && p.Estado !== true) return;
      PAQUETES[p.IDPaquete] = { label: p.NombrePaquete, precio: p.Precio, descripcion: p.Descripcion, serviciosIncluidos: p.ServiciosIncluidos };
    });
    
    if (ADMIN_NUEVA_RES.paquete && !PAQUETES[ADMIN_NUEVA_RES.paquete]) {
      ADMIN_NUEVA_RES.paquete = null;
    }

    paqs.forEach(p => {
      if (!PAQUETES[p.IDPaquete]) return;
      const isSelected = ADMIN_NUEVA_RES.paquete == p.IDPaquete;
      html += '<button type="button" class="paq-opt ' + (isSelected ? 'selected' : '') + '" id="adm-p-' + p.IDPaquete + '" onclick="adminSelectPaquete(\'' + p.IDPaquete + '\')" style="border:2px solid ' + (isSelected ? 'var(--fire)' : 'var(--dark-border)') + ';background:var(--dark-card);">'
        + '<div class="paq-name" style="font-size:1.05rem;font-weight:700;color:var(--dark-text);margin-bottom:0.3rem;">' + p.NombrePaquete + '</div>'
        + '<div class="paq-desc" style="font-size:0.8rem;color:var(--dark-muted);margin-bottom:0.4rem;">' + (p.Descripcion || '') + '</div>'
        + '<div class="paq-price" style="font-size:0.85rem;font-weight:700;color:var(--fire);">' + (p.Precio > 0 ? '+' + fCop(p.Precio) : 'Incluido') + '</div>'
        + '</button>';
    });

    if (!html) {
      html = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--dark-muted);">No hay paquetes activos disponibles</div>';
    }

    const grid = document.getElementById('adm-paq-grid');
    if (grid) {
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
      CABANAS[c.IDCabana] = { label: c.Nombre, precio: c.Costo, descripcion: c.Descripcion, capacidad: c.CapacidadMaxima, ubicacion: c.Ubicacion };
      
      const isSelected = ADMIN_NUEVA_RES.cabana == c.IDCabana;
      html += `<option value="${c.IDCabana}" ${isSelected?'selected':''}>${c.Nombre} (${c.CapacidadMaxima} pers.) — ${fCop(c.Costo)}</option>`;
    });
    
    if (!CABANAS[ADMIN_NUEVA_RES.cabana] && firstCab) {
      ADMIN_NUEVA_RES.cabana = firstCab;
    }
    
    const select = document.getElementById('mn-cab');
    if (select) {
      if (html) select.innerHTML = html;
      else select.innerHTML = '<option value="">No hay cabañas registradas</option>';
    }
    
    // Tambien poblar b-cab (modal bloqueo)
    const selectBlq = document.getElementById('b-cab');
    if (selectBlq) {
      if (html) selectBlq.innerHTML = html;
      else selectBlq.innerHTML = '<option value="">No hay cabanas</option>';
    }
    populateCalCabFilter();
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


/* ════════ UNIFIED CLIENT AUTOCOMPLETE IN RESERVATION ════════ */
let _cliCache = [];  // Cache of all clients for autocomplete
let _cliDebounce = null;

async function loadCliCache() {
  try {
    const data = await ClientesAPI.listar({ page: 1, limit: 500, q: '' });
    _cliCache = data.data || [];
  } catch(e) { console.error('Error loading client cache', e); }
}

// Autocomplete handler - triggered on every keystroke
window.onCliAutocomplete = function(val) {
  clearTimeout(_cliDebounce);
  _cliDebounce = setTimeout(() => _doCliAutocomplete(val), 200);
};

async function _doCliAutocomplete(val) {
  const dropdown = document.getElementById('mn-cli-results');
  if (!dropdown) return;

  const q = (val || '').trim().toLowerCase();
  
  // If cache is empty, load it
  if (!_cliCache.length) await loadCliCache();

  let results = _cliCache;
  if (q) {
    results = _cliCache.filter(c => {
      const nom = (c.Nombre || '').toLowerCase();
      const ape = (c.Apellido || '').toLowerCase();
      const email = (c.Email || '').toLowerCase();
      const doc = String(c.NroDocumento || c.NumeroDocumento || '').toLowerCase();
      return nom.includes(q) || ape.includes(q) || email.includes(q) || doc.includes(q) || `${nom} ${ape}`.includes(q);
    });
  }

  if (!results.length && q) {
    // Try server-side search for broader results
    try {
      const data = await ClientesAPI.buscar(q);
      results = data.data || [];
    } catch(e) { /* ignore */ }
  }

  if (!results.length) {
    dropdown.innerHTML = '<div style="padding:0.85rem 1rem;color:var(--mist);font-size:0.85rem;text-align:center;">No se encontraron clientes</div>';
    dropdown.style.display = 'block';
    return;
  }

  // Show max 8 results
  const shown = results.slice(0, 8);
  dropdown.innerHTML = shown.map(c => {
    const doc = c.NroDocumento || c.IDUsuario || '';
    const nom = c.Nombre || '';
    const ape = c.Apellido || '';
    const email = c.Email || '';
    return `<div class="cli-ac-item" onclick="selectCliResult('${doc}', '${nom.replace(/'/g,"\\'")}', '${ape.replace(/'/g,"\\'")}', '${email.replace(/'/g,"\\'")}')" 
      style="padding:0.7rem 1rem;cursor:pointer;border-bottom:1px solid rgba(46,26,14,0.06);transition:background 0.12s;display:flex;justify-content:space-between;align-items:center;"
      onmouseenter="this.style.background='rgba(232,93,4,0.06)'" onmouseleave="this.style.background='transparent'">
      <div>
        <div style="font-weight:600;font-size:0.88rem;color:var(--bark);">${nom} ${ape}</div>
        <div style="font-size:0.78rem;color:var(--mist);">${email}</div>
      </div>
      <div style="font-size:0.75rem;color:var(--mist);font-family:monospace;">${doc}</div>
    </div>`;
  }).join('');

  if (results.length > 8) {
    dropdown.innerHTML += `<div style="padding:0.5rem 1rem;font-size:0.75rem;color:var(--mist);text-align:center;">+${results.length - 8} más resultados, sigue escribiendo...</div>`;
  }

  dropdown.style.display = 'block';
}

window.selectCliResult = function(doc, nom, ape, email) {
  // Set hidden value
  document.getElementById('mn-doc').value = doc;
  
  // Update search input
  const searchInput = document.getElementById('mn-cli-search');
  if (searchInput) searchInput.value = `${nom} ${ape}`;

  // Hide dropdown
  const dropdown = document.getElementById('mn-cli-results');
  if (dropdown) dropdown.style.display = 'none';

  // Show selected client chip
  const selDiv = document.getElementById('mn-cli-selected');
  if (selDiv) {
    selDiv.style.display = 'block';
    selDiv.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-weight:700;color:#2d7a4f;font-size:0.88rem;">✓ ${nom} ${ape}</span>
          <span style="font-size:0.78rem;color:var(--mist);margin-left:0.5rem;">${email} — Doc: ${doc}</span>
        </div>
        <button type="button" onclick="clearCliSelection()" style="background:none;border:none;color:var(--fire);cursor:pointer;font-size:0.85rem;font-weight:700;padding:0.2rem 0.4rem;">✕</button>
      </div>`;
  }

  // Update price summary
  if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
};

window.clearCliSelection = function() {
  document.getElementById('mn-doc').value = '';
  const searchInput = document.getElementById('mn-cli-search');
  if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  const selDiv = document.getElementById('mn-cli-selected');
  if (selDiv) { selDiv.style.display = 'none'; selDiv.innerHTML = ''; }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('mn-cli-results');
  const searchInput = document.getElementById('mn-cli-search');
  if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
    dropdown.style.display = 'none';
  }
});

// Intercept modal open to preload client cache
const oldAdminNuevaReserva = window.adminNuevaReserva;
window.adminNuevaReserva = function() {
  loadCliCache();
  if (oldAdminNuevaReserva) oldAdminNuevaReserva();
};

document.addEventListener('DOMContentLoaded', loadCliCache);
loadCliCache();


/* ════════ FIX INFINITE LOADING FOR ADMIN MODULES ════════ */
// 1. Redefine showSec to include all modules properly
const oldShowSec2 = window.showSec;
window.showSec = function(name, btn) {
  if (oldShowSec2) oldShowSec2(name, btn);
  if (name === 'dashboard') window.loadDashboard?.();
  if (name === 'cabanas' && typeof window.loadCabanas === 'function') window.loadCabanas();
  if (name === 'habitaciones' && typeof window.loadHabitaciones === 'function') window.loadHabitaciones();
  if (name === 'paquetes') window.loadPaquetesAdmin();
  if (name === 'servicios') window.loadServiciosAdmin();
  if (name === 'clientes') window.loadClientesAdmin();
  if (name === 'usuarios') window.loadUsuariosAdmin();
};

// 2. Implement loadPaquetesAdmin
window.loadPaquetesAdmin = async function() {
  const grid = document.getElementById('paq-grid');
  if (!grid) return;
  try {
    const data = await PaquetesAPI.listar();
    const paqs = data.paquetes || data.data || [];
    if (!paqs.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay paquetes registrados.</div>';
      return;
    }
    grid.innerHTML = paqs.map(p => `
      <div class="cab-card">
        <div class="cab-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3 style="color:#fff;">${p.NombrePaquete}</h3>
            <label class="toggle-label" title="Cambiar estado">
              <span style="font-size:0.75rem; color:var(--dark-muted);">${(p.Estado === 1 || p.Estado === true) ? 'Activo' : 'Inactivo'}</span>
              <div class="toggle-switch">
                <input type="checkbox" onchange="toggleEstadoGlobal('paquetes', '${p.IDPaquete}', this)" ${(p.Estado === 1 || p.Estado === true) ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
          <p style="margin-top:0.5rem;font-size:0.9rem;color:var(--dark-muted);">${p.Descripcion || 'Sin descripción'}</p>
          <div style="margin-top:1rem;font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--fire);">$${Number(p.Precio).toLocaleString('es-CO')}</div>
        </div>
        <div class="cab-foot" style="padding:0 1.1rem 1.1rem;display:flex;gap:0.4rem;">
          <button class="btn btn-sm btn-dark-outline" onclick="adminVerPaquete('${p.IDPaquete}')">Ver</button>
          <button class="btn btn-sm btn-dark-outline" onclick="adminEditarPaquete('${p.IDPaquete}')">Editar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;color:var(--fire);">Error al cargar paquetes</div>';
  }
};

window.adminVerPaquete = async function(id) {
    try {
        const data = await PaquetesAPI.uno(id);
        const p = data.data || data;
        const srvsIds = p.ServiciosIncluidos ? (Array.isArray(p.ServiciosIncluidos) ? p.ServiciosIncluidos : JSON.parse(p.ServiciosIncluidos)) : [];
        let srvsNames = [];
        srvsIds.forEach(id => {
             if (SERVICIOS[id]) srvsNames.push(SERVICIOS[id].label);
        });
        const serviciosHtml = srvsNames.length > 0 ? srvsNames.join(', ') : 'Ninguno';

        document.getElementById('m-vp-body').innerHTML = `
            <div style="margin-bottom:1rem;">
                <h4 style="color:var(--fire);font-size:1.2rem;margin-bottom:0.5rem;">${p.NombrePaquete}</h4>
                <p style="color:var(--mist);">${p.Descripcion || 'Sin descripción'}</p>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                <strong>Precio:</strong> <span style="color:var(--fire);font-weight:bold;">$${Number(p.Precio).toLocaleString('es-CO')}</span>
            </div>
            <div>
                <strong style="display:block;margin-bottom:0.3rem;">Servicios Incluidos:</strong>
                <p style="color:var(--mist);">${serviciosHtml}</p>
            </div>
        `;
        openM('m-view-paq');
    } catch(err) {
        console.error(err);
        toast('Error al cargar paquete', 'err');
    }
};

// 3. Implement loadServiciosAdmin
window.loadServiciosAdmin = async function() {
  const tbody = document.getElementById('srv-tbody');
  if (!tbody) return;
  try {
    const data = await ServiciosAPI.listar();
    const srvs = data.servicios || data.data || [];
    if (!srvs.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--dark-muted);">No hay servicios registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = srvs.map(s => `
      <tr>
        <td>${s.IDServicio}</td>
        <td><strong>${s.NombreServicio}</strong></td>
        <td>${s.Descripcion || '-'}</td>
        <td>$${Number(s.Costo).toLocaleString('es-CO')}</td>
        <td>
          <label class="toggle-label" title="Cambiar estado">
            <span style="font-size:0.75rem; color:var(--dark-muted);">${(s.Estado === 1 || s.Estado === true) ? 'Activo' : 'Inactivo'}</span>
            <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
              <input type="checkbox" onchange="toggleEstadoGlobal('servicios', '${s.IDServicio}', this)" ${(s.Estado === 1 || s.Estado === true) ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </td>
        <td><div style="display:flex;gap:0.4rem;"><button class="btn btn-sm btn-dark-outline" onclick="adminEditarServicio('${s.IDServicio}')">Editar</button><button class="btn btn-sm btn-danger" onclick="adminEliminarServicio('${s.IDServicio}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--fire);">Error al cargar servicios</td></tr>';
  }
};

// 4. Implement loadClientesAdmin — con paginación y búsqueda
const _cliPag = { currentPage: 1, totalPages: 1, total: 0, limit: 10 };

window.loadClientesAdmin = async function(page = 1) {
  const tbody = document.getElementById('cli-tbody');
  if (!tbody) return;
  const q = document.getElementById('fil-cliente-q')?.value?.trim() || '';
  try {
    const data = await ClientesAPI.listar({ page, limit: _cliPag.limit, q });
    const clis = data.data || [];
    _cliPag.currentPage = data.currentPage || 1;
    _cliPag.totalPages  = data.totalPages  || 1;
    _cliPag.total       = data.total       || 0;

    // Actualizar contador
    const countEl = document.getElementById('cli-count');
    if (countEl) countEl.textContent = `${_cliPag.total} cliente(s)`;

    if (!clis.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--dark-muted);">${q ? 'No se encontraron clientes con esa búsqueda.' : 'No hay clientes registrados.'}</td></tr>`;
      updateCliPagCtrl();
      return;
    }
    tbody.innerHTML = clis.map(c => `
      <tr>
        <td>${c.NroDocumento || '-'}</td>
        <td><strong>${c.Nombre || '-'}</strong></td>
        <td>${c.Apellido || '-'}</td>
        <td>${c.Email || '-'}</td>
        <td>${c.Telefono || '-'}</td>
        <td>${c.Pais || '-'}</td>
        <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-sm btn-dark-outline" onclick="adminVerCliente('${c.IDUsuario || c.NroDocumento}')">Ver</button><button class="btn btn-sm btn-outline" style="color:var(--fire);border-color:rgba(232,93,4,0.3);" onclick="adminEditarCliente('${c.IDUsuario || c.NroDocumento}')">Editar</button></div></td>
      </tr>
    `).join('');
    updateCliPagCtrl();
  } catch (err) {
    console.error('Error cargando clientes:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--fire);">Error al cargar clientes</td></tr>';
  }
};

function updateCliPagCtrl() {
  const el = document.getElementById('cli-pagination'); if (!el) return;
  const { currentPage, totalPages } = _cliPag;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;padding:1rem;">
    <button class="btn btn-sm btn-dark-outline" onclick="cliGoToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
    <span style="color:var(--dark-muted);font-size:0.85rem;">Página ${currentPage} de ${totalPages}</span>
    <button class="btn btn-sm btn-dark-outline" onclick="cliGoToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
  </div>`;
}
window.cliGoToPage = function(p) {
  if (p < 1 || p > _cliPag.totalPages) return;
  loadClientesAdmin(p);
};
window.cliSearch = function() { loadClientesAdmin(1); };
window.cliClearSearch = function() {
  document.getElementById('fil-cliente-q').value = '';
  loadClientesAdmin(1);
};
let _cliSearchDebounce = null;
window.cliLiveSearch = function() { clearTimeout(_cliSearchDebounce); _cliSearchDebounce = setTimeout(() => loadClientesAdmin(1), 300); };

// Alias loadClientes so the HTML onkeyup/onclick works properly
window.loadClientes = window.loadClientesAdmin;



/* =====================================================================
   ADMIN CRUD INJECTIONS (FIXED)
   ===================================================================== */

// --- CABAÑAS ---
// --- HABITACIONES ---
window.adminNuevaHabitacion = function() {
  document.getElementById('m-hab-id').value = '';
  document.getElementById('m-hab-nombre').value = '';
  document.getElementById('m-hab-cabana').value = '';
  document.getElementById('m-hab-est').value = 'true';
  document.getElementById('m-hab-title').textContent = 'Nueva Habitación';
  openM('m-hab');
};

window.adminEditarHabitacion = async function(id) {
  try {
    const res = await req('/habitaciones/' + id);
    const h = res.habitacion || res.data || res;
    document.getElementById('m-hab-id').value = h.IDHabitacion;
    document.getElementById('m-hab-nombre').value = h.NombreHabitacion;
    document.getElementById('m-hab-cabana').value = h.IDCabana || '';
    document.getElementById('m-hab-est').value = h.Estado ? 'true' : 'false';
    document.getElementById('m-hab-title').textContent = 'Editar Habitación';
    openM('m-hab');
  } catch (err) {
    alert(err.message || 'Error al obtener habitación');
  }
};

window.saveHabitacion = async function() {
  const id = document.getElementById('m-hab-id').value;
  const data = {
    NombreHabitacion: document.getElementById('m-hab-nombre').value,
    IDCabana: parseInt(document.getElementById('m-hab-cabana').value),
    Estado: document.getElementById('m-hab-est').value === 'true'
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const path = id ? '/habitaciones/' + id : '/habitaciones';
    await req(path, { method, body: JSON.stringify(data) });
    closeM('m-hab');
    if (window.loadHabitaciones) loadHabitaciones();
  } catch (err) {
    alert(err.message || 'Error al guardar habitación');
  }
};

window.adminEliminarHabitacion = async function(id) {
  if (!confirm('¿Eliminar esta habitación?')) return;
  try {
    await req('/habitaciones/' + id, { method: 'DELETE' });
    if (window.loadHabitaciones) loadHabitaciones();
  } catch (err) {
    alert(err.message || 'Error al eliminar');
  }
};

// --- PAQUETES ---
window.adminNuevoPaquete = function() {
  document.getElementById('m-paq-id').value = '';
  document.getElementById('m-paq-nombre').value = '';
  document.getElementById('m-paq-desc').value = '';
  document.getElementById('m-paq-precio').value = '';
  document.getElementById('m-paq-servicio').value = '';
  document.getElementById('m-paq-est').value = 'true';
  document.getElementById('m-paq-title').textContent = 'Nuevo Paquete';
  openM('m-paq');
};

window.adminEditarPaquete = async function(id) {
  try {
    const res = await req('/paquetes/' + id);
    const p = res.paquete || res.data || res;
    document.getElementById('m-paq-id').value = p.IDPaquete;
    document.getElementById('m-paq-nombre').value = p.NombrePaquete;
    document.getElementById('m-paq-desc').value = p.Descripcion || '';
    document.getElementById('m-paq-precio').value = p.Precio;
    document.getElementById('m-paq-servicio').value = p.IDServicio || '';
    document.getElementById('m-paq-est').value = p.Estado ? 'true' : 'false';
    document.getElementById('m-paq-title').textContent = 'Editar Paquete';
    openM('m-paq');
  } catch (err) {
    alert(err.message || 'Error al obtener paquete');
  }
};

window.savePaquete = async function() {
  const id = document.getElementById('m-paq-id').value;
  const data = {
    NombrePaquete: document.getElementById('m-paq-nombre').value,
    Descripcion: document.getElementById('m-paq-desc').value,
    Precio: parseFloat(document.getElementById('m-paq-precio').value),
    IDServicio: document.getElementById('m-paq-servicio').value || null,
    Estado: document.getElementById('m-paq-est').value === 'true'
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const path = id ? '/paquetes/' + id : '/paquetes';
    await req(path, { method, body: JSON.stringify(data) });
    closeM('m-paq');
    if (window.loadPaquetesAdmin) window.loadPaquetesAdmin();
  } catch (err) {
    alert(err.message || 'Error al guardar paquete');
  }
};

window.adminEliminarPaquete = async function(id) {
  if (!confirm('¿Eliminar paquete?')) return;
  try {
    await req('/paquetes/' + id, { method: 'DELETE' });
    if (window.loadPaquetesAdmin) window.loadPaquetesAdmin();
  } catch (err) {
    alert(err.message || 'Error al eliminar');
  }
};

// --- SERVICIOS ---
window.adminNuevoServicio = function() {
  document.getElementById('m-srv-id').value = '';
  document.getElementById('m-srv-nombre').value = '';
  document.getElementById('m-srv-desc').value = '';
  document.getElementById('m-srv-cap').value = '1';
  document.getElementById('m-srv-precio').value = '';
  document.getElementById('m-srv-est').value = 'true';
  document.getElementById('m-srv-title').textContent = 'Nuevo Servicio';
  openM('m-srv');
};

window.adminEditarServicio = async function(id) {
  try {
    const res = await req('/servicios/' + id);
    const s = res.servicio || res.data || res;
    document.getElementById('m-srv-id').value = s.IDServicio;
    document.getElementById('m-srv-nombre').value = s.NombreServicio;
    document.getElementById('m-srv-desc').value = s.Descripcion || '';
    document.getElementById('m-srv-cap').value = s.CantidadMaximaPersonas || 1;
    document.getElementById('m-srv-precio').value = s.Costo || 0;
    document.getElementById('m-srv-est').value = s.Estado ? 'true' : 'false';
    document.getElementById('m-srv-title').textContent = 'Editar Servicio';
    openM('m-srv');
  } catch (err) {
    alert(err.message || 'Error al obtener servicio');
  }
};

window.saveServicio = async function() {
  const id = document.getElementById('m-srv-id').value;
  const data = {
    NombreServicio: document.getElementById('m-srv-nombre').value,
    Descripcion: document.getElementById('m-srv-desc').value,
    CantidadMaximaPersonas: parseInt(document.getElementById('m-srv-cap').value),
    Costo: parseFloat(document.getElementById('m-srv-precio').value),
    Estado: document.getElementById('m-srv-est').value === 'true'
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const path = id ? '/servicios/' + id : '/servicios';
    await req(path, { method, body: JSON.stringify(data) });
    closeM('m-srv');
    if (window.loadServiciosAdmin) window.loadServiciosAdmin();
    if (window.adminRefreshGlobalServices) window.adminRefreshGlobalServices();
  } catch (err) {
    alert(err.message || 'Error al guardar servicio');
  }
};

window.adminEliminarServicio = async function(id) {
  if (!confirm('¿Eliminar servicio?')) return;
  try {
    await req('/servicios/' + id, { method: 'DELETE' });
    if (window.loadServiciosAdmin) window.loadServiciosAdmin();
    if (window.adminRefreshGlobalServices) window.adminRefreshGlobalServices();
  } catch (err) {
    alert(err.message || 'Error al eliminar');
  }
};

// --- CLIENTES ---

// Helper: llena el modal con datos del cliente
function _fillClienteModal(c, doc) {
  document.getElementById('m-cli-doc').value = c.IDUsuario || doc;
  document.getElementById('m-cli-nombre').value = c.Nombre || c.nombre || '';
  document.getElementById('m-cli-apellido').value = c.Apellido || c.apellido || '';
  document.getElementById('m-cli-tel').value = c.Telefono || c.telefono || '';
  document.getElementById('m-cli-nac').value = c.Pais || c.Nacionalidad || c.pais || c.nacionalidad || '';
  document.getElementById('m-cli-historial').innerHTML = '<em>Historial de reservas se mostrará aquí</em>';
}

// Helper: readonly / editable
function _setClienteReadonly(readonly) {
  const ids = ['m-cli-nombre', 'm-cli-apellido', 'm-cli-tel', 'm-cli-nac'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.readOnly = readonly;
    el.style.opacity = readonly ? '0.75' : '1';
    el.style.cursor = readonly ? 'default' : '';
    el.style.pointerEvents = readonly ? 'none' : '';
  });
}

// Ver cliente (solo lectura)
window.adminVerCliente = async function(doc) {
  try {
    const res = await req('/clientes/' + doc);
    const c = res.cliente || res.data || res;
    _fillClienteModal(c, doc);
    _setClienteReadonly(true);
    document.getElementById('m-cli-title').textContent = 'Detalle de Cliente';
    document.getElementById('m-cli-footer').innerHTML = `
      <button type="button" class="btn btn-outline" onclick="closeM('m-cli')">Cerrar</button>`;
    openM('m-cli');
  } catch (err) {
    alert(err.message || 'Error al obtener cliente');
  }
};

// Editar cliente (campos editables)
window.adminEditarCliente = async function(doc) {
  try {
    const res = await req('/clientes/' + doc);
    const c = res.cliente || res.data || res;
    _fillClienteModal(c, doc);
    _setClienteReadonly(false);
    document.getElementById('m-cli-title').textContent = 'Editar Cliente';
    document.getElementById('m-cli-footer').innerHTML = `
      <button type="button" class="btn btn-outline" onclick="closeM('m-cli')">Cancelar</button>
      <button class="btn btn-fire" onclick="saveCliente()">Guardar Cambios</button>`;
    openM('m-cli');
  } catch (err) {
    alert(err.message || 'Error al obtener cliente');
  }
};

window.saveCliente = async function() {
  const doc = document.getElementById('m-cli-doc').value;
  const data = {
    Nombre: document.getElementById('m-cli-nombre').value,
    Apellido: document.getElementById('m-cli-apellido').value,
    Telefono: document.getElementById('m-cli-tel').value,
    Pais: document.getElementById('m-cli-nac').value
  };

  try {
    // Clients only edit, method PUT
    await req('/clientes/' + doc, { method: 'PUT', body: JSON.stringify(data) });
    closeM('m-cli');
    if (window.loadClientesAdmin) window.loadClientesAdmin();
  } catch (err) {
    alert(err.message || 'Error al actualizar cliente');
  }
};

window.adminEliminarCliente = async function(doc) {
  if (!confirm('¿Eliminar cliente?')) return;
  try {
    await req('/clientes/' + doc, { method: 'DELETE' });
    if (window.loadClientesAdmin) window.loadClientesAdmin();
  } catch (err) {
    alert(err.message || 'Error al eliminar cliente');
  }
};


/* =====================================================================
   HABITACIONES REFACTOR: ACCORDION BY CABANA
   ===================================================================== */

window.adminVerHabitacion = async function(id) {
  try {
    const res = await req('/habitaciones/' + id);
    const h = res.habitacion || res.data || res;
    document.getElementById('m-vh-nombre').textContent = h.NombreHabitacion;
    document.getElementById('m-vh-desc').textContent = h.Descripcion || 'Sin descripción';
    document.getElementById('m-vh-precio').textContent = fCop(h.Costo) + ' / noche';
    
    const estBadge = document.getElementById('m-vh-est');
    if (h.Estado) {
      estBadge.className = 'badge badge-success';
      estBadge.textContent = 'Activa';
    } else {
      estBadge.className = 'badge badge-danger';
      estBadge.textContent = 'Inactiva';
    }

    const fotoCont = document.getElementById('m-vh-foto');
    if (h.ImagenHabitacion) {
      fotoCont.innerHTML = '<img src="' + h.ImagenHabitacion + '" style="width:100%; height:auto; display:block;"/>';
      fotoCont.style.display = 'block';
    } else {
      fotoCont.style.display = 'none';
      fotoCont.innerHTML = '';
    }
    
    openM('m-view-hab');
  } catch (err) {
    alert(err.message || 'Error al obtener datos de la habitación');
  }
};

window.loadHabitaciones = async function() {
  try {
    const grid = document.getElementById('hab-grid');
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Cargando...</div>';
    
    const [resHab, resCab] = await Promise.all([
      req('/habitaciones'),
      req('/cabanas')
    ]);

    if (!resHab.success || !resCab.success) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Error al cargar datos.</div>';
      return;
    }

    const habitaciones = resHab.data || [];
    const cabanas = resCab.data || [];

    if (habitaciones.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay habitaciones registradas.</div>';
      return;
    }

    // Agrupar habitaciones por IDCabana
    const map = {};
    // Primero, crear entrada para todas las cabañas
    cabanas.forEach(c => {
      map[c.IDCabana] = { cabana: c, habitaciones: [] };
    });
    // Agrupar
    habitaciones.forEach(h => {
      const cid = h.IDCabana;
      if (cid && map[cid]) {
        map[cid].habitaciones.push(h);
      } else {
        if (!map['unassigned']) map['unassigned'] = { cabana: { Nombre: 'Habitaciones Sin Asignar' }, habitaciones: [] };
        map['unassigned'].habitaciones.push(h);
      }
    });

    let html = '';
    
    // Función toggle (inline)
    window.toggleAccordion = function(id) {
      const content = document.getElementById('acc-' + id);
      const icon = document.getElementById('acc-icon-' + id);
      if (content.style.display === 'none') {
        content.style.display = 'flex';
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    };

    Object.keys(map).forEach(key => {
      const group = map[key];
      if (group.habitaciones.length === 0 && key !== 'unassigned') return; // Skip empty cabañas
      
      const isUnassigned = key === 'unassigned';
      
      let innerHtml = group.habitaciones.map(h => `
        <div style="background:var(--dark-card); border:1px solid var(--dark-border); border-radius:8px; padding:1rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <div>
            <h4 style="margin-bottom:0.3rem; color:var(--dark-text); font-size:1.1rem;">${h.NombreHabitacion}</h4>
            <div style="font-size:0.85rem; color:var(--dark-muted); display:flex; align-items:center; gap:0.5rem;">${fCop(h.Costo)} / noche &nbsp;&middot;&nbsp; 
              <label class="toggle-label" style="display:inline-flex; margin:0;" title="Cambiar estado">
                <span style="font-size:0.75rem;">${h.Estado ? 'Activa' : 'Inactiva'}</span>
                <div class="toggle-switch" style="transform:scale(0.8); transform-origin:left center;">
                  <input type="checkbox" onchange="toggleEstadoGlobal('habitaciones', '${h.IDHabitacion}', this)" ${h.Estado ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </div>
              </label>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-sm btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="adminVerHabitacion('${h.IDHabitacion}')">Ver</button>
            <button class="btn btn-sm btn-dark-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="adminEditarHabitacion('${h.IDHabitacion}')">Editar</button>
            <button class="btn btn-sm btn-dark-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem; color:var(--danger); border-color:rgba(239,83,80,0.3);" onclick="adminEliminarHabitacion('${h.IDHabitacion}')">Eliminar</button>
          </div>
        </div>
      `).join('');

      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 1rem; border-radius:8px; overflow:hidden; background:var(--dark-bg); box-shadow:0 2px 4px rgba(0,0,0,0.2);">
          <div onclick="toggleAccordion('${key}')" style="cursor:pointer; padding:1rem 1.5rem; background:linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02)); border-bottom:1px solid var(--dark-border); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-family:var(--font-display); color:var(--dark-text); font-size:1.2rem;">${isUnassigned ? '⚠️ Sin Asignar' : '🏕️ ' + group.cabana.Nombre} <span style="font-size:0.8rem; font-weight:400; color:var(--dark-muted); margin-left:0.5rem;">(${group.habitaciones.length} habs)</span></h3>
            <svg id="acc-icon-${key}" viewBox="0 0 24 24" fill="none" stroke="var(--dark-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px; transition:transform 0.2s;"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <div id="acc-${key}" style="display:flex; flex-direction:column; padding:1rem; background:rgba(0,0,0,0.15);">
            ${innerHtml}
          </div>
        </div>
      `;
    });

    grid.style.display = 'block'; // Overriding the grid layout to block for accordion
    grid.innerHTML = html;
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

  const select = document.getElementById('m-hab-cabana');
  select.innerHTML = '<option value="">Cargando...</option>';
  try {
    const res = await req('/cabanas');
    if (res.success && res.data.length > 0) {
      select.innerHTML = '<option value="">-- Seleccione Cabaña --</option>' + res.data.map(c => `<option value="${c.IDCabana}">${c.Nombre}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No hay cabañas creadas</option>';
    }
  } catch(e) {}

  openM('m-hab');
};

window.adminEditarHabitacion = async function(id) {
  try {
    const res = await req('/habitaciones/' + id);
    const h = res.habitacion || res.data || res;
    document.getElementById('m-hab-id').value = h.IDHabitacion;
    document.getElementById('m-hab-nombre').value = h.NombreHabitacion;
    document.getElementById('m-hab-est').value = h.Estado ? 'true' : 'false';
    window._currentHabFoto = h.ImagenHabitacion || null;
    document.getElementById('m-hab-foto').value = '';
    const preview = document.getElementById('m-hab-foto-preview');
    if(preview) { 
      if(h.ImagenHabitacion) { 
        preview.innerHTML = '<img src="' + h.ImagenHabitacion + '" style="width:100%; height:auto; display:block;"/>'; 
        preview.style.display='block'; 
      } else { 
        preview.style.display='none'; 
      } 
    }
    document.getElementById('m-hab-title').textContent = 'Editar Habitación';

    const select = document.getElementById('m-hab-cabana');
    select.innerHTML = '<option value="">Cargando...</option>';
    try {
      const cRes = await req('/cabanas');
      if (cRes.success) {
        select.innerHTML = '<option value="">-- Seleccione Cabaña --</option>' + cRes.data.map(c => `<option value="${c.IDCabana}" ${c.IDCabana == h.IDCabana ? 'selected' : ''}>${c.Nombre}</option>`).join('');
      }
    } catch(e) {}

    openM('m-hab');
  } catch (err) {
    alert(err.message || 'Error al obtener habitación');
  }
};

window.adminNuevoPaquete = async function() {
  document.getElementById('m-paq-id').value = '';
  document.getElementById('m-paq-nombre').value = '';
  document.getElementById('m-paq-desc').value = '';
  document.getElementById('m-paq-precio').value = '';
  document.getElementById('m-paq-est').value = 'true';
  document.getElementById('m-paq-title').textContent = 'Nuevo Paquete';

  const select = document.getElementById('m-paq-servicio');
  select.innerHTML = '<option value="">Cargando...</option>';
  try {
    const res = await req('/servicios');
    if (res.success && res.data.length > 0) {
      select.innerHTML = '<option value="">-- Sin Servicio (Opcional) --</option>' + res.data.map(s => `<option value="${s.IDServicio}">${s.NombreServicio}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No hay servicios creadas</option>';
    }
  } catch(e) {}

  openM('m-paq');
};

window.adminEditarPaquete = async function(id) {
  try {
    const res = await req('/paquetes/' + id);
    const p = res.paquete || res.data || res;
    document.getElementById('m-paq-id').value = p.IDPaquete;
    document.getElementById('m-paq-nombre').value = p.NombrePaquete;
    document.getElementById('m-paq-desc').value = p.Descripcion || '';
    document.getElementById('m-paq-precio').value = p.Precio;
    document.getElementById('m-paq-est').value = p.Estado ? 'true' : 'false';
    document.getElementById('m-paq-title').textContent = 'Editar Paquete';

    const select = document.getElementById('m-paq-servicio');
    select.innerHTML = '<option value="">Cargando...</option>';
    try {
      const sRes = await req('/servicios');
      if (sRes.success) {
        select.innerHTML = '<option value="">-- Sin Servicio (Opcional) --</option>' + sRes.data.map(s => `<option value="${s.IDServicio}" ${s.IDServicio == p.IDServicio ? 'selected' : ''}>${s.NombreServicio}</option>`).join('');
      }
    } catch(e) {}

    openM('m-paq');
  } catch (err) {
    alert(err.message || 'Error al obtener paquete');
  }
};


/* =====================================================================
   PAQUETES REFACTOR: MULTIPLE SERVICES AND ADMIN NEW RESERVATION
   ===================================================================== */

window.adminNuevoPaquete = async function() {
  document.getElementById('m-paq-id').value = '';
  document.getElementById('m-paq-nombre').value = '';
  document.getElementById('m-paq-desc').value = '';
  document.getElementById('m-paq-precio').value = '';
  document.getElementById('m-paq-est').value = 'true';
  document.getElementById('m-paq-title').textContent = 'Nuevo Paquete';

  const srvDiv = document.getElementById('m-paq-servicio');
  srvDiv.innerHTML = '<div style="text-align:center; padding:1rem;">Cargando...</div>';
  try {
    const res = await req('/servicios');
    if (res.success && res.data.length > 0) {
      srvDiv.innerHTML = res.data.map(s => `
        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
          <input type="checkbox" name="paq-srv" value="${s.IDServicio}">
          <span style="color:var(--dark-text); font-size:0.9rem;">${s.NombreServicio}</span>
        </label>
      `).join('');
    } else {
      srvDiv.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--dark-muted);">No hay servicios creados</div>';
    }
  } catch(e) {}

  openM('m-paq');
};

window.adminEditarPaquete = async function(id) {
  try {
    const res = await req('/paquetes/' + id);
    const p = res.paquete || res.data || res;
    document.getElementById('m-paq-id').value = p.IDPaquete;
    document.getElementById('m-paq-nombre').value = p.NombrePaquete;
    document.getElementById('m-paq-desc').value = p.Descripcion || '';
    document.getElementById('m-paq-precio').value = p.Precio;
    document.getElementById('m-paq-est').value = p.Estado ? 'true' : 'false';
    document.getElementById('m-paq-title').textContent = 'Editar Paquete';

    let selectedSrvs = [];
    if (p.ServiciosIncluidos) {
      if (typeof p.ServiciosIncluidos === 'string') {
        try { selectedSrvs = JSON.parse(p.ServiciosIncluidos); } catch(e){}
      } else if (Array.isArray(p.ServiciosIncluidos)) {
        selectedSrvs = p.ServiciosIncluidos;
      }
    } else if (p.IDServicio) {
      selectedSrvs = [p.IDServicio];
    }

    const srvDiv = document.getElementById('m-paq-servicio');
    srvDiv.innerHTML = '<div style="text-align:center; padding:1rem;">Cargando...</div>';
    try {
      const sRes = await req('/servicios');
      if (sRes.success) {
        srvDiv.innerHTML = sRes.data.map(s => {
          const isChecked = selectedSrvs.includes(s.IDServicio) || selectedSrvs.includes(String(s.IDServicio)) ? 'checked' : '';
          return `
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" name="paq-srv" value="${s.IDServicio}" ${isChecked}>
              <span style="color:var(--dark-text); font-size:0.9rem;">${s.NombreServicio}</span>
            </label>
          `;
        }).join('');
      }
    } catch(e) {}

    openM('m-paq');
  } catch (err) {
    alert(err.message || 'Error al obtener paquete');
  }
};

window.savePaquete = async function() {
  const id = document.getElementById('m-paq-id').value;
  
  const checkboxes = document.querySelectorAll('input[name="paq-srv"]:checked');
  const selectedSrvs = Array.from(checkboxes).map(cb => parseInt(cb.value));

  const data = {
    NombrePaquete: document.getElementById('m-paq-nombre').value,
    Descripcion: document.getElementById('m-paq-desc').value,
    Precio: parseFloat(document.getElementById('m-paq-precio').value),
    ServiciosIncluidos: selectedSrvs,
    Estado: document.getElementById('m-paq-est').value === 'true'
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const path = id ? '/paquetes/' + id : '/paquetes';
    await req(path, { method, body: JSON.stringify(data) });
    closeM('m-paq');
    if (window.loadPaquetesAdmin) window.loadPaquetesAdmin();
    if (window.adminRefreshGlobalPackages) adminRefreshGlobalPackages(); // refresh admin reservation form
  } catch (err) {
    alert(err.message || 'Error al guardar paquete');
  }
};


/* =====================================================================
   ADMIN NUEVA RESERVA: DYNAMIC LOADING
   ===================================================================== */

window.adminRefreshGlobalPackages = async function() {
  try {
    const data = await req('/paquetes');
    const paqs = data.paquetes || data.data || [];
    
    for (const key in window.PAQUETES) delete window.PAQUETES[key];
    
    let html = '';
    paqs.forEach(p => {
      if (p.Estado !== 1 && p.Estado !== true) return;
      window.PAQUETES[p.IDPaquete] = { label: p.NombrePaquete, precio: p.Precio, descripcion: p.Descripcion };
    });
    
    if (ADMIN_NUEVA_RES.paquete && !window.PAQUETES[ADMIN_NUEVA_RES.paquete]) {
      ADMIN_NUEVA_RES.paquete = null;
    }

    paqs.forEach((p) => {
      if (!window.PAQUETES[p.IDPaquete]) return;
      const isSelected = ADMIN_NUEVA_RES.paquete == p.IDPaquete;
      
      html += '<button type="button" class="paq-opt ' + (isSelected ? 'selected' : '') + '" id="adm-p-' + p.IDPaquete + '" onclick="adminSelectPaquete(\'' + p.IDPaquete + '\')" style="border:2px solid ' + (isSelected ? 'var(--fire)' : 'var(--dark-border)') + ';background:var(--dark-card);">'
        + '<div class="paq-name" style="font-size:1.05rem;font-weight:700;color:var(--dark-text);margin-bottom:0.3rem;">' + p.NombrePaquete + '</div>'
        + '<div class="paq-desc" style="font-size:0.8rem;color:var(--dark-muted);margin-bottom:0.4rem;">' + (p.Descripcion || '') + '</div>'
        + '<div class="paq-price" style="font-size:0.85rem;font-weight:700;color:var(--fire);">' + (p.Precio > 0 ? '+' + fCop(p.Precio) : 'Incluido') + '</div>'
        + '</button>';
    });

    if (!html) {
      html = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--dark-muted);">No hay paquetes activos disponibles</div>';
    }

    const grid = document.getElementById('adm-paq-grid');
    if (grid) {
      grid.innerHTML = html;
    }
    
    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch(e) {}
};

window.adminRefreshGlobalServices = async function() {
  try {
    const data = await req('/servicios');
    const srvs = data.servicios || data.data || [];
    
    for (const key in window.SERVICIOS) delete window.SERVICIOS[key];
    
    let html = '';
    srvs.forEach(s => {
      if (s.Estado !== 1 && s.Estado !== true) return; // Solo activos
      window.SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo };
      const isSelected = ADMIN_NUEVA_RES && ADMIN_NUEVA_RES.servicios && ADMIN_NUEVA_RES.servicios.has(String(s.IDServicio));
      html += `
        <button type="button" class="srv-chip ${isSelected?'selected':''}" id="adm-srv-${s.IDServicio}" onclick="adminToggleSrv('${s.IDServicio}')" style="${isSelected?'background:var(--fire);color:#fff;border-color:var(--fire);':'background:#fff;color:var(--bark);border-color:rgba(46,26,14,0.15);'}">
          ${s.NombreServicio} <span style="font-weight:600; font-size:0.75rem; opacity:0.8;">+${fCop(s.Costo)}</span>
        </button>`;
    });

    // Buscar la srv-grid dentro del modal de nueva reserva
    const srvGrid = document.querySelector('#m-nueva .srv-grid');
    if (srvGrid) srvGrid.innerHTML = html;
  } catch(e) { console.error('Error refreshing admin services', e); }
};

document.addEventListener('DOMContentLoaded', () => {
  if(window.adminRefreshGlobalPackages) adminRefreshGlobalPackages();
  if(window.adminRefreshGlobalServices) adminRefreshGlobalServices();
});


/* =====================================================================
   ADMIN NUEVA RESERVA: DYNAMIC CABANAS
   ===================================================================== */

window.adminRefreshGlobalCabanas = async function() {
  try {
    const data = await req('/cabanas');
    const cabanas = data.data || [];
    
    for (const key in window.CABANAS) delete window.CABANAS[key];
    
    let html = '';
    let firstCab = null;
    cabanas.forEach(c => {
      if (!c.Estado && c.Estado !== 1) return;
      if (!firstCab) firstCab = c.IDCabana;
      window.CABANAS[c.IDCabana] = { label: c.Nombre, precio: c.Costo, descripcion: c.Descripcion, capacidad: c.CapacidadMaxima };
    });
    
    if (!ADMIN_NUEVA_RES.cabana && firstCab) {
      ADMIN_NUEVA_RES.cabana = firstCab;
    }

    cabanas.forEach((c) => {
      if (!window.CABANAS[c.IDCabana]) return;
      html += `
        <option value="${c.IDCabana}" ${ADMIN_NUEVA_RES.cabana == c.IDCabana ? 'selected' : ''}>
          ${c.Nombre} (${c.CapacidadMaxima} pers.) — ${fCop(c.Costo)}
        </option>`;
    });

    const select = document.getElementById('mn-cab');
    if (select) {
      select.innerHTML = html;
    }
    const selectBlq = document.getElementById('b-cab');
    if (selectBlq) {
      selectBlq.innerHTML = html;
    }
    
    populateCalCabFilter();
    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch(e) { 
    console.error('Error in adminRefreshGlobalCabanas:', e); 
  } finally {
    if (typeof updateAdminDatePickers === 'function') updateAdminDatePickers(); // Refrescar fechas SIEMPRE
  }
};

// ════════ FLATPICKR LOGIC ════════

// Obtiene los rangos ocupados de una cabaña como arrays de Date
function getOccupiedRanges(cab) {
  if (!window.GLOBAL_RESERVAS || !cab) return [];
  return window.GLOBAL_RESERVAS
    .filter(r => String(r.cabana) === String(cab) && ['confirmada', 'pendiente', 'bloqueada'].includes(r.estado))
    .map(r => ({ from: new Date(r.fecha_inicio + 'T00:00:00'), to: new Date(r.fecha_fin + 'T00:00:00') }));
}

// Dado un día de inicio seleccionado, calcula el maxDate (día antes de la siguiente reserva)
function getMaxDateAfter(startDate, ranges) {
  let nearest = null;
  for (const rng of ranges) {
    if (rng.from > startDate) {
      if (!nearest || rng.from < nearest) nearest = rng.from;
    }
  }
  if (!nearest) return null; // sin tope
  // El último día seleccionable es el día anterior al inicio de la próxima reserva
  const max = new Date(nearest);
  max.setDate(max.getDate() - 1);
  return max;
}

// Calcula los días aislados (1 solo día libre entre reservas) que deben bloquearse
function getIsolatedDays(cab) {
  const ranges = getOccupiedRanges(cab);
  if (!ranges.length) return [];

  // Obtener el conjunto de todos los días ocupados
  const occupied = new Set();
  ranges.forEach(rng => {
    const d = new Date(rng.from);
    while (d <= rng.to) {
      occupied.add(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
  });

  // Para cada día libre entre hoy y +1 año, verificar si está aislado
  const isolated = [];
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const limite = new Date(hoy); limite.setFullYear(limite.getFullYear() + 1);

  for (let d = new Date(manana); d <= limite; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split('T')[0];
    if (occupied.has(ds)) continue; // está ocupado, no es libre
    // Comprobar si el día siguiente está ocupado
    const sig = new Date(d); sig.setDate(sig.getDate() + 1);
    const sigDs = sig.toISOString().split('T')[0];
    // Comprobar si el día anterior está ocupado
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    const prevDs = prev.toISOString().split('T')[0];
    // Si tanto el anterior como el siguiente están ocupados => aislado
    if (occupied.has(sigDs) && (occupied.has(prevDs) || d.getTime() === manana.getTime())) {
      isolated.push(ds);
    }
  }
  return isolated;
}

function getDisabledDates(cab) {
  if (!window.GLOBAL_RESERVAS || !cab) return [];
  const reservaRanges = window.GLOBAL_RESERVAS
    .filter(r => String(r.cabana) === String(cab) && ['confirmada', 'pendiente', 'bloqueada'].includes(r.estado))
    .map(r => ({ from: r.fecha_inicio, to: r.fecha_fin }));
  const isolated = getIsolatedDays(cab);
  return [...reservaRanges, ...isolated];
}

function setupPickerPair(iniId, finId, cab, onChangeExtra) {
  const hoyStr = new Date().toISOString().split('T')[0];

  const ranges = getOccupiedRanges(cab);
  const disabled = getDisabledDates(cab);
  const commonOpts = { locale: 'es', minDate: hoyStr, dateFormat: 'Y-m-d' };

  // Destruir instancias previas
  const iniEl = document.getElementById(iniId);
  const finEl = document.getElementById(finId);
  if (!iniEl || !finEl) return;
  if (iniEl._flatpickr) iniEl._flatpickr.destroy();
  if (finEl._flatpickr) finEl._flatpickr.destroy();
  iniEl.value = ''; finEl.value = '';

  flatpickr('#' + iniId, {
    ...commonOpts,
    disable: disabled,
    onChange: function(selectedDates, dateStr) {
      const finPicker = finEl._flatpickr;
      if (!finPicker || !selectedDates.length) return;
      // Calcular maxDate: no puede pasar por encima de la siguiente reserva
      const maxDate = getMaxDateAfter(selectedDates[0], ranges);
      // minDate del fin: mismo día que el inicio
      const minFin = new Date(selectedDates[0]);
      finPicker.set('minDate', minFin);
      if (maxDate) {
        finPicker.set('maxDate', maxDate);
      } else {
        finPicker.set('maxDate', null);
      }
      if (finPicker.selectedDates[0] && finPicker.selectedDates[0] < selectedDates[0]) finPicker.clear();
      if (onChangeExtra) onChangeExtra();
    }
  });

  flatpickr('#' + finId, {
    ...commonOpts,
    disable: disabled,
    onChange: function() {
      if (onChangeExtra) onChangeExtra();
    }
  });
}

window.updateAdminDatePickers = function() {
  if (typeof flatpickr === 'undefined') return;
  const cabanaSel = document.getElementById('mn-cab')?.value;
  const blqCabanaSel = document.getElementById('b-cab')?.value;

  setupPickerPair('mn-ini', 'mn-fin', cabanaSel, adminResumenUpdate);
  setupPickerPair('b-ini', 'b-fin', blqCabanaSel, null);
};

document.getElementById('cal-cab-filter')?.addEventListener('change', updateAdminDatePickers);
document.getElementById('b-cab')?.addEventListener('change', updateAdminDatePickers);

function adminCabanaChange() {
  const val = document.getElementById('mn-cab').value;
  ADMIN_NUEVA_RES.cabana = val || null;
  updateAdminDatePickers();
  adminResumenUpdate();
}


// Poblar el filtro de cabanas del calendario (sin precio)
window.populateCalCabFilter = function() {
  var el = document.getElementById('cal-cab-filter');
  if (!el) return;
  var html = '<option value="">Todas las caba\u00f1as</option>';
  for (var key in CABANAS) {
    var cab = CABANAS[key];
    html += '<option value="' + key + '">' + (cab.label || key) + ' (' + (cab.capacidad || '?') + ' pers.)</option>';
  }
  el.innerHTML = html;
};

document.addEventListener('DOMContentLoaded', () => {
  if(window.adminRefreshGlobalCabanas) adminRefreshGlobalCabanas();
});


window.toggleEstadoGlobal = async function(modulo, idValue, elem) {
  const isChecked = elem.checked;
  elem.disabled = true;
  try {
    let method = 'PATCH';
    let url = '/' + modulo + '/' + idValue + '/estado';
    let body = { Estado: isChecked };

    if (modulo === 'usuarios') {
      method = 'PUT';
      body = { estado: isChecked };
    }

    const res = await req(url, { method, body: JSON.stringify(body) });
    if (!res.success && !res.ok) throw new Error(res.message || res.mensaje || 'Error guardando estado');
    
    // Actualizar la etiqueta visual
    const labelSpan = elem.parentElement.previousElementSibling;
    if (labelSpan && labelSpan.tagName === 'SPAN') {
      if (modulo === 'cabanas' || modulo === 'habitaciones') {
        labelSpan.textContent = isChecked ? 'Activa' : 'Inactiva';
      } else {
        labelSpan.textContent = isChecked ? 'Activo' : 'Inactivo';
      }
    }

    // === LIVE SYNC: refrescar datos globales y la reserva ===
    if (modulo === 'paquetes') {
      if (typeof refreshGlobalPackages === 'function') refreshGlobalPackages();
      if (typeof window.adminRefreshGlobalPackages === 'function') window.adminRefreshGlobalPackages();
    } else if (modulo === 'cabanas') {
      if (typeof refreshGlobalCabanas === 'function') refreshGlobalCabanas();
    } else if (modulo === 'servicios') {
      if (typeof refreshGlobalServices === 'function') refreshGlobalServices();
      if (typeof window.adminRefreshGlobalServices === 'function') window.adminRefreshGlobalServices();
    } else if (modulo === 'habitaciones') {
      // Habitaciones no tienen grid en reserva, pero recargamos la lista
      if (typeof window.loadHabitaciones === 'function') window.loadHabitaciones();
    } else if (modulo === 'usuarios') {
      if (typeof window.loadUsuariosAdmin === 'function') window.loadUsuariosAdmin();
    }
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error al cambiar estado');
    elem.checked = !isChecked;
  } finally {
    elem.disabled = false;
  }
};

window.toggleUsuarioRol = async function(idValue, elem) {
  const isChecked = elem.checked;
  elem.disabled = true;
  try {
    // Si esta marcado (true) es Admin, sino (false) es Cliente
    const nuevoRol = isChecked ? 'admin' : 'cliente';
    const res = await req('/usuarios/' + idValue + '/rol', { 
      method: 'PUT', 
      body: JSON.stringify({ rol: nuevoRol }) 
    });
    
    if (!res.success) throw new Error(res.message || 'Error cambiando rol');
    
    const labelSpan = elem.parentElement.previousElementSibling;
    if (labelSpan && labelSpan.tagName === 'SPAN') {
      labelSpan.textContent = isChecked ? 'Admin' : 'Cliente';
      labelSpan.style.color = isChecked ? 'var(--fire)' : '#4caf50';
    }
    // Live-sync: recargar lista de usuarios
    if (typeof window.loadUsuariosAdmin === 'function') window.loadUsuariosAdmin();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error al cambiar rol');
    elem.checked = !isChecked;
  } finally {
    elem.disabled = false;
  }
};


/* ── Mostrar / ocultar contraseña ── */
window.nuTogglePw = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
};

/* ── Fortaleza de contraseña ── */
window.nuCheckPwStrength = function(val) {
  const bars  = ['nu-pw-b1','nu-pw-b2','nu-pw-b3'].map(id => document.getElementById(id));
  const label = document.getElementById('nu-pw-lbl');
  bars.forEach(b => { if(b) b.style.background = 'var(--dark-border)'; });
  if (!val) { if(label) label.textContent = ''; return; }
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  
  const levels = [
    { txt: '', color: 'var(--dark-border)' },
    { txt: 'Débil', color: '#ef5350' },
    { txt: 'Media', color: '#ffca28' },
    { txt: 'Fuerte', color: '#66bb6a' }
  ];
  const lv = levels[score] || levels[1];
  
  bars.slice(0, score).forEach(b => { if(b) b.style.background = lv.color; });
  if(label) label.textContent = lv.txt;
};

/* ── Tipo de documento → país ── */
window.nuOnTipoDocChange = function() {
  const tipo    = document.getElementById('nu-tipo-doc').value;
  const wrap    = document.getElementById('nu-pais-wrap');
  const paisInp = document.getElementById('nu-pais');

  if (tipo === 'CC') {
    wrap.style.display       = 'block';
    paisInp.value            = 'Colombia';
    paisInp.readOnly         = true;
    paisInp.style.background = 'rgba(0,0,0,0.4)';
    paisInp.style.cursor     = 'not-allowed';
  } else if (tipo) {
    wrap.style.display       = 'block';
    paisInp.value            = '';
    paisInp.readOnly         = false;
    paisInp.style.background = '';
    paisInp.style.cursor     = '';
    paisInp.placeholder      = 'Escribe el país';
  } else {
    wrap.style.display = 'none';
    paisInp.value      = '';
    paisInp.readOnly   = false;
    paisInp.style.background = '';
    paisInp.style.cursor     = '';
  }
};

/* ── Validación en tiempo real ── */
window.nuShowReq = function(id) {
  const req = document.getElementById('req-' + id);
  if(req) req.style.display = 'block';
  const err = document.getElementById('err-' + id);
  if(err) err.style.display = 'none';
  const el = document.getElementById(id);
  if (el) el.style.borderColor = '';
};

window.nuValReq = function(id) {
  const el = document.getElementById(id);
  const req = document.getElementById('req-' + id);
  const err = document.getElementById('err-' + id);
  if(req) req.style.display = 'none';
  
  if (id === 'nu-pais' && document.getElementById('nu-pais-wrap').style.display === 'none') {
    if(el) el.style.borderColor = '';
    if(err) err.style.display = 'none';
    return true;
  }
  
  let valid = true;
  let val = el ? el.value.trim() : '';
  if (id === 'nu-password' || id === 'nu-password-confirm') val = el.value;
  
  if (id === 'nu-tel') {
    valid = true;
  } else if (id === 'nu-password') {
    if (val.length < 6) valid = false;
    nuValReq('nu-password-confirm');
  } else if (id === 'nu-password-confirm') {
    const pw = document.getElementById('nu-password').value;
    if (!val || val !== pw) valid = false;
  } else if (id === 'nu-email') {
    if (!val || !val.toLowerCase().endsWith('@gmail.com')) valid = false;
  } else {
    if (!val) valid = false;
  }
  
  if (!valid) {
    if (el) el.style.borderColor = '#ef5350';
    if(err) err.style.display = 'block';
  } else {
    if (el) el.style.borderColor = '';
    if(err) err.style.display = 'none';
  }
  return valid;
};


window.abrirModalNuevoUsuario = function(rolPred) {
  // Reset form
  document.getElementById('f-nuevo-usuario').reset();
  document.getElementById('m-nuevo-usr-alert').innerHTML = '';
  
  ['nu-tipo-doc','nu-num-doc','nu-pais','nu-nombre','nu-apellido','nu-tel','nu-email','nu-password','nu-password-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.borderColor = '';
    const req = document.getElementById('req-' + id);
    if(req) req.style.display = 'none';
    const err = document.getElementById('err-' + id);
    if(err) err.style.display = 'none';
  });
  
  nuOnTipoDocChange();
  nuCheckPwStrength('');

  var btnTxt = document.getElementById('btn-guardar-usuario-txt');
  if (btnTxt) btnTxt.textContent = 'Crear cuenta';
  var btn = document.getElementById('btn-guardar-usuario');
  if (btn) btn.disabled = false;

  // Set title and default role
  var titleEl = document.getElementById('m-nuevo-usr-title');
  var rolSelect = document.getElementById('nu-rol');
  if (rolPred === 'admin') {
    if (titleEl) titleEl.textContent = 'Nuevo Administrador';
    if (rolSelect) rolSelect.value = 'admin';
  } else {
    if (titleEl) titleEl.textContent = 'Nuevo Cliente';
    if (rolSelect) rolSelect.value = 'cliente';
  }

  // Default estado checked
  var estadoCheck = document.getElementById('nu-estado');
  if (estadoCheck) estadoCheck.checked = true;

  openM('m-nuevo-usuario');
};

window.guardarNuevoUsuario = async function(e) {
  e.preventDefault();
  var alertDiv = document.getElementById('m-nuevo-usr-alert');
  var btn = document.getElementById('btn-guardar-usuario');
  var btnTxt = document.getElementById('btn-guardar-usuario-txt');
  
  alertDiv.innerHTML = '';
  
  const fds = ['nu-tipo-doc', 'nu-num-doc', 'nu-pais', 'nu-nombre', 'nu-apellido', 'nu-email', 'nu-tel', 'nu-password', 'nu-password-confirm'];
  let allValid = true;
  for (const f of fds) {
    if (!nuValReq(f)) allValid = false;
  }
  
  if (!allValid) {
    alertDiv.innerHTML = '<div style="background:rgba(239,83,80,0.15);border:1px solid rgba(239,83,80,0.3);color:#ef5350;padding:0.75rem;border-radius:8px;font-size:0.85rem;">\\u2716 Por favor completa todos los campos obligatorios correctamente.</div>';
    return;
  }

  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Creando...';

  try {
    var nombre = document.getElementById('nu-nombre').value.trim();
    var apellido = document.getElementById('nu-apellido').value.trim();
    var email = document.getElementById('nu-email').value.trim();
    var password = document.getElementById('nu-password').value;
    var telefono = document.getElementById('nu-tel') ? document.getElementById('nu-tel').value.trim() : '';
    var pais = document.getElementById('nu-pais').value.trim();
    var tipoDoc = document.getElementById('nu-tipo-doc').value;
    var numDoc = document.getElementById('nu-num-doc').value.trim();
    var rol = document.getElementById('nu-rol').value;
    var estadoCheck = document.getElementById('nu-estado');
    var estado = estadoCheck ? estadoCheck.checked : true;

    var body = { nombre: nombre, apellido: apellido, email: email, password: password, telefono: telefono, pais: pais, tipoDocumento: tipoDoc, numeroDocumento: numDoc, rol: rol, estado: estado };

    var res = await req('/usuarios', { method: 'POST', body: JSON.stringify(body) });

    if (!res.ok && !res.success) {
      throw new Error(res.mensaje || res.message || 'Error al crear usuario');
    }

    alertDiv.innerHTML = '<div style="background:rgba(76,175,80,0.15);border:1px solid rgba(76,175,80,0.3);color:#4caf50;padding:0.75rem;border-radius:8px;font-size:0.85rem;">\\u2714 Cuenta creada exitosamente.</div>';
    if (btnTxt) btnTxt.textContent = '\\u2714 Creado';

    // Reload user lists
    if (typeof window.loadUsuariosAdmin === 'function') window.loadUsuariosAdmin();
    if (typeof window.loadClientesAdmin === 'function') window.loadClientesAdmin();

    // Close modal after 1.5s
    setTimeout(function() { closeM('m-nuevo-usuario'); }, 1500);
  } catch (err) {
    console.error(err);
    alertDiv.innerHTML = '<div style="background:rgba(239,83,80,0.15);border:1px solid rgba(239,83,80,0.3);color:#ef5350;padding:0.75rem;border-radius:8px;font-size:0.85rem;">\\u2716 ' + (err.message || 'Error desconocido') + '</div>';
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = 'Crear cuenta';
  }
};
