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
  dashboard: 'Panel General', reservas: 'Reservas', calendario: 'Calendario',
  clientes: 'Clientes', bloqueos: 'Bloquear Fechas', cabanas: 'Cabañas', paquetes: 'Paquetes',
};

let _editId = null, _delId = null, _viewId = null, _viewReservaData = null;
const _pag = { currentPage: 1, totalPages: 1, total: 0, limit: 10 };

window.customConfirm = function (msg) {
  return new Promise(resolve => {
    document.getElementById('m-confirm-msg').textContent = msg;
    openM('m-confirm');
    const btnOk = document.getElementById('m-confirm-ok');
    const btnCancel = document.getElementById('m-confirm-cancel');
    const cleanup = () => { btnOk.onclick = null; btnCancel.onclick = null; closeM('m-confirm'); };
    btnOk.onclick = () => { cleanup(); resolve(true); };
    btnCancel.onclick = () => { cleanup(); resolve(false); };
  });
};

const CABANAS = {};
const PAQUETES = {};
const SERVICIOS = {};

const ADMIN_NUEVA_RES = { cabana: null, paquete: null, paquetes_extra: new Map(), servicios: new Map() };

/* FIX 10 — cálculo correcto: subtotal sin IVA */
function calcMontos(sub) {
  const s = parseFloat(sub) || 0;
  let iva = 0;
  const total = s + iva;
  return { subtotal: s, iva, total };
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
    _cals['admin-cal'] = { y: new Date().getFullYear(), m: new Date().getMonth(), refresh: refreshAdminCal };
  }

  loadDashboard();
  refreshAdminCal();
  loadReservas();
  initNotificaciones();

  // Establecer fecha mínima en inputs de bloqueo (hoy)
  const _h = new Date(); const hoyStr = `${_h.getFullYear()}-${String(_h.getMonth()+1).padStart(2,'0')}-${String(_h.getDate()).padStart(2,'0')}`;
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
  if (name === 'reservas') loadReservas(1);
  if (name === 'bloqueos') loadBloqueos();
  // Close sidebar on mobile after navigation
  document.body.classList.remove('sidebar-open');
}

/* ════════ CALENDARIOS ════════ */
async function fetchAvail() {
  try {
    const d = await ReservasAPI.disponibilidad();
    return { reservadas: d.data?.reservadas || d.reservadas || [], bloqueadas: d.data?.bloqueadas || d.bloqueadas || [], registros: d.data?.registros || d.registros || [] };
  } catch { return { reservadas: [], bloqueadas: [], registros: [] }; }
}
async function refreshAdminCal() {
  const s = _cals?.['admin-cal']; if (!s) return;
  const cabFilter = document.getElementById('cal-cab-filter')?.value || '';

  // Always fetch from disponibilidad (includes blockages + reservations)
  const d = await fetchAvail();

  if (cabFilter && d.registros) {
    // Filter by cabin using the raw records from disponibilidad
    var reservadas = [], bloqueadas = [];
    d.registros.forEach(function (r) {
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
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
function prevMonth() { const s = _cals['admin-cal']; s.m--; if (s.m < 0) { s.m = 11; s.y--; } refreshAdminCal(); }
function nextMonth() { const s = _cals['admin-cal']; s.m++; if (s.m > 11) { s.m = 0; s.y++; } refreshAdminCal(); }
function onCalCabChange() { refreshAdminCal(); }

/* FIX 4 */
window.IS_BLOCKING_MODE = false;
window.BLOCK_START_DATE = null;

async function onCalDayClick(ds) {
  if (window.IS_BLOCKING_MODE) {
    // ESTAMOS EN MODO BLOQUEO: Este es el segundo clic (Fecha Fin)
    let startDate = window.BLOCK_START_DATE;
    let endDate = ds;

    // Invertir fechas si se seleccionaron al revés
    if (new Date(endDate) < new Date(startDate)) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    const cabanaSeleccionada = document.getElementById('cal-cab-filter').value;

    // Abrir el modal custom de motivo
    document.getElementById('m-motivo-bloqueo').style.display = 'flex';
    const inputMotivo = document.getElementById('mb-motivo-input');
    inputMotivo.value = '';
    inputMotivo.focus();

    // Guardar callback para cuando el usuario acepte el modal
    window.confirmarBloqueo = async function () {
      document.getElementById('m-motivo-bloqueo').style.display = 'none';
      const motivo = inputMotivo.value.trim() || 'Bloqueo Administrativo';

      try {
        await BloqueosAPI.crear({
          FechaInicio: startDate,
          FechaFinalizacion: endDate,
          Motivo: motivo,
          cabana: cabanaSeleccionada
        });
        toast('Fechas bloqueadas con éxito', 'ok');
      } catch (e) {
        toast('Error al bloquear: ' + e.message, 'err');
      }

      window.IS_BLOCKING_MODE = false;
      window.BLOCK_START_DATE = null;
      refreshAdminCal();
      loadDashboard();

      document.getElementById('cal-day-title').textContent = 'Selecciona un día';
      document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Haz clic en un día del calendario para ver las reservas de esa fecha.</p>';
    };

    window.cancelarBloqueo = function () {
      document.getElementById('m-motivo-bloqueo').style.display = 'none';
      window.IS_BLOCKING_MODE = false;
      window.BLOCK_START_DATE = null;
      document.getElementById('cal-day-title').textContent = 'Selecciona un día';
      document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Bloqueo cancelado.</p>';
    };

    return;
  }

  // FLUJO NORMAL: Mostrar información del día
  document.getElementById('cal-day-title').textContent = 'Reservas — ' + fDate(ds);
  document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Buscando…</p>';
  try {
    const [resResp, blqResp] = await Promise.allSettled([
      fetch(`/api/reservas?limit=500&page=1`, { headers: { 'Authorization': `Bearer ${Auth.getToken()}` } }).then(r => r.json()),
      BloqueosAPI.listar()
    ]);

    const d = resResp.status === 'fulfilled' ? resResp.value : {};
    const dBlq = blqResp.status === 'fulfilled' ? blqResp.value : {};

    const rs = (d.data || []).filter(r => r.fecha_inicio <= ds && r.fecha_fin >= ds);
    const bs = (dBlq.data || dBlq.bloqueos || []).filter(b => b.fecha_inicio <= ds && b.fecha_fin >= ds);

    let html = '';

    if (rs.length === 0 && bs.length === 0) {
      html += '<p style="color:var(--dark-muted);font-size:0.85rem;">Sin reservas o bloqueos para este día</p>';
    } else {
      if (rs.length > 0) {
        html += rs.map(r => `<div class="r-row"><div class="r-num">${r.cliente_nombre ? r.cliente_nombre.charAt(0).toUpperCase() : 'C'}</div><div class="r-info"><h4>${r.documento || 'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${CABANAS[r.cabana]?.label || r.cabana || '—'}</p></div></div>`).join('');
      }
      if (bs.length > 0) {
        html += bs.map(b => `<div class="r-row" style="border-left-color:var(--danger);"><div class="r-num" style="color:var(--danger);">Bloqueo</div><div class="r-info"><h4>${b.motivo || 'Mantenimiento / Bloqueado'}</h4><p>${fDate(b.fecha_inicio)} → ${fDate(b.fecha_fin)}</p></div><button class="btn btn-sm btn-danger" onclick="doDesbloquear(${b.id})" style="margin-left:auto;">Quitar</button></div>`).join('');
      }
    }

    html += `
      <div style="margin-top:1.5rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-dark-outline" onclick="adminAbrirBloqueoDia('${ds}')" id="btn-bloquear-fecha">Bloquear Fecha</button>
      </div>`;

    document.getElementById('cal-day-body').innerHTML = html;
  } catch (e) { console.error(e); document.getElementById('cal-day-body').innerHTML = '<p style="color:var(--dark-muted);">Error al cargar</p>'; }
}

window.adminAbrirBloqueoDia = function (ds) {
  const cabanaSeleccionada = document.getElementById('cal-cab-filter').value;
  if (!cabanaSeleccionada) {
    toast('Debes seleccionar una cabaña específica en el calendario superior primero', 'warn');
    return;
  }

  window.IS_BLOCKING_MODE = true;
  window.BLOCK_START_DATE = ds;

  // Cambiar visualmente el estado
  const btn = document.getElementById('btn-bloquear-fecha');
  if (btn) {
    btn.textContent = 'Selecciona la fecha de fin en el calendario';
    btn.style.borderColor = 'var(--danger)';
    btn.style.color = 'var(--danger)';
    btn.onclick = function () {
      // Si dan clic de nuevo al botón cancelar modo
      window.IS_BLOCKING_MODE = false;
      window.BLOCK_START_DATE = null;
      onCalDayClick(ds); // volver a la vista normal
    };
  }

  toast('Selecciona ahora la fecha de fin en el calendario', 'ok');
};

/* ════════ DASHBOARD ════════ */
/* FIX 5 */
let currentDashboardRange = 'todo';

window.loadDashboard = async function (range = currentDashboardRange) {
  currentDashboardRange = range;
  document.querySelectorAll('.t-filter').forEach(btn => btn.classList.toggle('active', btn.dataset.range === range));

  try {
    const token = Auth.getToken();

    // Ensure globals are loaded first so labels in charts are correct
    const refreshPromises = [];
    if (window.adminRefreshGlobalPackages) refreshPromises.push(window.adminRefreshGlobalPackages());
    if (window.adminRefreshGlobalServices) refreshPromises.push(window.adminRefreshGlobalServices());
    if (window.adminRefreshGlobalCabanas) refreshPromises.push(window.adminRefreshGlobalCabanas());
    await Promise.allSettled(refreshPromises);

    // Obtenemos los KPIs nuevos (ventas/total), las reservas y bloqueos para el resto de métricas.
    const [resDash, rR, rB] = await Promise.allSettled([
      req(`/dashboard?range=${range}`),
      fetch(`/api/reservas?limit=5000&page=1`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
      BloqueosAPI.listar()
    ]);

    // Métricas del nuevo dashboard
    if (resDash.status === 'fulfilled' && resDash.value.success) {
      // Actualizamos global reservas y stats
      window.GLOBAL_RESERVAS = rR.status === 'fulfilled' ? (rR.value.data || []) : [];
      window.GLOBAL_DASHBOARD_STATS = resDash.value.data;

      const stats = resDash.value.data;
      document.getElementById('ov-ventas').textContent = '$' + Number(stats.totalSales || 0).toLocaleString('es-CO');
      document.getElementById('ov-total').textContent = stats.totalReservations || 0;

      // Chart.js Setup
      if (window.Chart) {
        const ctxCabanas = document.getElementById('cabanasChart');
        if (ctxCabanas) {
          if (window.cabChartInst) {
            window.cabChartInst.destroy();
            window.cabChartInst = null;
          }
          const topCabinsRaw = Array.isArray(stats.topCabins) ? stats.topCabins : [];
          // Filtrar cabañas que ya no existen
          const topCabins = topCabinsRaw.filter(c => CABANAS[c.name] || (typeof CABANAS === 'object' && Object.values(CABANAS).some(v => v.label === c.name)));
          if (topCabins.length) {
            window.cabChartInst = new Chart(ctxCabanas, {
              type: 'doughnut',
              data: {
                labels: topCabins.map(c => CABANAS[c.name]?.label || c.name),
                datasets: [{
                  data: topCabins.map(c => Number(c.value) || 0),
                  backgroundColor: ['#e85d04', '#ffba08', '#7f4f24', '#f4a261', '#9d0208'],
                  borderWidth: 0
                }]
              },
              options: {
                plugins: { legend: { position: 'right', labels: { color: '#fff', usePointStyle: true, boxWidth: 8 } } },
                maintainAspectRatio: false,
                cutout: '75%'
              }
            });
          }
        }

        // Reservas por mes Chart
        const ctxReservas = document.getElementById('reservasChart');
        if (ctxReservas) {
          if (window.resChartInst) {
            window.resChartInst.destroy();
            window.resChartInst = null;
          }
          const reservationsByMonth = Array.isArray(stats.reservationsByMonth) ? stats.reservationsByMonth : [];
          if (reservationsByMonth.length) {
            window.resChartInst = new Chart(ctxReservas, {
              type: 'bar',
              data: {
                labels: reservationsByMonth.map(r => r.month),
                datasets: [
                  {
                    label: 'Reservas',
                    data: reservationsByMonth.map(r => Number(r.count) || 0),
                    backgroundColor: '#e85d04',
                    borderRadius: 12,
                    borderSkipped: false,
                    maxBarThickness: 45
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: 'rgba(255, 255, 255,0.7)' },
                    grid: { drawOnChartArea: false, color: 'rgba(255, 255, 255,0.05)' }
                  },
                  x: {
                    ticks: { color: 'rgba(255, 255, 255,0.7)' },
                    grid: { display: false }
                  }
                },
                plugins: {
                  legend: { display: false }
                }
              }
            });
          }
        }

        // Ingresos por mes Chart (Area)
        const ctxIngresos = document.getElementById('ingresosChart');
        if (ctxIngresos) {
          if (window.ingresosChartInst) {
            window.ingresosChartInst.destroy();
            window.ingresosChartInst = null;
          }
          const reservationsByMonthRaw = Array.isArray(stats.reservationsByMonth) ? stats.reservationsByMonth : [];

          // Generar los últimos 6 meses para que la gráfica siempre sea una línea (incluso si hay 1 solo mes con datos)
          const last6Months = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = String(d.getMonth() + 1).padStart(2, '0');
            last6Months.push(`${d.getFullYear()}-${m}`);
          }

          const paddedRevenue = last6Months.map(month => {
            const found = reservationsByMonthRaw.find(r => r.month === month);
            return {
              month: month,
              revenue: found ? Number(found.revenue) || 0 : 0
            };
          });

          if (paddedRevenue.length) {
            // Gradient
            const gradient = ctxIngresos.getContext('2d').createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(255, 186, 8, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 186, 8, 0.0)');

            window.ingresosChartInst = new Chart(ctxIngresos, {
              type: 'line',
              data: {
                labels: paddedRevenue.map(r => r.month),
                datasets: [
                  {
                    label: 'Ingresos ($)',
                    data: paddedRevenue.map(r => r.revenue),
                    fill: true,
                    backgroundColor: gradient,
                    borderColor: '#ffba08',
                    borderWidth: 3,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ffba08',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    display: false,
                    beginAtZero: true
                  },
                  x: {
                    ticks: { color: 'rgba(255, 255, 255,0.7)' },
                    grid: { display: false }
                  }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return '$' + context.parsed.y.toLocaleString('es-CO');
                      }
                    }
                  }
                }
              }
            });
          }
        }

        // Servicios por popularidad Chart
        const ctxServicios = document.getElementById('serviciosChart');
        if (ctxServicios) {
          if (window.srvChartInst) {
            window.srvChartInst.destroy();
            window.srvChartInst = null;
          }
          const topServicesRaw = Array.isArray(stats.topServices) ? stats.topServices : [];
          const topServices = topServicesRaw.filter(s => SERVICIOS && SERVICIOS[s.name]);
          if (topServices.length) {
            window.srvChartInst = new Chart(ctxServicios, {
              type: 'doughnut',
              data: {
                labels: topServices.map(s => SERVICIOS[s.name].label),
                datasets: [{
                  data: topServices.map(s => Number(s.value) || 0),
                  backgroundColor: ['#ffba08', '#9d0208', '#f4a261', '#7f4f24', '#e85d04'],
                  borderWidth: 0
                }]
              },
              options: {
                plugins: { legend: { position: 'right', labels: { color: '#fff', usePointStyle: true, boxWidth: 8 } } },
                maintainAspectRatio: false,
                cutout: '75%'
              }
            });
          }
        }

        // Paquetes por popularidad Chart
        const ctxPaquetes = document.getElementById('paquetesChart');
        if (ctxPaquetes) {
          if (window.paqChartInst) {
            window.paqChartInst.destroy();
            window.paqChartInst = null;
          }
          const topPackagesRaw = Array.isArray(stats.topPackages) ? stats.topPackages : [];
          const topPackages = topPackagesRaw.filter(p => PAQUETES && PAQUETES[p.name]);
          if (topPackages.length) {
            window.paqChartInst = new Chart(ctxPaquetes, {
              type: 'doughnut',
              data: {
                labels: topPackages.map(p => PAQUETES[p.name].label),
                datasets: [{
                  data: topPackages.map(p => Number(p.value) || 0),
                  backgroundColor: ['#7f4f24', '#e85d04', '#ffba08', '#9d0208', '#f4a261'],
                  borderWidth: 0
                }]
              },
              options: {
                plugins: { legend: { position: 'right', labels: { color: '#fff', usePointStyle: true, boxWidth: 8 } } },
                maintainAspectRatio: false,
                cutout: '75%'
              }
            });
          }
        }
      }
    }

    refreshAdminCal();

    // Métricas anteriores (pendientes, bloqueos, llegadas)
    const rs = window.GLOBAL_RESERVAS;
    const bl = rB.status === 'fulfilled' ? (rB.value.data || rB.value.bloqueos || []) : [];

    const pend = rs.filter(r => r.estado === 'pendiente').length;

    const ovPendEl = document.getElementById('ov-pend');
    if (ovPendEl) ovPendEl.textContent = pend;

    const ovBloqEl = document.getElementById('ov-bloq');
    if (ovBloqEl) ovBloqEl.textContent = bl.length;

    const badge = document.getElementById('nb-pend');
    if (badge) {
      badge.textContent = pend || '';
      badge.setAttribute('data-empty', pend === 0 ? 'true' : 'false');
    }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const prox = rs.filter(r => new Date(r.fecha_inicio + 'T00:00:00') >= hoy && r.estado !== 'cancelada')
      .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio)).slice(0, 5);

    const proxCountEl = document.getElementById('prox-count');
    if (proxCountEl) proxCountEl.textContent = prox.length;

    const proxListEl = document.getElementById('prox-list');
    if (proxListEl) {
      proxListEl.innerHTML = prox.length
        ? prox.map(r => `<div class="r-row"><div class="r-num">${r.cliente_nombre ? r.cliente_nombre.charAt(0).toUpperCase() : 'C'}</div><div class="r-info"><h4>${r.documento || 'Cliente'} ${statusBadge(r.estado)}</h4><p>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} · ${r.num_personas || 1} pers.</p></div><div class="r-right" style="font-size:0.78rem;color:var(--dark-muted);">${CABANAS[r.cabana]?.label || r.cabana || '—'}</div></div>`).join('')
        : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay próximas llegadas</p>';
    }
  } catch (e) {
    console.error('Dashboard Error:', e);
    ['ov-total', 'ov-pend', 'ov-ventas', 'ov-bloq'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '?'; });
    const px = document.getElementById('prox-list');
    if (px) px.innerHTML = `<p style="color:var(--danger);font-size:0.85rem;">Error: ${e.message}</p>`;
  }
}

window.exportarExcelReservas = async function () {
  try {
    const btn = document.querySelector('.dashboard-controls button.btn-sm');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Exportando...'; }

    // Obtener datos filtrados por fecha si corresponde
    let fechaDesde = '';
    const range = currentDashboardRange;
    const date = new Date();
    if (range === 'hoy') date.setDate(date.getDate());
    else if (range === 'semana') date.setDate(date.getDate() - 7);
    else if (range === 'mes') date.setMonth(date.getMonth() - 1);
    else if (range === '3meses') date.setMonth(date.getMonth() - 3);

    if (range !== 'todo') {
      const pad = n => String(n).padStart(2, '0');
      fechaDesde = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    const resp = await req(`/reservas?limit=5000&page=1${fechaDesde ? '&fechaDesde=' + fechaDesde : ''}`);

    const reservas = resp.data || [];
    if (!reservas.length) {
      toast('No hay reservas para exportar en el rango seleccionado', 'warning');
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Excel'; }
      return;
    }

    // Formatear datos para el Excel
    const data = reservas.map(r => ({
      'ID Reserva': r.id,
      'Fecha Creación': r.fecha_reserva.split('T')[0],
      'Cliente': r.cliente_nombre || r.documento,
      'Cabaña': CABANAS[r.cabana]?.label || r.cabana || 'N/A',
      'Paquete': PAQUETES[r.paquete]?.label || r.paquete || 'Básico',
      'Llegada': r.fecha_inicio,
      'Salida': r.fecha_fin,
      'Total ($)': Number(r.monto_total || 0),
      'Estado': r.estado.toUpperCase()
    }));

    // Crear hoja y libro
    const wb = XLSX.utils.book_new();

    // 1. Hoja: Resumen Financiero
    const stats = window.GLOBAL_DASHBOARD_STATS || {};
    const resumenData = [
      { Metrica: 'Total Ingresos Ganados', Valor: Number(stats.totalSales || 0) },
      { Metrica: 'Total Reservas (Activas/Completadas)', Valor: Number(stats.totalReservations || 0) },
      { Metrica: 'Rango de Tiempo', Valor: range.toUpperCase() }
    ];
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Financiero");
    wsResumen['!cols'] = [{ wch: 40 }, { wch: 20 }];

    // 2. Hoja: Top Cabañas
    const cabanasData = (stats.topCabins || []).map(c => ({
      'Cabaña': CABANAS[c.name]?.label || c.name,
      'Reservas': Number(c.value)
    }));
    if (cabanasData.length) {
      const wsCabanas = XLSX.utils.json_to_sheet(cabanasData);
      XLSX.utils.book_append_sheet(wb, wsCabanas, "Top Cabañas");
      wsCabanas['!cols'] = [{ wch: 30 }, { wch: 15 }];
    }

    // 3. Hoja: Top Paquetes
    const paquetesData = (stats.topPackages || []).map(p => ({
      'Paquete': PAQUETES[p.name]?.label || p.name,
      'Reservas': Number(p.value)
    }));
    if (paquetesData.length) {
      const wsPaquetes = XLSX.utils.json_to_sheet(paquetesData);
      XLSX.utils.book_append_sheet(wb, wsPaquetes, "Top Paquetes");
      wsPaquetes['!cols'] = [{ wch: 30 }, { wch: 15 }];
    }

    // 4. Hoja: Top Servicios
    const serviciosData = (stats.topServices || []).map(s => ({
      'Servicio': SERVICIOS && SERVICIOS[s.name] ? SERVICIOS[s.name].label : s.name,
      'Veces Contratado': Number(s.value)
    }));
    if (serviciosData.length) {
      const wsServicios = XLSX.utils.json_to_sheet(serviciosData);
      XLSX.utils.book_append_sheet(wb, wsServicios, "Top Servicios");
      wsServicios['!cols'] = [{ wch: 30 }, { wch: 20 }];
    }

    // 5. Hoja: Detalle de Reservas
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Detalle Reservas");

    // Configurar anchos de columna para reservas
    ws['!cols'] = [
      { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
    ];

    // Descargar
    XLSX.writeFile(wb, `Reporte_General_${range}_${new Date().toISOString().split('T')[0]}.xlsx`);

    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Excel'; }
    toast('Excel exportado correctamente', 'ok');
  } catch (e) {
    console.error(e);
    toast('Error exportando Excel', 'error');
    const btn = document.querySelector('.dashboard-controls button.btn-sm');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Excel'; }
  }
}

/* ════════ RESERVAS ════════ */
async function loadReservas(page = 1) {
  const estado = document.getElementById('fil-estado').value;
  const fecha = document.getElementById('fil-fecha').value;
  const q = document.getElementById('fil-res-q')?.value?.trim() || '';
  const tbody = document.getElementById('res-list-container') || document.getElementById('res-tbody');
  const params = new URLSearchParams();
  if (estado) params.append('estado', estado);
  if (fecha) params.append('fechaDesde', fecha);
  if (q) params.append('q', q);
  params.append('page', page);
  params.append('limit', _pag.limit);
  try {
    const resp = await fetch(`/api/reservas?${params}`, { headers: { 'Authorization': `Bearer ${Auth.getToken()}` } });
    const d = await resp.json();
    if (d.ok) {
      const rs = d.data || [];
      _pag.currentPage = d.currentPage || 1;
      _pag.totalPages = d.totalPages || 1;
      _pag.total = d.total || 0;
      document.getElementById('res-count').textContent = `${_pag.total} resultado(s)`;
      tbody.innerHTML = rs.length
        ? rs.map(r => {
          const bl = ['cancelada', 'completada'].includes(r.estado);
          const selectHtml = `<select class="btn btn-sm btn-dark-outline" style="text-align:center; appearance:none; cursor:pointer; background:var(--dark-bg); color: #fff; padding:0.2rem 0.5rem;" onchange="cambiarEstadoDirecto(${r.id}, this.value)" ${bl ? 'disabled title="Estado finalizado"' : ''}>
                  <option value="${r.estado}" selected hidden>${r.estado.toUpperCase()}</option>
                  ${r.estado === 'pendiente' ? `
                    <option value="confirmada" style="color: #fff;background:var(--dark-bg);">Confirmada</option>
                    <option value="cancelada" style="color: #fff;background:var(--dark-bg);">Cancelada</option>
                  ` : ''}
                  ${r.estado === 'confirmada' ? `
                    <option value="completada" style="color: #fff;background:var(--dark-bg);">Completada</option>
                    <option value="cancelada" style="color: #fff;background:var(--dark-bg);">Cancelada</option>
                  ` : ''}
                </select>`;
          return `<div class="res-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
              <div class="res-info" style="flex:1;">
                <h4>${fDate(r.fecha_inicio)} → ${fDate(r.fecha_fin)} ${statusBadge(r.estado)}</h4>
                <p>${r.num_personas||1} personas · ${CABANAS[r.cabana]?.label||r.cabana||''} · ${PAQUETES[r.paquete]?.label||r.paquete||''}</p>
                <p style="margin-top:0.3rem;font-size:0.8rem;color:#aaa;">Cliente: ${r.cliente_nombre ? `${r.cliente_nombre} (${r.documento})` : (r.documento || '—')}</p>
              </div>
              <div class="res-actions" style="flex-shrink:0;">
                ${selectHtml}
                <button class="btn btn-outline btn-sm" onclick="abrirVerReserva(${r.id})" style="background-color:#fff;color:#000;border:none;">Ver</button>
                <button class="btn btn-fire btn-sm" onclick="abrirAddServiciosAdmin(${r.id})">Añadir Extras</button>
              </div>
            </div>
          </div>`;
        }).join('')
        : `<div class="price-empty"><p>Sin resultados</p></div>`;
      updatePagCtrl();
    } else {
      tbody.innerHTML = `<div class="price-empty"><p>Error al cargar reservas</p></div>`;
    }
  } catch {
    tbody.innerHTML = `<div class="price-empty"><p>Inicia el servidor para ver reservas</p></div>`;
  }
}

function updatePagCtrl() {
  const el = document.getElementById('pagination-controls'); if (!el) return;
  const { currentPage, totalPages } = _pag;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;padding:1rem;">
    <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
    <span style="color:var(--dark-muted);font-size:0.85rem;">Página ${currentPage} de ${totalPages}</span>
    <button class="btn btn-sm btn-dark-outline" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
  </div>`;
}
function goToPage(p) { if (p < 1 || p > _pag.totalPages) return; loadReservas(p); }
function clearFil() { document.getElementById('fil-estado').value = ''; document.getElementById('fil-fecha').value = ''; const qEl = document.getElementById('fil-res-q'); if (qEl) qEl.value = ''; loadReservas(1); }
function verTodasReservas() { clearFil(); }

let _resSearchDebounce = null;
window.resLiveSearch = function () {
  clearTimeout(_resSearchDebounce);
  _resSearchDebounce = setTimeout(() => loadReservas(1), 300);
};

/* ════════ ESTADO ════════ */
function abrirEstado(id, curr) { _editId = id; document.getElementById('m-est-id').textContent = id; document.getElementById('m-est-val').value = curr; openM('m-estado'); }
/* FIX 11 */
async function guardarEstado() {
  try {
    await ReservasAPI.actualizar(_editId, { estado: document.getElementById('m-est-val').value });
    closeM('m-estado'); toast('Estado actualizado', 'ok');
    loadReservas(_pag.currentPage); loadDashboard();
  } catch (e) { toast(e.message, 'err'); }
}

window._adminCancelReservaId = null;

async function cambiarEstadoDirecto(id, nuevoEstado) {
  if (nuevoEstado === 'cancelada') {
    window._adminCancelReservaId = id;
    const elMotivo = document.getElementById('m-admin-cancel-motivo');
    if (elMotivo) elMotivo.value = '';
    openM('m-admin-cancel');
    return;
  }

  try {
    await ReservasAPI.actualizar(id, { estado: nuevoEstado });
    toast('Estado actualizado correctamente', 'ok');
    loadReservas(_pag.currentPage);
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (e) {
    toast(e.message, 'err');
    loadReservas(_pag.currentPage);
  }
}

window.doAdminCancelReserva = async function() {
  const id = window._adminCancelReservaId;
  if (!id) return;
  const motivoEl = document.getElementById('m-admin-cancel-motivo');
  const motivo = motivoEl ? motivoEl.value.trim() : '';
  
  if (motivo === '') {
    toast('Debes ingresar un motivo para cancelar', 'err');
    return;
  }
  
  const btn = document.getElementById('btn-admin-cancel-confirm');
  try {
    if (btn) setLoading(btn, true, 'Cancelando...');
    await ReservasAPI.actualizar(id, { estado: 'cancelada', motivo: `Admin: ${motivo}` });
    if (btn) setLoading(btn, false, 'Confirmar Cancelación');
    closeM('m-admin-cancel');
    toast('Reserva cancelada correctamente', 'ok');
    loadReservas(_pag.currentPage);
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (e) {
    if (btn) setLoading(btn, false, 'Confirmar Cancelación');
    toast(e.message, 'err');
  }
};

/* ════════ VER RESERVA ════════ */
async function abrirVerReserva(id) {
  try {
    const res = await ReservasAPI.una(id);
    const reserva = res.data || res;
    const ini = new Date(reserva.fecha_inicio || reserva.FechaInicio);
    const fin = new Date(reserva.fecha_fin || reserva.FechaFinalizacion);
    const noches = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24));
    let servicios = [];
    if (reserva.servicios) {
      servicios = typeof reserva.servicios === 'string' ? JSON.parse(reserva.servicios) : (Array.isArray(reserva.servicios) ? reserva.servicios : []);
    }
    let paquetesExtra = [];
    if (reserva.paquetes_extra) {
      paquetesExtra = typeof reserva.paquetes_extra === 'string' ? JSON.parse(reserva.paquetes_extra) : (Array.isArray(reserva.paquetes_extra) ? reserva.paquetes_extra : []);
    }
    const cabanaObj = CABANAS[reserva.cabana];
    const cabanaLabel = cabanaObj?.label || reserva.cabana || '—';
    const cabanaDesc = cabanaObj?.descripcion || '';
    const paqueteObj = PAQUETES[reserva.paquete];
    const paqueteLabel = paqueteObj?.label || reserva.paquete || '—';
    const paqueteDesc = paqueteObj?.descripcion || '';

    // ── Build cancellation info ──
    const estadoRes = reserva.estado || 'pendiente';
    let cancelInfoHtml = '';
    if (estadoRes === 'cancelada' && reserva.motivo) {
      const parts = reserva.motivo.split(': ');
      const quien = parts[0] || 'Desconocido';
      const razon = parts.slice(1).join(': ') || reserva.motivo;
      cancelInfoHtml = `
        <div style="background:rgba(220,53,69,0.1);border:1px solid rgba(220,53,69,0.3);border-radius:12px;padding:1.25rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
            <span style="font-size:1.1rem;">❌</span>
            <span style="font-weight:700;font-size:0.95rem;color:var(--danger);">Reserva Cancelada</span>
          </div>
          <p style="color:var(--dark-muted);font-size:0.88rem;margin:0;">Cancelado por <strong style="color: #fff;">${quien}</strong>: ${razon}</p>
        </div>`;
    }

    // ── Fecha de creación ──
    const fechaCreacion = (reserva.fecha_reserva || reserva.FechaReserva)
      ? new Date(reserva.fecha_reserva || reserva.FechaReserva).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    // ── Cabaña image ──
    let cabanaImgHtml = '';
    if (cabanaObj) {
      let imgSrc = cabanaObj.imagen || 'assets/images/cabana-roble.jpg';
      let imgExt = cabanaObj.imagenCabana || null;
      let imgInt = cabanaObj.imagenHabitacion || null;
      let arrExt = [], arrInt = [];
      try { arrExt = imgExt && imgExt.startsWith('[') ? JSON.parse(imgExt) : (imgExt ? [imgExt] : []); } catch(e) { arrExt = imgExt ? [imgExt] : []; }
      try { arrInt = imgInt && imgInt.startsWith('[') ? JSON.parse(imgInt) : (imgInt ? [imgInt] : []); } catch(e) { arrInt = imgInt ? [imgInt] : []; }

      if (arrExt.length > 0 && arrInt.length > 0) {
        cabanaImgHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;">
            <div style="position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--dark-border);cursor:pointer;" onclick="verImagenCompleta('${arrExt[0]}')">
              <img src="${arrExt[0]}" alt="${cabanaLabel} Exterior" style="width:100%;height:180px;object-fit:cover;display:block;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='assets/images/cabana-roble.jpg'">
              <div style="position:absolute;bottom:0;left:0;right:0;padding:0.4rem 0.75rem;background:linear-gradient(transparent,rgba(0,0,0,0.7));font-size:0.72rem;color: #fff;font-weight:600;">Exterior</div>
            </div>
            <div style="position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--dark-border);cursor:pointer;" onclick="verImagenCompleta('${arrInt[0]}')">
              <img src="${arrInt[0]}" alt="${cabanaLabel} Interior" style="width:100%;height:180px;object-fit:cover;display:block;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='assets/images/cabana-roble.jpg'">
              <div style="position:absolute;bottom:0;left:0;right:0;padding:0.4rem 0.75rem;background:linear-gradient(transparent,rgba(0,0,0,0.7));font-size:0.72rem;color: #fff;font-weight:600;">Habitación</div>
            </div>
          </div>`;
      } else if (imgSrc) {
        cabanaImgHtml = `
          <div style="position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--dark-border);margin-bottom:1rem;cursor:pointer;" onclick="verImagenCompleta('${imgSrc}')">
            <img src="${imgSrc}" alt="${cabanaLabel}" style="width:100%;height:220px;object-fit:cover;display:block;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='assets/images/cabana-roble.jpg'">
          </div>`;
      }
    }

    // ── Cabaña meta info ──
    let cabanaMetaHtml = '';
    if (cabanaObj) {
      const metaPills = [];
      if (cabanaObj.capacidad) metaPills.push(`<span style="background:rgba(255, 255, 255,0.06);border:1px solid var(--dark-border);padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem;display:inline-flex;align-items:center;gap:0.3rem;">👥 ${cabanaObj.capacidad} pers.</span>`);
      if (cabanaObj.numeroHabitaciones) metaPills.push(`<span style="background:rgba(255, 255, 255,0.06);border:1px solid var(--dark-border);padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem;display:inline-flex;align-items:center;gap:0.3rem;">🛏 ${cabanaObj.numeroHabitaciones} hab.</span>`);
      if (cabanaObj.ubicacion) metaPills.push(`<span style="background:rgba(255, 255, 255,0.06);border:1px solid var(--dark-border);padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem;display:inline-flex;align-items:center;gap:0.3rem;">📍 ${cabanaObj.ubicacion}</span>`);
      if (cabanaObj.precio) metaPills.push(`<span style="background:rgba(232,93,4,0.12);border:1px solid rgba(232,93,4,0.25);padding:0.3rem 0.7rem;border-radius:20px;font-size:0.78rem;color:var(--fire);font-weight:700;display:inline-flex;align-items:center;gap:0.3rem;">${fCop(cabanaObj.precio)}/día</span>`);
      cabanaMetaHtml = metaPills.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem;">${metaPills.join('')}</div>` : '';
    }

    // ── Paquete section with image ──
    let paqueteImgHtml = '';
    let paqueteIncludedHtml = '';
    if (paqueteObj) {
      const srvIds = paqueteObj.includedServices || [];
      if (srvIds.length > 0) {
        let includedItems = srvIds.map(sid => {
          const sObj = SERVICIOS[sid];
          if (!sObj) return '';
          const sImg = sObj.imagen ? `<img src="${sObj.imagen}" alt="${sObj.label}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:0.4rem;border:1px solid var(--dark-border);cursor:pointer;" onclick="verImagenCompleta('${sObj.imagen}')" onerror="this.style.display='none'">` : '';
          return `
            <div style="background:rgba(255, 255, 255,0.03);border:1px solid var(--dark-border);border-radius:10px;padding:0.75rem;text-align:center;">
              ${sImg}
              <div style="font-size:0.82rem;font-weight:600;color: #fff;">${sObj.label}</div>
            </div>`;
        }).filter(Boolean).join('');

        if (includedItems) {
          paqueteIncludedHtml = `
            <div style="margin-top:0.75rem;">
              <div style="font-size:0.78rem;color:var(--dark-muted);font-weight:600;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em;">Servicios incluidos en el paquete:</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.75rem;">${includedItems}</div>
            </div>`;
        }
      }
    }

    // ── Paquetes Extra ──
    let paquetesExtraHtml = '';
    if (paquetesExtra && paquetesExtra.length > 0) {
      const pItems = paquetesExtra.map(pid => {
        const pObj = PAQUETES[pid];
        if (!pObj) return '';
        return `
          <div style="background:rgba(255, 255, 255,0.03);border:1px solid var(--dark-border);border-radius:10px;padding:0.75rem;text-align:center;">
            <div style="font-size:0.82rem;font-weight:600;color: #fff;">Paquete Extra: ${pObj.label}</div>
            ${pObj.precio ? `<div style="font-size:0.75rem;color:var(--dark-muted);margin-top:0.4rem;">${fCop(pObj.precio * (reserva.num_personas||1))}</div>` : ''}
          </div>`;
      }).filter(Boolean).join('');
      
      if (pItems) {
        paquetesExtraHtml = `
          <div style="margin-top:1rem;">
            <h5 style="color: #fff;font-size:1.1rem;margin-bottom:0.75rem;">Paquetes Extra</h5>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.75rem;">
              ${pItems}
            </div>
          </div>
        `;
      }
    }

    // ── Servicios adicionales con imágenes ──
    let srvCardsHtml = '';
    if (servicios.length > 0) {
      const srvItems = servicios.map(s => {
        const srvId = typeof s==='string' ? s : s.id;
        const sObj = SERVICIOS[srvId];
        const lbl = sObj?.label || (typeof s==='string' ? s : s.label || s);
        const sImg = sObj?.imagen || null;

        return `
          <div style="background:rgba(255, 255, 255,0.03);border:1px solid var(--dark-border);border-radius:12px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
            ${sImg ? `<div style="position:relative;overflow:hidden;cursor:pointer;" onclick="verImagenCompleta('${sImg}')"><img src="${sImg}" alt="${lbl}" style="width:100%;height:120px;object-fit:cover;display:block;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.parentElement.style.display='none'"></div>` : ''}
            <div style="padding:0.75rem;text-align:center;">
              <span style="background:var(--fire-soft);color:var(--fire);padding:0.25rem 0.6rem;border-radius:6px;font-size:0.8rem;font-weight:700;display:inline-flex;align-items:center;gap:0.25rem;">✓ ${lbl}</span>
              ${sObj?.precio ? `<div style="font-size:0.75rem;color:var(--dark-muted);margin-top:0.4rem;">${fCop(sObj.precio)}</div>` : ''}
            </div>
          </div>`;
      }).join('');

      srvCardsHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.75rem;">
          ${srvItems}
        </div>`;
    } else {
      srvCardsHtml = '<div style="font-size:0.9rem;color:var(--dark-muted);font-style:italic;">Sin servicios adicionales</div>';
    }

    // ── Build final HTML ──
    document.getElementById('m-view-id').textContent = id;
    document.getElementById('m-view-body').innerHTML=`
      <div style="display:grid;gap:1.5rem;">
        ${cancelInfoHtml}

        <!-- ID, Estado y fecha de creación -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;padding-bottom:1rem;border-bottom:1px solid var(--dark-border);">
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <span style="font-family:var(--font-display);font-size:1.1rem;font-weight:800;color: #fff;">Reserva</span>
            ${statusBadge(estadoRes)}
          </div>
          <p style="color:var(--dark-muted);font-size:0.85rem;margin:0;">📅 Fecha de creación: <strong style="color: #fff;">${fechaCreacion}</strong></p>
        </div>

        <!-- Fechas y datos -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;background:rgba(255, 255, 255,0.03);border:1px solid var(--dark-border);border-radius:12px;padding:1.25rem;">
          <div style="text-align:center;">
            <div style="font-size:0.72rem;color:var(--dark-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">Fecha llegada</div>
            <div style="font-size:1rem;font-weight:700;color:var(--sand);">${fDate(reserva.fecha_inicio||reserva.FechaInicio)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.72rem;color:var(--dark-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">Fecha salida</div>
            <div style="font-size:1rem;font-weight:700;color:var(--sand);">${fDate(reserva.fecha_fin||reserva.FechaFinalizacion)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.72rem;color:var(--dark-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">Duración</div>
            <div style="font-size:1rem;font-weight:700;color:var(--sand);">${noches} ${noches===1?'noche':'noches'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.72rem;color:var(--dark-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">Personas</div>
            <div style="font-size:1rem;font-weight:700;color:var(--sand);">${reserva.num_personas||1}</div>
          </div>
        </div>

        <!-- Cabaña -->
        <div style="background:rgba(255, 255, 255,0.02);border:1px solid var(--dark-border);border-radius:14px;overflow:hidden;">
          <div style="padding:1rem 1.25rem 0.5rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:1.1rem;">🏠</span>
            <span style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Cabaña</span>
          </div>
          <div style="padding:0 1.25rem 1.25rem;">
            ${cabanaImgHtml}
            <h4 style="font-size:1.15rem;margin:0 0 0.3rem;color: #fff;font-weight:700;">${cabanaLabel}</h4>
            ${cabanaDesc ? `<p style="font-size:0.85rem;color:rgba(255, 255, 255,0.6);margin:0;line-height:1.6;">${cabanaDesc}</p>` : ''}
            ${cabanaMetaHtml}
          </div>
        </div>

        <!-- Paquete -->
        <div style="background:rgba(255, 255, 255,0.02);border:1px solid var(--dark-border);border-radius:14px;overflow:hidden;">
          <div style="padding:1rem 1.25rem 0.5rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:1.1rem;">📦</span>
            <span style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Paquete</span>
          </div>
          <div style="padding:0 1.25rem 1.25rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
              <h4 style="font-size:1.1rem;margin:0;color: #fff;font-weight:700;">${paqueteLabel}</h4>
              ${paqueteObj?.precio ? `<span style="background:rgba(232,93,4,0.12);border:1px solid rgba(232,93,4,0.25);padding:0.3rem 0.75rem;border-radius:20px;font-size:0.85rem;color:var(--fire);font-weight:700;">+${fCop(paqueteObj.precio)}</span>` : ''}
            </div>
            ${paqueteDesc ? `<p style="font-size:0.85rem;color:rgba(255, 255, 255,0.6);margin:0.4rem 0 0;line-height:1.6;">${paqueteDesc}</p>` : ''}
            ${paqueteIncludedHtml}
            ${paquetesExtraHtml}
          </div>
        </div>

        <!-- Servicios Adicionales -->
        <div style="background:rgba(255, 255, 255,0.02);border:1px solid var(--dark-border);border-radius:14px;overflow:hidden;">
          <div style="padding:1rem 1.25rem 0.75rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:1.1rem;">✨</span>
            <span style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Servicios Adicionales</span>
          </div>
          <div style="padding:0 1.25rem 1.25rem;">
            ${srvCardsHtml}
          </div>
        </div>

        <!-- Notas -->
        ${reserva.notas ? `
        <div style="background:rgba(255, 255, 255,0.02);border:1px solid var(--dark-border);border-radius:14px;padding:1.25rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
            <span style="font-size:1rem;">📝</span>
            <span style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Notas</span>
          </div>
          <p style="font-size:0.9rem;color:var(--sand);font-style:italic;margin:0;line-height:1.6;">${reserva.notas}</p>
        </div>` : ''}

        <!-- Resumen de Pago -->
        <div style="background:rgba(255, 255, 255,0.02);border:1px solid var(--dark-border);border-radius:14px;padding:1.25rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span style="font-size:1.1rem;">💳</span>
            <span style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Información de Pago</span>
          </div>
          <div style="display:grid;gap:0.6rem;font-size:0.9rem;color:var(--dark-muted);">
            <div style="display:flex;justify-content:space-between;"><span>Documento Cliente:</span><strong style="color: #fff;">${reserva.NroDocumentoCliente||reserva.documento||reserva.id_cliente||'—'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>Método de Pago:</span><strong style="color: #fff;text-transform:capitalize;">${reserva.metodo_pago||reserva.MetodoPago||'No especificado'}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-top:0.4rem;"><span>Subtotal:</span><strong style="color: #fff;">${fCop(reserva.subtotal||reserva.SubTotal||0)}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>IVA:</span><strong style="color: #fff;">${fCop(reserva.iva||reserva.IVA||0)}</strong></div>
            ${(reserva.descuento||reserva.Descuento) ? `<div style="display:flex;justify-content:space-between;color:var(--success);"><span>Descuento:</span><strong>-${fCop(reserva.descuento||reserva.Descuento)}</strong></div>` : ''}
            
            ${(() => {
              let hist = reserva.pagos_historial;
              if (typeof hist === 'string') { try { hist = JSON.parse(hist); } catch(e) { hist = null; } }
              if (!Array.isArray(hist) || hist.length === 0) {
                return `<div style="display:flex;justify-content:space-between;padding-top:0.6rem;margin-top:0.2rem;border-top:1px dashed var(--dark-border);"><span>Monto Pagado:</span><strong style="color:var(--success);font-size:1rem;">${fCop(reserva.monto_pagado||reserva.MontoPagado||0)}</strong></div>`;
              }
              let histHtml = '<div style="padding-top:0.6rem;margin-top:0.2rem;border-top:1px dashed var(--dark-border);">';
              histHtml += '<div style="font-size:0.75rem;color:var(--dark-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">Historial de Pagos</div>';
              hist.forEach((p, i) => {
                const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', {day:'2-digit',month:'short',year:'numeric'}) : '';
                histHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;${i > 0 ? 'border-top:1px solid rgba(255,255,255,0.05);' : ''}">
                  <div>
                    <div style="color:#fff;font-weight:600;font-size:0.85rem;">${p.descripcion || 'Pago'}</div>
                    <div style="color:var(--dark-muted);font-size:0.75rem;">${fecha}</div>
                  </div>
                  <strong style="color:var(--success);">${fCop(p.monto || 0)}</strong>
                </div>`;
              });
              histHtml += '</div>';
              return histHtml;
            })()}
          </div>
        </div>

        <!-- Total -->
        <div style="background:linear-gradient(135deg,rgba(232,93,4,0.12),rgba(192,57,43,0.08));padding:1.25rem 1.5rem;border-radius:14px;border:1px solid rgba(232,93,4,0.25);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-weight:700;font-size:0.95rem;color: #fff;">Total de la Reserva</span>
              <div style="font-size:0.78rem;color:var(--dark-muted);margin-top:0.15rem;">Incluye todos los impuestos y servicios</div>
            </div>
            <span style="font-family:var(--font-display);font-size:1.8rem;font-weight:800;color:var(--fire);">${fCop(reserva.monto_total||reserva.MontoTotal||0)}</span>
          </div>
        </div>

        <!-- Check-in/Check-out reminder -->
        <div style="background:rgba(232,93,4,0.15);padding:0.75rem 1rem;border-radius:8px;text-align:center;font-size:0.9rem;color:var(--fire);border:1px solid rgba(232,93,4,0.3);">
          <span style="font-weight:800;color:var(--fire);">🕐 Check-in:</span> <span style="font-weight:600;color:var(--fire);">1:00 PM</span> <span style="opacity:0.5;margin:0 0.5rem;color:var(--fire);">|</span> <span style="font-weight:800;color:var(--fire);">Check-out:</span> <span style="font-weight:600;color:var(--fire);">12:00 PM</span>
        </div>
      </div>`;
    openM('m-view-reserva');
  } catch (err) { toast(err.message || 'No se pudo cargar', 'err'); }
}

/* ════════ EDITAR RESERVA ════════ */
async function abrirDetalle(id) {
  _viewId = id;
  const elId = document.getElementById('m-det-id');
  if (elId) elId.textContent = id;
  const elAlert = document.getElementById('m-det-alert');
  if (elAlert) elAlert.innerHTML = '';
  try {
    const res = await ReservasAPI.una(id); const reserva = res.data || res;
    if (['cancelada', 'completada'].includes(reserva.estado)) { toast('No editable', 'err'); return; }
    _viewReservaData = reserva;
    window._editReservaSrvs = new Map(Array.isArray(reserva.servicios) ? reserva.servicios.map(s => [String(s.id || s), s.cantidad || 1]) : []);
    window._editReservaSrvsOriginales = new Map(window._editReservaSrvs);
    window._editReservaPaquetesExtra = new Set(Array.isArray(reserva.paquetes_extra) ? reserva.paquetes_extra.map(String) : []);
    const elDoc = document.getElementById('m-det-doc');
    if (elDoc) elDoc.value = reserva.documento || '';
    const selCab = document.getElementById('m-det-cabana');
    if (selCab) {
      selCab.value = reserva.cabana;
      if (!selCab.value && selCab.options.length > 0) {
        const targetStr = String(reserva.cabana || '').toLowerCase();
        let matched = false;
        for (let i = 0; i < selCab.options.length; i++) {
          if (selCab.options[i].text.toLowerCase().includes(targetStr) || selCab.options[i].value === targetStr) {
            selCab.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) selCab.selectedIndex = 0;
      }
    }

    const elIni = document.getElementById('m-det-ini');
    if (elIni) elIni.value = reserva.fecha_inicio || '';
    const elFin = document.getElementById('m-det-fin');
    if (elFin) elFin.value = reserva.fecha_fin || '';

    const selPaq = document.getElementById('m-det-paquete');
    if (selPaq) {
      selPaq.value = reserva.paquete;
      if (!selPaq.value && selPaq.options.length > 0 && reserva.paquete) {
        const targetStr = String(reserva.paquete || '').toLowerCase();
        let matched = false;
        for (let i = 0; i < selPaq.options.length; i++) {
          if (selPaq.options[i].text.toLowerCase().includes(targetStr) || selPaq.options[i].value === targetStr) {
            selPaq.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) selPaq.value = '';
      }
      selPaq.disabled = true; // El paquete inicial no se puede modificar
    }

    const selPaqExtra = document.getElementById('m-det-paquete-extra');
    if (selPaqExtra) selPaqExtra.value = ''; // Limpiar extra al abrir

    const elPersonas = document.getElementById('m-det-personas');
    if (elPersonas) elPersonas.value = reserva.num_personas || 1;
    const elNotas = document.getElementById('m-det-notas');
    if (elNotas) elNotas.value = reserva.notas || '';
    const _hd = new Date(); const hoyStr = `${_hd.getFullYear()}-${String(_hd.getMonth()+1).padStart(2,'0')}-${String(_hd.getDate()).padStart(2,'0')}`;
    const elDetIni = document.getElementById('m-det-ini');
    if (elDetIni) elDetIni.setAttribute('min', hoyStr);
    if (reserva.fecha_inicio) {
      const mf = new Date(reserva.fecha_inicio + 'T12:00:00'); mf.setDate(mf.getDate() + 1);
      const elDetFin = document.getElementById('m-det-fin');
      if (elDetFin) elDetFin.setAttribute('min', `${mf.getFullYear()}-${String(mf.getMonth()+1).padStart(2,'0')}-${String(mf.getDate()).padStart(2,'0')}`);
    }

    // Clear dynamic payment section
    const elPagoNuevos = document.getElementById('m-det-pago-nuevos');
    if (elPagoNuevos) elPagoNuevos.style.display = 'none';
    // Reset the save button text
    const btnGuardar = document.getElementById('m-det-btn-guardar');
    if (btnGuardar) btnGuardar.textContent = 'Guardar cambios';

    // Trigger person count changes
    if (elPersonas) {
      elPersonas.addEventListener('input', () => {
        if (typeof window.renderDetSrvs === 'function') window.renderDetSrvs();
      });
    }

    if (typeof window.renderDetSrvs === 'function') window.renderDetSrvs();
    openM('m-detalle-admin');
  } catch (err) { toast(err.message || 'Error', 'err'); }
}


function mDetRangeCheck() {
  const iniEl = document.getElementById('m-det-ini'), finEl = document.getElementById('m-det-fin');
  const ini = iniEl.value; const _hm = new Date(); const hoyStr = `${_hm.getFullYear()}-${String(_hm.getMonth()+1).padStart(2,'0')}-${String(_hm.getDate()).padStart(2,'0')}`;
  if (ini && ini < hoyStr) { iniEl.value = ''; finEl.value = ''; return; }
  if (ini && finEl.value && new Date(finEl.value) < new Date(ini)) finEl.value = '';
  if (ini) { finEl.setAttribute('min', ini); }
}

async function guardarDetalleReserva() {
  if (!_viewId) return;
  const ini = document.getElementById('m-det-ini').value, fin = document.getElementById('m-det-fin').value;
  const cabana = document.getElementById('m-det-cabana').value, paquete = document.getElementById('m-det-paquete').value;
  const personas = Number(document.getElementById('m-det-personas').value) || 1;
  const notas = document.getElementById('m-det-notas').value.trim();
  const alertEl = document.getElementById('m-det-alert');
  const alertFooterEl = document.getElementById('m-det-alert-footer');
  if (alertEl) alertEl.innerHTML = '';
  if (alertFooterEl) alertFooterEl.innerHTML = '';

  const _hg = new Date(); const hoyStr = `${_hg.getFullYear()}-${String(_hg.getMonth()+1).padStart(2,'0')}-${String(_hg.getDate()).padStart(2,'0')}`;
  if (!ini || !fin) { alertEl.innerHTML = `<div class="alert alert-error">⚠ Selecciona fechas.</div>`; return; }
  if (ini < hoyStr) { alertEl.innerHTML = `<div class="alert alert-error">⚠ Fecha inicio debe ser desde hoy.</div>`; return; }
  if (new Date(fin) < new Date(ini)) { alertEl.innerHTML = `<div class="alert alert-error">⚠ Fecha fin debe ser igual o posterior.</div>`; return; }
  // Combine original services + newly added services for the full list
  const srvNuevos = Array.from(window._editReservaSrvs.keys() || []);
  const srvOriginales = Array.from(window._editReservaSrvsOriginales.keys() || []);
  const allSrvsIds = [...new Set([...srvOriginales, ...srvNuevos])];
  const allSrvs = allSrvsIds.map(id => ({ id, cantidad: window._editReservaSrvs.get(id) || window._editReservaSrvsOriginales.get(id) || 1 }));
  const srvP = allSrvs.reduce((s, obj) => {
    const sv = SERVICIOS[obj.id]; if (!sv) return s;
    return s + (sv.precio * obj.cantidad);
  }, 0);
  const noches = nights(ini, fin);
  
  const paqExtra = document.getElementById('m-det-paquete-extra');
  const paqueteExtraVal = paqExtra ? paqExtra.value : null;
  if (paqueteExtraVal) window._editReservaPaquetesExtra.add(paqueteExtraVal);
  const allPaqExtra = Array.from(window._editReservaPaquetesExtra);

  let paqPrecioTotal = (PAQUETES[paquete]?.precio || 0) * personas;
  allPaqExtra.forEach(p => {
    paqPrecioTotal += (PAQUETES[p]?.precio || 0) * personas;
  });

  const rawSub = ((CABANAS[cabana]?.precio || 0) + paqPrecioTotal) * Math.max(noches, 1) + srvP;
  const { subtotal, iva, total } = calcMontos(rawSub);
  const srvs = allSrvs;

  // Payment logic for new services
  let metodo_pago_nuevos_servicios = null;
  let datos_transferencia = null;
  let nuevos_servicios_detalle = [];
  let total_nuevos_servicios = 0;

  const srvsNuevosArr = Array.from(window._nuevosSrvs || []);
  if (srvsNuevosArr.length > 0 || paqueteExtraVal) {
    metodo_pago_nuevos_servicios = 'stripe';

    nuevos_servicios_detalle = srvsNuevosArr.map(k => {
      const sv = SERVICIOS[k];
      const cant = window._editReservaSrvs.get(k) || personas;
      const p = sv ? sv.precio : 0;
      const costoFinal = p * cant;
      const labelExtra = ` (x${cant} pers)`;
      return {
        id: k,
        label: (sv?.label || k) + labelExtra,
        precio: costoFinal
      };
    });
    // Sumar el paquete extra si existe al detalle de nuevos
    if (paqueteExtraVal) {
      const pExtra = PAQUETES[paqueteExtraVal];
      if (pExtra) {
        nuevos_servicios_detalle.push({
          id: paqueteExtraVal,
          label: `Paquete Extra: ${pExtra.label}`,
          precio: (pExtra.precio || 0) * personas
        });
      }
    }
    total_nuevos_servicios = nuevos_servicios_detalle.reduce((acc, s) => acc + s.precio, 0);
  }

  const btn = document.getElementById('m-det-btn-guardar');
  const origText = btn ? btn.textContent : 'Continuar con el pago';
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando pago...'; }

  try {
    await ReservasAPI.actualizar(_viewId, {
      FechaInicio: ini, FechaFinalizacion: fin, cabana, paquete, num_personas: personas, notas,
      servicios: srvs, paquetes_extra: allPaqExtra, SubTotal: subtotal, IVA: iva, MontoTotal: total,
      metodo_pago_nuevos_servicios,
      datos_transferencia,
      nuevos_servicios_detalle,
      total_nuevos_servicios
    });
    
    if (metodo_pago_nuevos_servicios === 'stripe') {
      const token = typeof Auth !== 'undefined' ? Auth.getToken() : localStorage.getItem('kafe_token');
      const stripeRes = await fetch('/api/pagos/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ idReserva: _viewId, source: 'admin', montoExtra: total_nuevos_servicios })
      });
      const stripeData = await stripeRes.json();
      if (stripeData.ok && stripeData.url) {
        window.location.href = stripeData.url;
        return;
      } else {
        throw new Error(stripeData.mensaje || 'Error al conectar con la pasarela de pagos Stripe');
      }
    }

    closeM('m-detalle-admin'); toast('Reserva actualizada', 'ok');
    loadReservas(_pag.currentPage); loadDashboard();
  } catch (err) { 
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    alertEl.innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`; 
  }
}

/* ════════ SERVICIOS DETALLE RESERVA ════════ */
window.renderDetSrvs = function () {
  const grid = document.getElementById('m-det-srv-grid');
  if (!grid) return;

  const selectedPaqId = document.getElementById('m-det-paquete').value;
  const paq = selectedPaqId ? PAQUETES[selectedPaqId] : null;
  let includedIds = [];
  if (paq && paq.serviciosIncluidos) {
    try {
      includedIds = Array.isArray(paq.serviciosIncluidos) ? paq.serviciosIncluidos : JSON.parse(paq.serviciosIncluidos);
    } catch (e) { }
  }

  let html = '';
  Object.keys(SERVICIOS).forEach(id => {
    const s = SERVICIOS[id];
    const isIncluded = includedIds.some(incId => String(incId) === String(id));
    const isOriginal = window._editReservaSrvsOriginales && window._editReservaSrvsOriginales.has(String(id));

    if (isIncluded && window._editReservaSrvs.has(String(id))) {
      window._editReservaSrvs.delete(String(id));
    }

    const isSelected = window._editReservaSrvs.has(String(id));

    if (isIncluded) {
      const cant = isOriginal ? window._editReservaSrvsOriginales.get(String(id)) : 1;
      html += `
        <button type="button" class="srv-chip disabled" title="Ya incluido en el paquete">
          ${s.label} <span class="srv-price" style="font-weight:600;">Incluido (x${cant})</span>
        </button>`;
    } else if (isOriginal) {
      const originalCant = window._editReservaSrvsOriginales.get(String(id));
      const currentCant = window._editReservaSrvs.get(String(id)) || originalCant;
      const cant = currentCant > originalCant ? currentCant : originalCant;
      
      if (!window._editReservaSrvs.has(String(id)) || window._editReservaSrvs.get(String(id)) < originalCant) {
        window._editReservaSrvs.set(String(id), originalCant);
      }
      const hasIncrease = cant > originalCant;
      html += `
        <button type="button" class="srv-chip selected" title="Ya reservado — puedes aumentar personas">
          ${s.label} <span class="srv-price" style="font-weight:600; opacity:1;">Reservado (x${cant})</span>
          <div id="edit-srv-counter-${id}" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="${cant <= originalCant ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="adjustEditSrvCount('${id}', -1)">-</span>
            <span id="edit-srv-count-${id}" style="font-weight:bold;">${cant}</span>
            <span class="srv-counter-btn" onclick="adjustEditSrvCount('${id}', 1)">+</span>
          </div>
          ${hasIncrease ? `<div style="font-size:0.75rem; margin-top:0.25rem; opacity: 0.85;">+${cant - originalCant} nuevas → +${fCop(s.precio * (cant - originalCant))}</div>` : `<div style="font-size:0.75rem; margin-top:0.25rem; opacity: 0.85;">Presiona + para agregar más</div>`}
        </button>`;
    } else {
      const isSelected = window._editReservaSrvs.has(String(id));
      const cant = isSelected ? window._editReservaSrvs.get(String(id)) : 0;
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" onclick="toggleDetSrv('${id}', event)">
          ${s.label} <span class="srv-price" style="font-weight:600;">+${fCop(s.precio)} / pers</span>
          <div id="edit-srv-counter-${id}" style="display:${isSelected?'flex':'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" onclick="adjustEditSrvCount('${id}', -1)">-</span>
            <span id="edit-srv-count-${id}" style="font-weight:bold;">${cant}</span>
            <span class="srv-counter-btn" onclick="adjustEditSrvCount('${id}', 1)">+</span>
          </div>
        </button>`;
    }
  });
  grid.innerHTML = html || '<span style="color:var(--dark-muted);font-size:0.85rem;">No hay servicios disponibles</span>';

  // Call to evaluate if there are new services and show payment UI
  if (typeof window.evaluarNuevosServicios === 'function') {
    window.evaluarNuevosServicios();
  }
};

window.toggleDetSrv = function (id, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return;
  if (!window._editReservaSrvs) window._editReservaSrvs = new Map();
  const strId = String(id);
  const isOriginal = window._editReservaSrvsOriginales && window._editReservaSrvsOriginales.has(strId);
  
  if (window._editReservaSrvs.has(strId)) {
    if (!isOriginal) window._editReservaSrvs.delete(strId); // Don't delete if it's original, they can't uncheck it
  } else {
    const cantOriginal = isOriginal ? window._editReservaSrvsOriginales.get(strId) : 0;
    const personas = Number(document.getElementById('m-det-personas').value) || 1;
    window._editReservaSrvs.set(strId, cantOriginal > 0 ? cantOriginal : personas);
  }
  window.renderDetSrvs();
};

window.adjustEditSrvCount = function(id, dir) {
  const strId = String(id);
  const isOriginal = window._editReservaSrvsOriginales && window._editReservaSrvsOriginales.has(strId);
  const cantOriginal = isOriginal ? window._editReservaSrvsOriginales.get(strId) : 0;
  
  if (!window._editReservaSrvs || (!window._editReservaSrvs.has(strId) && !isOriginal)) return;
  
  let count = window._editReservaSrvs.get(strId) || cantOriginal;
  count += dir;
  
  const minCant = isOriginal ? cantOriginal : 1;
  const maxCap = Math.max(...Object.values(CABANAS).map(c => c.capacidad || 0), 1);
  
  if (count < minCant) count = minCant;
  if (count > maxCap) count = maxCap;
  
  window._editReservaSrvs.set(strId, count);
  window.renderDetSrvs();
};

window.evaluarNuevosServicios = function () {
  if (!_viewReservaData) return;
  const originalSrvs = Array.isArray(_viewReservaData.servicios) ? _viewReservaData.servicios.map(s => String(s.id || s)) : [];
  const currentSrvs = Array.from(window._editReservaSrvs.keys() || []);

  const nuevosSrvs = currentSrvs.filter(id => !originalSrvs.includes(id));
  window._nuevosSrvs = new Set(nuevosSrvs);

  // Check if there's a new extra package selected
  const paqExtra = document.getElementById('m-det-paquete-extra');
  const paqueteExtraVal = paqExtra ? paqExtra.value : null;

  const pagoNuevosSection = document.getElementById('m-det-pago-nuevos');
  const resumenContainer = document.getElementById('m-det-resumen-nuevos');

  if (pagoNuevosSection) {
    if (nuevosSrvs.length > 0) {
      pagoNuevosSection.style.display = 'block';

      const personas = Number(document.getElementById('m-det-personas').value) || 1;
      let htmlResumen = '';
      let totalNuevos = 0;

      if (paqueteExtraVal) {
        const pExtra = PAQUETES[paqueteExtraVal];
        if (pExtra) {
          const costoPaq = (pExtra.precio || 0) * personas;
          totalNuevos += costoPaq;
          htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
            <span>Paquete Extra: ${pExtra.label} (x${personas} pers)</span>
            <strong>+${fCop(costoPaq)}</strong>
          </div>`;
        }
      }

      nuevosSrvs.forEach(k => {
        const s = SERVICIOS[k];
        if (s) {
          const cant = window._editReservaSrvs.get(k) || personas;
          const costo = s.precio * cant;
          totalNuevos += costo;
          const tipoLabel = `(x${cant} pers)`;
          htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
            <span>${s.label} ${tipoLabel}</span>
            <strong>+${fCop(costo)}</strong>
          </div>`;
        }
      });

      htmlResumen += `<div style="display:flex; justify-content:space-between; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid rgba(255, 255, 255,0.1); color: #fff;">
        <strong>Total a pagar por nuevos servicios:</strong>
        <strong style="color:var(--fire);">${fCop(totalNuevos)}</strong>
      </div>`;

      if (resumenContainer) resumenContainer.innerHTML = htmlResumen;
    } else if (paqueteExtraVal) {
      // Tiene paquete extra, pero no servicios nuevos
      pagoNuevosSection.style.display = 'block';
      const personas = Number(document.getElementById('m-det-personas').value) || 1;
      const pExtra = PAQUETES[paqueteExtraVal];
      let costoPaq = 0;
      if (pExtra) {
        costoPaq = (pExtra.precio || 0) * personas;
        let htmlResumen = `<div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
            <span>Paquete Extra: ${pExtra.label} (x${personas} pers)</span>
            <strong>+${fCop(costoPaq)}</strong>
          </div>`;
        htmlResumen += `<div style="display:flex; justify-content:space-between; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid rgba(255, 255, 255,0.1); color: #fff;">
          <strong>Total a pagar por extra:</strong>
          <strong style="color:var(--fire);">${fCop(costoPaq)}</strong>
        </div>`;
        if (resumenContainer) resumenContainer.innerHTML = htmlResumen;
      }
    } else {
      pagoNuevosSection.style.display = 'none';
    }
    
    const btnGuardar = document.getElementById('m-det-btn-guardar');
    const btnPago = document.getElementById('m-det-btn-pago');
    if (btnGuardar && btnPago) {
      if ((typeof totalNuevos !== 'undefined' && totalNuevos > 0) || (typeof costoPaq !== 'undefined' && costoPaq > 0)) {
        btnGuardar.style.display = 'none';
        btnPago.style.display = 'inline-block';
      } else {
        btnGuardar.style.display = 'inline-block';
        btnPago.style.display = 'none';
      }
    }
  }
};

window.mDetCambioMetodoPagoNuevos = function () {
  const metodo = document.getElementById('m-det-metodo-pago-nuevos').value;
  const transferForm = document.getElementById('m-det-datos-transferencia');
  if (transferForm) {
    transferForm.style.display = metodo === 'transferencia' ? 'block' : 'none';
    if (metodo !== 'transferencia') {
      document.getElementById('m-det-trans-banco').value = '';
      document.getElementById('m-det-trans-titular').value = '';
      document.getElementById('m-det-trans-comprobante').value = '';
    }
  }
};


/* ════════ ELIMINAR ════════ */
function abrirDel(id) { _delId = id; document.getElementById('m-del-id').textContent = id; openM('m-del'); }
async function doEliminar() {
  try { await ReservasAPI.eliminar(_delId); closeM('m-del'); toast('Reserva cancelada', 'ok'); loadReservas(1); loadDashboard(); }
  catch (e) { toast(e.message, 'err'); }
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
  document.querySelectorAll('.paq-opt[id^="adm-p-"]').forEach(btn => {
    const isSel = btn.id === `adm-p-${ADMIN_NUEVA_RES.paquete}`;
    btn.classList.toggle('selected', isSel);
    btn.style.border = isSel ? '2px solid var(--fire)' : '2px solid var(--dark-border)';
  });

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
function adminToggleSrv(key, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return;
  if (ADMIN_NUEVA_RES.servicios.has(key)) {
    ADMIN_NUEVA_RES.servicios.delete(key);
  } else {
    const cabData = ADMIN_NUEVA_RES.cabana ? CABANAS[ADMIN_NUEVA_RES.cabana] : null;
    ADMIN_NUEVA_RES.servicios.set(key, cabData ? cabData.capacidad : 1);
  }
  document.getElementById(`adm-srv-${key}`)?.classList.toggle('selected', ADMIN_NUEVA_RES.servicios.has(key));
  const counterDiv = document.getElementById(`adm-srv-counter-${key}`);
  if (counterDiv) {
    const isSelected = ADMIN_NUEVA_RES.servicios.has(key);
    counterDiv.style.display = isSelected ? 'flex' : 'none';
    if (isSelected) document.getElementById(`adm-srv-count-${key}`).textContent = ADMIN_NUEVA_RES.servicios.get(key);
  }
  adminResumenUpdate();
}

window.adminAdjustSrvCount = function(key, dir) {
  if (!ADMIN_NUEVA_RES.servicios.has(key)) return;
  let count = ADMIN_NUEVA_RES.servicios.get(key);
  count += dir;
  if (count < 1) count = 1;
  ADMIN_NUEVA_RES.servicios.set(key, count);
  document.getElementById(`adm-srv-count-${key}`).textContent = count;
  adminResumenUpdate();
};


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
      if (!disponibles.length) {
        prompt.innerHTML = '<span style="color:var(--danger);">(No hay cabañas disponibles para esas fechas)</span>';
      } else if (!ADMIN_NUEVA_RES.cabana) {
        prompt.innerHTML = '<span style="color:var(--danger);">(Es obligatorio seleccionar una cabaña)</span>';
      } else {
        prompt.innerHTML = '';
      }
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
  const srvs = Array.from(ADMIN_NUEVA_RES.servicios.keys()).map(k => { const s = SERVICIOS[k]; return s ? {...s, id:k, cantidad:ADMIN_NUEVA_RES.servicios.get(k)} : null; }).filter(Boolean);
  const srvP = srvs.reduce((a, s) => a + (s.precio * s.cantidad), 0);
  
  const paqExtras = Array.from(ADMIN_NUEVA_RES.paquetes_extra.keys()).map(k => { const p = PAQUETES[k]; return p ? {...p, id:k, cantidad:ADMIN_NUEVA_RES.paquetes_extra.get(k)} : null; }).filter(Boolean);
  const paqExtraP = paqExtras.reduce((a, p) => a + (p.precio * p.cantidad), 0);

  const noches = (ini && fin && valido && cab) ? nights(ini, fin) : 0;
  const paqPrecioTotal = (paq.precio || 0) * (cab ? cab.capacidad : 1);
  const rawSub = cab ? (cab.precio + paqPrecioTotal) * Math.max(noches, 1) + srvP + paqExtraP : 0;
  const { subtotal, iva, total } = calcMontos(rawSub);
  const body = document.getElementById('admin-price-body'), totalRow = document.getElementById('admin-price-total');
  if (!valido || !cab) {
    body.innerHTML = '<p style="color:rgba(100,80,60,0.6);text-align:center;font-size:0.85rem;">Selecciona fechas y cabaña válidas</p>';
    if (totalRow) totalRow.style.display = 'none';
    return;
  }
  body.innerHTML = `
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} × ${noches} ${noches === 1 ? 'noche' : 'noches'}</span></div>
    ${cab.ubicacion ? `<div class="price-row" style="padding-top:0;"><span class="pk" style="font-size:0.75rem;">Ubicación</span><span class="pv" style="font-size:0.75rem;font-weight:normal;color:var(--dark-muted);">${cab.ubicacion}</span></div>` : ''}
    <div class="price-row"><span class="pk">Precio cabaña</span><span class="pv">${fCop(cab.precio)} / noche</span></div>
    <div class="price-row" style="margin-bottom:1rem; border-bottom:1px dashed rgba(255, 255, 255,0.1); padding-bottom:0.5rem;"><span class="pk" style="font-weight:600;">Total cabaña</span><span class="pv" style="font-weight:600;">${fCop(cab.precio * noches)}</span></div>
    ${paqExtras.length > 0 ? paqExtras.map(p => `<div class="price-row"><span class="pk" style="padding-left:0.5rem;font-size:0.85rem;color:var(--dark-muted);">↳ P. Extra: ${p.label} (×${p.cantidad})</span><span class="pv" style="font-size:0.85rem;color:var(--dark-muted);">+${fCop(p.precio * p.cantidad)}</span></div>`).join('') : ''}
    ${srvs.map(s => `<div class="price-row"><span class="pk" style="padding-left:0.5rem;font-size:0.85rem;color:var(--dark-muted);">↳ ${s.label} (×${s.cantidad})</span><span class="pv" style="font-size:0.85rem;color:var(--dark-muted);">+${fCop(s.precio * s.cantidad)}</span></div>`).join('')}
    ${(srvs.length > 0 || paqExtras.length > 0) ? `<div class="price-row" style="margin-bottom:1rem; border-bottom:1px dashed rgba(255, 255, 255,0.1); padding-bottom:0.5rem;"><span class="pk" style="font-weight:600;">Total extras</span><span class="pv" style="font-weight:600;">${fCop(srvP + paqExtraP)}</span></div>` : ''}`;
  const tEl = document.getElementById('admin-pt-val'); if (tEl) tEl.textContent = fCop(total);
  if (totalRow) totalRow.style.display = 'flex';
}


let adminCurrentPaymentMethod = 'stripe';
function adminSetPaymentMethod(method) {
  adminCurrentPaymentMethod = method;
}

async function doNuevaAdmin() {
  let comprobante = 'PAGO-EN-HOTEL';
  const ini = document.getElementById('mn-ini').value, fin = document.getElementById('mn-fin').value;
  const cab = document.getElementById('mn-cab').value;
  const doc = document.getElementById('mn-doc').value.trim();
  const alertEl = document.getElementById('mn-alert');

  if (!doc) { alertEl.innerHTML = '<div class="alert alert-error">⚠ Ingresa el documento del cliente.</div>'; return; }
  if (!ini) { alertEl.innerHTML = '<div class="alert alert-error">⚠ Selecciona la fecha de inicio.</div>'; return; }
  if (!fin) { alertEl.innerHTML = '<div class="alert alert-error">⚠ Selecciona la fecha de fin.</div>'; return; }


  const [y, m, d] = ini.split('-').map(Number); const start = new Date(y, m - 1, d);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (start < hoy) { alertEl.innerHTML = `<div class="alert alert-error">⚠ La fecha de inicio debe ser a partir de hoy.</div>`; return; }
  try {
    const noches = nights(ini, fin); const cabData = CABANAS[cab]; const paqData = ADMIN_NUEVA_RES.paquete ? PAQUETES[ADMIN_NUEVA_RES.paquete] : { precio: 0 };
    const serviciosArr = Array.from(ADMIN_NUEVA_RES.servicios.entries()).map(([id, cantidad]) => ({ id, cantidad }));
    const srvP = serviciosArr.reduce((acc, s) => {
      const sv = SERVICIOS[s.id]; if (!sv) return acc;
      return acc + (sv.precio * s.cantidad);
    }, 0);
    
    const paqExtraArr = Array.from(ADMIN_NUEVA_RES.paquetes_extra.entries()).map(([id, cantidad]) => ({ id, cantidad }));
    const paqExtraP = paqExtraArr.reduce((acc, p) => {
      const pk = PAQUETES[p.id]; if (!pk) return acc;
      return acc + (pk.precio * p.cantidad);
    }, 0);

    const paqPrecioTotal = (paqData.precio || 0) * (cabData.capacidad || 1);
    const rawSub = (cabData.precio + paqPrecioTotal) * Math.max(noches, 1) + srvP + paqExtraP;
    const { subtotal, iva, total } = calcMontos(rawSub);

    // Para tarjeta cobramos el monto total de la reserva
    let monto = total;

    const res = await ReservasAPI.crear({
      NroDocumentoCliente: doc,
      FechaInicio: ini,
      FechaFinalizacion: fin,
      SubTotal: subtotal,
      Descuento: 0,
      IVA: iva,
      MontoTotal: total,

      MetodoPago: adminCurrentPaymentMethod,

      num_personas: cabData.capacidad,
      cabana: cab,
      paquete: ADMIN_NUEVA_RES.paquete,
      paquetes_extra: paqExtraArr,
      servicios: serviciosArr,

      comprobante_pago: comprobante,
      monto_pagado: 0
    });

    if (adminCurrentPaymentMethod === 'stripe') {
      const idReserva = res.data?.id || res.id;
      if (!idReserva) throw new Error('No se obtuvo el ID de la reserva');

      alertEl.innerHTML = `<div class="alert alert-info">Redirigiendo a Stripe...</div>`;
      const token = typeof Auth !== 'undefined' ? Auth.getToken() : localStorage.getItem('kafe_token');
      const stripeRes = await fetch('/api/pagos/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ idReserva, source: 'admin' })
      });
      const stripeData = await stripeRes.json();
      if (stripeData.ok && stripeData.url) {
        window.location.href = stripeData.url;
        return; // Redirects the admin
      } else {
        throw new Error(stripeData.mensaje || 'Error al conectar con la pasarela de pagos');
      }
    } else {
      closeM('m-nueva');
      adminResetNuevaRES();
      loadReservas(1);
      loadDashboard();
      openM('m-success');
      // Notificacion directa e inmediata en la campana
      notificarNuevaReservaDirecta();
    }
  } catch (e) { alertEl.innerHTML = `<div class="alert alert-error">⚠ ${e.message}</div>`; }
}

function adminResetNuevaRES() {
  ADMIN_NUEVA_RES.cabana = null;
  ADMIN_NUEVA_RES.paquete = null;
  ADMIN_NUEVA_RES.paquetes_extra.clear();
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
  _cliCache = []; // Limpiar cache para forzar recarga al abrir modal
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
// Funciones de bloqueo eliminadas (lógica movida a onCalDayClick interactivo)

async function loadBloqueos() {
  const c = document.getElementById('blq-list');
  try {
    const d = await BloqueosAPI.listar(); const bs = d.data || d.bloqueos || [];
    document.getElementById('ov-bloq').textContent = bs.length;
    c.innerHTML = bs.length
      ? bs.map(b => `<div class="blq-item"><div class="blq-ico">🔒</div><div class="blq-txt"><h4>${fDate(b.fecha_inicio)} → ${fDate(b.fecha_fin)}</h4><p>${b.motivo || 'Sin motivo'}</p></div><button class="btn btn-sm btn-danger" onclick="doDesbloquear(${b.id})">Quitar</button></div>`).join('')
      : '<p style="color:var(--dark-muted);font-size:0.85rem;">No hay fechas bloqueadas</p>';
  } catch { c.innerHTML = '<p style="color:var(--dark-muted);font-size:0.85rem;">Inicia el servidor para ver bloqueos</p>'; }
}

async function doDesbloquear(id) {
  if (!(await customConfirm('¿Estás seguro de quitar este bloqueo de fechas? Las fechas quedarán disponibles para reservas.'))) return;
  try { await BloqueosAPI.eliminar(id); toast('Fecha desbloqueada', 'ok'); loadBloqueos(); refreshAdminCal(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ════════ USUARIOS — LISTADO PAGINADO ════════ */
let _usuarioActual = null;
let _rolSeleccion = null;
const _usrPag = { currentPage: 1, totalPages: 1, total: 0, limit: 10 };

// Helper: generar fila de usuario
function _usrRow(u) {
  const isActivo = u.estado === 1 || u.estado === true || u.estado === 'activo';
  const isAdmin = u.rol === 'admin';
  const safeEmail = (u.email || '').replace(/'/g, "\\'");
  const isSuperAdmin = (u.email === 'admin@kafeancestral.com' || u.email === 'infokcafeancestral@gmail.com');

  return `<tr>
      <td style="font-family:var(--font-display);font-weight:800;color:var(--fire);">${u.numeroDocumento || '—'}</td>
      <td><strong>${u.nombre || ''}</strong> ${u.apellido || ''}</td>
      <td>${u.email || '\u2014'}</td>
      <td>${u.telefono || '\u2014'}</td>
      <td>
        <label class="toggle-label" title="${isSuperAdmin ? 'Superadmin protegido' : 'Cambiar rol'}">
          <span style="font-size:0.75rem; color:${isAdmin ? 'var(--fire)' : '#4caf50'};">${isAdmin ? 'Admin' : 'Cliente'}</span>
          <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
            <input type="checkbox" onchange="toggleUsuarioRol('${u.id}', this)" ${isAdmin ? 'checked' : ''} ${isSuperAdmin ? 'disabled' : ''}>
            <span class="toggle-slider" ${isSuperAdmin ? 'style="opacity:0.5;cursor:not-allowed;"' : ''}></span>
          </div>
        </label>
      </td>
      <td>
        <label class="toggle-label" title="${isSuperAdmin ? 'Superadmin protegido' : 'Cambiar estado'}">
          <span style="font-size:0.75rem; color:var(--dark-muted);">${isActivo ? 'Activo' : 'Inactivo'}</span>
          <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
            <input type="checkbox" onchange="toggleEstadoGlobal('usuarios', '${u.id}', this)" ${isActivo ? 'checked' : ''} ${isSuperAdmin ? 'disabled' : ''}>
            <span class="toggle-slider" ${isSuperAdmin ? 'style="opacity:0.5;cursor:not-allowed;"' : ''}></span>
          </div>
        </label>
      </td>
      <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
        ${isSuperAdmin ? '<span style="color:var(--mist);font-size:0.8rem;font-style:italic;margin-top:0.4rem;">Protegido</span>' : `
        <button class="btn btn-sm btn-dark-outline" onclick="usrAbrirReset(${u.id},'${safeEmail}')" title="Restablecer contraseña">Clave</button>
        <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:rgba(239,83,80,0.3);" onclick="usrAbrirEliminar(${u.id},'${safeEmail}')" title="Eliminar cuenta">Eliminar</button>
        `}
      </div></td>
    </tr>`;
}

// Cargar listado de usuarios
window.loadUsuariosAdmin = async function (page = 1) {
  const adminTb = document.getElementById('usr-admin-tbody');
  const cliTb = document.getElementById('usr-cli-tbody');
  if (!adminTb || !cliTb) return;

  const q = document.getElementById('fil-usuario-q')?.value?.trim() || '';
  try {
    const params = new URLSearchParams({ page, limit: _usrPag.limit });
    if (q) params.append('q', q);
    const data = await req(`/usuarios?${params}`);
    const admins = data.admins || [];
    const clientes = data.clientes || [];
    _usrPag.currentPage = data.currentPage || 1;
    _usrPag.totalPages = data.totalPages || 1;
    _usrPag.total = data.total || 0;

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
    adminTb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--fire);">Error al cargar: ${err.message}</td></tr>`;
    cliTb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--fire);">Error al cargar: ${err.message}</td></tr>`;
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
window.usrGoToPage = function (p) { if (p < 1 || p > _usrPag.totalPages) return; loadUsuariosAdmin(p); };
window.usrSearch = function () { loadUsuariosAdmin(1); };
window.usrClearSearch = function () { document.getElementById('fil-usuario-q').value = ''; loadUsuariosAdmin(1); };
let _usrDebounce = null;
window.usrLiveSearch = function () { clearTimeout(_usrDebounce); _usrDebounce = setTimeout(() => loadUsuariosAdmin(1), 300); };

/* ── Cambiar Rol (desde tabla) ── */
window.usrAbrirCambioRol = function (id, rolActual, email) {
  _usuarioActual = { id, rol: rolActual, email };
  _rolSeleccion = rolActual;
  document.getElementById('m-rol-email').textContent = email;
  document.getElementById('m-rol-alert').innerHTML = '';
  setRolSeleccion(rolActual);
  openM('m-rol');
};

function setRolSeleccion(rol) {
  _rolSeleccion = rol;
  const btnCliente = document.getElementById('m-rol-btn-cliente');
  const btnAdmin = document.getElementById('m-rol-btn-admin');
  if (rol === 'cliente') {
    btnCliente.style.border = '2px solid var(--fire)';
    btnCliente.style.background = 'rgba(232,93,4,0.08)';
    btnAdmin.style.border = '2px solid var(--dark-border)';
    btnAdmin.style.background = 'var(--dark-card2)';
  } else {
    btnAdmin.style.border = '2px solid var(--fire)';
    btnAdmin.style.background = 'rgba(232,93,4,0.08)';
    btnCliente.style.border = '2px solid var(--dark-border)';
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
  } catch (err) {
    document.getElementById('m-rol-alert').innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}

/* ── Eliminar Usuario (desde tabla) ── */
window.usrAbrirEliminar = function (id, email) {
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
  } catch (err) { toast(err.message, 'err'); }
}

/* ── Reset Password (desde tabla) ── */
window.usrAbrirReset = function (id, email) {
  _usuarioActual = { id, email };
  document.getElementById('m-reset-email').textContent = email;
  document.getElementById('m-reset-result').style.display = 'none';
  document.getElementById('m-reset-content').style.display = 'block';
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
    document.getElementById('m-reset-result').style.display = 'block';
    document.getElementById('m-reset-url').textContent = window.location.origin + data.resetUrl;
    document.getElementById('m-reset-ft').innerHTML = `
      <button class="btn btn-fire" onclick="navigator.clipboard.writeText(window.location.origin+'${data.resetUrl}');toast('Enlace copiado','ok')">📋 Copiar enlace</button>
      <button class="btn btn-dark-outline" onclick="closeM('m-reset-usuario')">Cerrar</button>`;
  } catch (err) { toast(err.message, 'err'); }
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
let _notifMaxId = parseInt(localStorage.getItem('kafe_notif_maxId') || '0');
let _notifLeidas = JSON.parse(localStorage.getItem('kafe_notif_leidas') || '[]');
let _notifLista = JSON.parse(localStorage.getItem('kafe_notif_lista') || '[]');
let _notifPanelAbierto = false;
let _notifTimer = null;

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
    const leida = _notifLeidas.includes(n.id);
    const tiempo = timeAgo(n.timestamp);
    return `
      <div class="notif-item ${leida ? '' : 'unread'}" style="position:relative;">
        <div class="notif-ico">📋</div>
        <div class="notif-txt" style="padding-right:24px;">
          <p>${n.mensaje}</p>
          <span>${tiempo}</span>
        </div>
        <button onclick="eliminarNotificacion('${n.id}')" title="Eliminar" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--dark-muted);cursor:pointer;padding:4px;border-radius:4px;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--dark-muted)'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>`;
  }).join('');
}

function marcarTodasLeidas() {
  _notifLeidas = _notifLista.map(n => n.id);
  localStorage.setItem('kafe_notif_leidas', JSON.stringify(_notifLeidas));
  document.getElementById('notif-btn')?.classList.remove('has-new');
  renderNotifPanel();
}

function limpiarNotificaciones() {
  _notifLista = [];
  _notifLeidas = [];
  localStorage.removeItem('kafe_notif_lista');
  localStorage.removeItem('kafe_notif_leidas');
  document.getElementById('notif-btn')?.classList.remove('has-new');
  renderNotifPanel();
}

async function eliminarNotificacion(id) {
  if (!(await customConfirm('¿Deseas eliminar esta notificación?'))) return;
  _notifLista = _notifLista.filter(n => n.id !== id);
  localStorage.setItem('kafe_notif_lista', JSON.stringify(_notifLista));
  renderNotifPanel();
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return new Date(ts).toLocaleDateString('es-CO');
}

async function checkNuevasReservas() {
  try {
    const token = Auth.getToken(); if (!token) return;
    const resp = await fetch('/api/reservas?limit=500&page=1', {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    });
    const d = await resp.json();
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
            mensaje: `Nueva reserva — ${r.cabana ? (CABANAS[r.cabana]?.label || r.cabana) : 'Cabaña'} · ${r.documento || 'Cliente'}`,
            timestamp: Date.now(),
          });
          if (typeof toast === 'function') toast(`🔔 Nueva reserva recibida`, 'ok');
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
      const resp = await fetch('/api/reservas?limit=500&page=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await resp.json();
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
  toast('Sesión cerrada', 'ok');
  setTimeout(() => window.location.replace('landing.html'), 600);
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

let _dataCabanas = [];
const _pagCab = { currentPage: 1, limit: 10, totalPages: 1 };

async function loadCabanas(page = 1) {
  try {
    const grid = document.getElementById('cab-grid');
    const pagCtrls = document.getElementById('cab-pagination');
    if (page === 1) {
      const res = await req('/cabanas');
      if (!res.success) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Error al cargar cabañas.</div>';
        if (pagCtrls) pagCtrls.innerHTML = '';
        return;
      }
      _dataCabanas = res.data || [];
    }

    if (_dataCabanas.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay cabañas registradas.</div>';
      if (pagCtrls) pagCtrls.innerHTML = '';
      return;
    }

    _pagCab.totalPages = Math.ceil(_dataCabanas.length / _pagCab.limit) || 1;
    if (page < 1) page = 1;
    if (page > _pagCab.totalPages) page = _pagCab.totalPages;
    _pagCab.currentPage = page;

    const start = (page - 1) * _pagCab.limit;
    const paginated = _dataCabanas.slice(start, start + _pagCab.limit);

    grid.innerHTML = paginated.map(c => `
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

    if (pagCtrls) {
      if (_pagCab.totalPages > 1) {
        pagCtrls.innerHTML = `
          <div class="admin-footer" style="justify-content:center; gap:1rem; padding:1rem; background:transparent; border:none;">
            <button class="btn btn-sm btn-dark-outline" onclick="loadCabanas(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
            <span style="color:var(--dark-muted); font-size:0.85rem;">Página ${page} de ${_pagCab.totalPages}</span>
            <button class="btn btn-sm btn-dark-outline" onclick="loadCabanas(${page + 1})" ${page === _pagCab.totalPages ? 'disabled' : ''}>Siguiente →</button>
          </div>
        `;
      } else {
        pagCtrls.innerHTML = '';
      }
    }
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('cab-grid');
    if (grid) grid.innerHTML = `<div style="grid-column: 1 / -1; color: red;">Error: ${error.message} - ${error.stack}</div>`;
  }
}

window.adminVerCabana = async function (id) {
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
              <div style="color: #fff; font-weight:bold; font-size:1.1rem;">${c.CapacidadMaxima} pers.</div>
          </div>
          <div style="flex:1; background:var(--dark-bg); padding:1rem; border-radius:8px; border:1px solid var(--dark-border);">
              <div style="font-size:0.8rem; color:var(--dark-muted); margin-bottom:0.3rem;">Habitaciones</div>
              <div style="color: #fff; font-weight:bold; font-size:1.1rem;">${c.NumeroHabitaciones}</div>
          </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div>
              <strong style="display:block;margin-bottom:0.5rem;color: #fff;">Foto de la Cabaña</strong>
              ${(() => {
        try {
          const arr = c.ImagenCabana && c.ImagenCabana.startsWith('[') ? JSON.parse(c.ImagenCabana) : (c.ImagenCabana ? [c.ImagenCabana] : []);
          if (!arr.length) return '<div style="padding:2rem; background:var(--dark-bg); border-radius:8px; text-align:center; color:var(--dark-muted);">Sin foto</div>';
          return '<div style="display:flex; gap:0.5rem; overflow-x:auto;">' + arr.map(i => '<img src="' + i + '" style="width:120px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--dark-border);"/>').join('') + '</div>';
        } catch (e) { return '<img src="' + c.ImagenCabana + '" style="width:100%; border-radius:8px; border:1px solid var(--dark-border);"/>'; }
      })()}
          </div>
          <div>
              <strong style="display:block;margin-bottom:0.5rem;color: #fff;">Foto de las Habitaciones</strong>
              ${(() => {
        try {
          const arr = c.ImagenHabitacion && c.ImagenHabitacion.startsWith('[') ? JSON.parse(c.ImagenHabitacion) : (c.ImagenHabitacion ? [c.ImagenHabitacion] : []);
          if (!arr.length) return '<div style="padding:2rem; background:var(--dark-bg); border-radius:8px; text-align:center; color:var(--dark-muted);">Sin foto</div>';
          return '<div style="display:flex; gap:0.5rem; overflow-x:auto;">' + arr.map(i => '<img src="' + i + '" style="width:120px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--dark-border);"/>').join('') + '</div>';
        } catch (e) { return '<img src="' + c.ImagenHabitacion + '" style="width:100%; border-radius:8px; border:1px solid var(--dark-border);"/>'; }
      })()}
          </div>
      </div>
    `;
    openM('m-view-cab');
  } catch (err) {
    console.error(err);
    toast('Error al cargar cabaña', 'err');
  }
};

window.adminNuevaCabana = function () {
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
  window._imgCabanaBase64 = [];
  window._imgHabBase64 = [];
  const btnDelCab = document.getElementById('btn-del-cab-img-cabana');
  if (btnDelCab) btnDelCab.style.display = 'none';
  const btnDelHab = document.getElementById('btn-del-cab-img-hab');
  if (btnDelHab) btnDelHab.style.display = 'none';
  document.getElementById('m-cab-title').textContent = 'Nueva Cabaña';
  openM('m-cab');
};

window.adminEditarCabana = async function (id) {
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

    // Función auxiliar para parsear y renderizar
    const parseImages = (imgStr, containerId, btnId) => {
      let arr = [];
      try { arr = imgStr && imgStr.startsWith('[') ? JSON.parse(imgStr) : (imgStr ? [imgStr] : []); } catch (e) { arr = imgStr ? [imgStr] : []; }
      const container = document.getElementById(containerId);
      container.innerHTML = arr.map(i => '<img src="' + i + '" style="width:100%;height:60px;object-fit:cover;display:block;border-radius:8px;"/>').join('');
      const btn = document.getElementById(btnId);
      if (btn) btn.style.display = arr.length ? 'block' : 'none';
      return arr;
    };

    window._imgCabanaBase64 = parseImages(c.ImagenCabana, 'preview-cabana', 'btn-del-cab-img-cabana');
    window._imgHabBase64 = parseImages(c.ImagenHabitacion, 'preview-hab', 'btn-del-cab-img-hab');

    openM('m-cab');
  } catch (err) {
    console.error(err);
  }
};

window.saveCabana = async function () {
  const id = document.getElementById('m-cab-id').value;
  const data = {
    Nombre: document.getElementById('m-cab-nombre').value,
    Descripcion: document.getElementById('m-cab-desc').value,
    Ubicacion: document.getElementById('m-cab-ubica').value,
    CapacidadMaxima: parseInt(document.getElementById('m-cab-cap').value),
    Costo: parseFloat(document.getElementById('m-cab-costo').value),
    NumeroHabitaciones: parseInt(document.getElementById('m-cab-numhab').value),
    Estado: document.getElementById('m-cab-est').value === 'true',
    ImagenCabana: Array.isArray(window._imgCabanaBase64) && window._imgCabanaBase64.length ? JSON.stringify(window._imgCabanaBase64) : (window._imgCabanaBase64 || null),
    ImagenHabitacion: Array.isArray(window._imgHabBase64) && window._imgHabBase64.length ? JSON.stringify(window._imgHabBase64) : (window._imgHabBase64 || null)
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
window.adminEliminarCabana = async function (id) {
  if (!(await customConfirm('¿Estás seguro de eliminar esta cabaña? Se eliminarán también sus habitaciones.'))) return;
  try {
    await CabanasAPI.eliminar(id);
    loadCabanas();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error al eliminar cabaña');
  }
};

window.previewImage = function (input, previewId) {
  if (input.files && input.files.length > 0) {
    if (input.files.length > 5) {
      toast('Máximo 5 imágenes permitidas', 'err');
      // No cortamos, solo usamos los primeros 5
    }
    const filesToProcess = Array.from(input.files).slice(0, 5);
    const container = document.getElementById(previewId);
    if (!container) return;

    // Si es para servicios, mantenemos lógica single
    if (previewId === 'preview-srv') {
      const file = filesToProcess[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > h && w > 1000) { h *= 1000 / w; w = 1000; }
          else if (h > 1000) { w *= 1000 / h; h = 1000; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const b64 = canvas.toDataURL('image/jpeg', 0.8);
          container.innerHTML = '<img src="' + b64 + '" style="width:100%;height:auto;display:block; border-radius:8px;"/>';
          container.style.display = 'block';
          window._imgServicioBase64 = b64;
          const btnDel = document.getElementById('btn-del-srv-foto');
          if (btnDel) btnDel.style.display = 'block';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      return;
    }

    // Lógica multi-imagen para cabañas/habitaciones
    container.innerHTML = '';
    let arr = [];
    let processedCount = 0;

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > h && w > 1000) { h *= 1000 / w; w = 1000; }
          else if (h > 1000) { w *= 1000 / h; h = 1000; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const b64 = canvas.toDataURL('image/jpeg', 0.8);
          arr.push(b64);
          container.innerHTML += '<img src="' + b64 + '" style="width:100%;height:60px;object-fit:cover;display:block; border-radius:8px;"/>';

          processedCount++;
          if (processedCount === filesToProcess.length) {
            container.style.display = 'grid';
            if (previewId === 'preview-cabana') {
              window._imgCabanaBase64 = arr;
              const btnDel = document.getElementById('btn-del-cab-img-cabana');
              if (btnDel) btnDel.style.display = 'block';
            } else if (previewId === 'preview-hab') {
              window._imgHabBase64 = arr;
              const btnDel = document.getElementById('btn-del-cab-img-hab');
              if (btnDel) btnDel.style.display = 'block';
            }
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
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
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo, imagen: s.Imagen, cobroPorPersona: s.CobroPorPersona === 1 || s.CobroPorPersona === true };
      html += `
        <button type="button" class="srv-chip" id="adm-srv-${s.IDServicio}" onclick="adminToggleSrv('${s.IDServicio}')" style="border:1.5px solid rgba(255, 255, 255,0.15);background:#fff;color:var(--bark);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M5 12l5 5L20 7"/></svg> ${s.NombreServicio} <span class="srv-price" style="margin-left:0.3rem;">+$${s.Costo / 1000}K</span>
        </button>`;
    });

    const srvGrid = document.querySelector('#m-nueva .srv-grid');
    if (srvGrid) srvGrid.innerHTML = html;
  } catch (e) { console.error('Error refreshing services', e); }
}

const oldLoadServicios2 = window.loadServicios;
window.loadServicios = async function () {
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
    for (const k of ADMIN_NUEVA_RES.paquetes_extra.keys()) {
      if (!PAQUETES[k]) ADMIN_NUEVA_RES.paquetes_extra.delete(k);
    }

    html = '<div class="srv-grid">'; // Usamos srv-grid para que tome el mismo estilo que los servicios
    paqs.forEach(p => {
      if (!PAQUETES[p.IDPaquete]) return;
      
      const cant = ADMIN_NUEVA_RES.paquetes_extra.has(String(p.IDPaquete)) ? ADMIN_NUEVA_RES.paquetes_extra.get(String(p.IDPaquete)) : 1;
      const isSelected = ADMIN_NUEVA_RES.paquetes_extra.has(String(p.IDPaquete));
      
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" id="adm-paqe-${p.IDPaquete}" onclick="adminTogglePaq('${p.IDPaquete}', event)" style="${isSelected ? 'background:var(--fire);color: #fff;border-color:var(--fire);' : 'background:#fff;color:var(--bark);border-color:rgba(255, 255, 255,0.15);'} flex-direction:column; align-items:center; text-align:center;">
          <div style="font-weight:700;margin-bottom:0.2rem;">${p.NombrePaquete}</div>
          <div style="font-size:0.75rem; opacity:0.8;">+${fCop(p.Precio)} / pers</div>
          <div id="adm-paqe-counter-${p.IDPaquete}" style="display:${isSelected?'flex':'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adminAdjustPaqCount('${p.IDPaquete}', -1)">-</span>
            <span id="adm-paqe-count-${p.IDPaquete}" style="font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adminAdjustPaqCount('${p.IDPaquete}', 1)">+</span>
          </div>
        </button>`;
    });
    html += '</div>';

    if (paqs.length === 0) {
      html = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--dark-muted);">No hay paquetes activos disponibles</div>';
    }

    const grid = document.getElementById('adm-paq-grid');
    if (grid) {
      grid.innerHTML = html;
    }

    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch (e) { console.error('Error refreshing packages', e); }
}

window.adminTogglePaq = function (key, ev) {
  if (ev) ev.preventDefault();
  if (ADMIN_NUEVA_RES.paquetes_extra.has(key)) {
    ADMIN_NUEVA_RES.paquetes_extra.delete(key);
  } else {
    const cabData = ADMIN_NUEVA_RES.cabana ? CABANAS[ADMIN_NUEVA_RES.cabana] : null;
    ADMIN_NUEVA_RES.paquetes_extra.set(key, cabData ? cabData.capacidad : 1);
  }
  
  const isSelected = ADMIN_NUEVA_RES.paquetes_extra.has(key);
  const btn = document.getElementById(`adm-paqe-${key}`);
  if (btn) {
    if (isSelected) {
      btn.classList.add('selected');
      btn.style.background = 'var(--fire)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--fire)';
      
      const cbtnList = btn.querySelectorAll('.srv-counter-btn');
      cbtnList.forEach(cb => cb.style.color = '#fff');
      const ctSpan = document.getElementById(`adm-paqe-count-${key}`);
      if(ctSpan) ctSpan.style.color = '#fff';
    } else {
      btn.classList.remove('selected');
      btn.style.background = '#fff';
      btn.style.color = 'var(--bark)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      
      const cbtnList = btn.querySelectorAll('.srv-counter-btn');
      cbtnList.forEach(cb => cb.style.color = 'var(--bark)');
      const ctSpan = document.getElementById(`adm-paqe-count-${key}`);
      if(ctSpan) ctSpan.style.color = 'var(--bark)';
    }
  }

  const counterDiv = document.getElementById(`adm-paqe-counter-${key}`);
  if (counterDiv) counterDiv.style.display = isSelected ? 'flex' : 'none';

  const countSpan = document.getElementById(`adm-paqe-count-${key}`);
  if (isSelected && countSpan) {
    countSpan.textContent = ADMIN_NUEVA_RES.paquetes_extra.get(key);
  }

  adminResumenUpdate();
};

window.adminAdjustPaqCount = function (key, diff) {
  if (!ADMIN_NUEVA_RES.paquetes_extra.has(key)) return;
  let count = ADMIN_NUEVA_RES.paquetes_extra.get(key);
  count += diff;
  if (count < 1) count = 1;
  if (count > 20) count = 20;
  ADMIN_NUEVA_RES.paquetes_extra.set(key, count);
  document.getElementById(`adm-paqe-count-${key}`).textContent = count;
  adminResumenUpdate();
};

const oldLoadPaquetes2 = window.loadPaquetes;
window.loadPaquetes = async function () {
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
      html += `<option value="${c.IDCabana}" ${isSelected ? 'selected' : ''}>${c.Nombre} (${c.CapacidadMaxima} pers.) — ${fCop(c.Costo)}</option>`;
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
  } catch (e) { console.error('Error refreshing cabanas', e); }
}

const oldLoadCabanas3 = window.loadCabanas;
window.loadCabanas = async function () {
  if (oldLoadCabanas3) await oldLoadCabanas3();
  await refreshGlobalCabanas();
};

document.addEventListener('DOMContentLoaded', refreshGlobalCabanas);
refreshGlobalCabanas();


/* ════════ ROOM PHOTO LOGIC ════════ */
window._currentHabFoto = null;
window.adminPreviewHabFoto = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
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
  } catch (e) { console.error('Error loading client cache', e); }
}

// Autocomplete handler - triggered on every keystroke
window.onCliAutocomplete = function (val) {
  clearTimeout(_cliDebounce);
  _cliDebounce = setTimeout(() => _doCliAutocomplete(val), 200);
};

async function _doCliAutocomplete(val) {
  const dropdown = document.getElementById('mn-cli-results');
  if (!dropdown) return;

  const q = (val || '').trim().toLowerCase();

  // If cache is empty, load it
  if (!_cliCache.length) await loadCliCache();

  // Validar si el cliente está activo (Estado === true o 1, o 'true' o '1')
  const checkActivo = c => c.Estado === true || c.Estado === 1 || String(c.Estado).toLowerCase() === 'true' || String(c.Estado) === '1';

  let results = _cliCache;
  if (q) {
    results = _cliCache.filter(c => {
      const nom = (c.Nombre || '').toLowerCase();
      const ape = (c.Apellido || '').toLowerCase();
      const email = (c.Email || '').toLowerCase();
      const doc = String(c.NroDocumento || c.NumeroDocumento || '').toLowerCase();
      const isActivo = checkActivo(c);
      return isActivo && (nom.includes(q) || ape.includes(q) || email.includes(q) || doc.includes(q) || `${nom} ${ape}`.includes(q));
    });
  } else {
    results = _cliCache.filter(checkActivo);
  }

  if (!results.length && q) {
    // Try server-side search for broader results
    try {
      const data = await ClientesAPI.buscar(q);
      results = (data.data || []).filter(checkActivo);
    } catch (e) { /* ignore */ }
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
    return `<div class="cli-ac-item" onclick="selectCliResult('${doc}', '${nom.replace(/'/g, "\\'")}', '${ape.replace(/'/g, "\\'")}', '${email.replace(/'/g, "\\'")}')" 
      style="padding:0.7rem 1rem;cursor:pointer;border-bottom:1px solid rgba(255, 255, 255,0.06);transition:background 0.12s;display:flex;justify-content:space-between;align-items:center;"
      onmouseenter="this.style.background='rgba(232,93,4,0.06)'" onmouseleave="this.style.background='transparent'">
      <div>
        <div style="font-weight:600;font-size:0.88rem;color: #fff;">${nom} ${ape}</div>
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

window.selectCliResult = function (doc, nom, ape, email) {
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

window.clearCliSelection = function () {
  document.getElementById('mn-doc').value = '';
  const searchInput = document.getElementById('mn-cli-search');
  if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  const selDiv = document.getElementById('mn-cli-selected');
  if (selDiv) { selDiv.style.display = 'none'; selDiv.innerHTML = ''; }
};

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('mn-cli-results');
  const searchInput = document.getElementById('mn-cli-search');
  if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
    dropdown.style.display = 'none';
  }
});

// Intercept modal open to preload client cache
const oldAdminNuevaReserva = window.adminNuevaReserva;
window.adminNuevaReserva = function () {
  loadCliCache();
  if (oldAdminNuevaReserva) oldAdminNuevaReserva();
};

document.addEventListener('DOMContentLoaded', loadCliCache);
loadCliCache();


/* ════════ FIX INFINITE LOADING FOR ADMIN MODULES ════════ */
// 1. Redefine showSec to include all modules properly
const oldShowSec2 = window.showSec;
window.showSec = function (name, btn) {
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
let _dataPaquetes = [];
const _pagPaq = { currentPage: 1, limit: 10, totalPages: 1 };

window.loadPaquetesAdmin = async function (page = 1) {
  const grid = document.getElementById('paq-grid');
  const pagCtrls = document.getElementById('paq-pagination');
  if (!grid) return;
  try {
    if (page === 1) {
      const data = await PaquetesAPI.listar();
      _dataPaquetes = data.paquetes || data.data || [];
    }

    if (!_dataPaquetes.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--dark-muted); padding:3rem;">No hay paquetes registrados.</div>';
      if (pagCtrls) pagCtrls.innerHTML = '';
      return;
    }

    _pagPaq.totalPages = Math.ceil(_dataPaquetes.length / _pagPaq.limit) || 1;
    if (page < 1) page = 1;
    if (page > _pagPaq.totalPages) page = _pagPaq.totalPages;
    _pagPaq.currentPage = page;

    const start = (page - 1) * _pagPaq.limit;
    const paginated = _dataPaquetes.slice(start, start + _pagPaq.limit);

    grid.innerHTML = paginated.map(p => `
      <div class="cab-card">
        <div class="cab-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3 style="color: #fff;">${p.NombrePaquete}</h3>
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
          <button class="btn btn-sm btn-dark-outline" style="color:var(--danger); border-color:rgba(239,83,80,0.3);" onclick="adminEliminarPaquete('${p.IDPaquete}')">Eliminar</button>
        </div>
      </div>
    `).join('');

    if (pagCtrls) {
      if (_pagPaq.totalPages > 1) {
        pagCtrls.innerHTML = `
          <div class="admin-footer" style="justify-content:center; gap:1rem; padding:1rem; background:transparent; border:none;">
            <button class="btn btn-sm btn-dark-outline" onclick="window.loadPaquetesAdmin(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
            <span style="color:var(--dark-muted); font-size:0.85rem;">Página ${page} de ${_pagPaq.totalPages}</span>
            <button class="btn btn-sm btn-dark-outline" onclick="window.loadPaquetesAdmin(${page + 1})" ${page === _pagPaq.totalPages ? 'disabled' : ''}>Siguiente →</button>
          </div>
        `;
      } else {
        pagCtrls.innerHTML = '';
      }
    }
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;color:var(--fire);">Error al cargar paquetes</div>';
    if (pagCtrls) pagCtrls.innerHTML = '';
  }
};

window.adminVerPaquete = async function (id) {
  try {
    const data = await PaquetesAPI.uno(id);
    const p = data.data || data;
    const srvsIds = p.ServiciosIncluidos ? (Array.isArray(p.ServiciosIncluidos) ? p.ServiciosIncluidos : JSON.parse(p.ServiciosIncluidos)) : [];
    let srvsHtmlArr = [];
    let imgsHtmlArr = [];
    srvsIds.forEach(id => {
      if (SERVICIOS[id]) {
        let s = SERVICIOS[id];
        srvsHtmlArr.push(`<div style="display:inline-block;background:rgba(255, 255, 255,0.05);padding:0.4rem 0.8rem;border-radius:4px;margin-right:0.5rem;margin-bottom:0.5rem;"><span>${s.label}</span></div>`);
        if (s.imagen) {
          imgsHtmlArr.push(`<div><strong style="display:block;margin-bottom:0.5rem;color: #fff;">${s.label}</strong><img src="${s.imagen}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid var(--dark-border);"/></div>`);
        }
      }
    });
    const serviciosHtml = srvsHtmlArr.length > 0 ? `<div style="margin-top:0.5rem;">${srvsHtmlArr.join('')}</div>` : '<p style="color:var(--mist);margin-top:0.5rem;">Ninguno</p>';
    const fotosHtml = imgsHtmlArr.length > 0 ? `<div style="margin-top:1.5rem;"><strong style="display:block;margin-bottom:0.5rem;color: #fff;">Fotos de Servicios Incluidos:</strong><div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">${imgsHtmlArr.join('')}</div></div>` : '';

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
                <div style="color:var(--mist);">${serviciosHtml}</div>
            </div>
            ${fotosHtml}
        `;
    openM('m-view-paq');
  } catch (err) {
    console.error(err);
    toast('Error al cargar paquete', 'err');
  }
};

let _dataServicios = [];
const _pagSrv = { currentPage: 1, limit: 10, totalPages: 1 };

window.loadServiciosAdmin = async function (page = 1) {
  const tbody = document.getElementById('srv-tbody');
  const pagCtrls = document.getElementById('srv-pagination');
  if (!tbody) return;
  try {
    if (page === 1) {
      const data = await ServiciosAPI.listar();
      _dataServicios = data.servicios || data.data || [];
    }

    if (!_dataServicios.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--dark-muted);">No hay servicios registrados.</td></tr>';
      if (pagCtrls) pagCtrls.innerHTML = '';
      return;
    }

    _pagSrv.totalPages = Math.ceil(_dataServicios.length / _pagSrv.limit) || 1;
    if (page < 1) page = 1;
    if (page > _pagSrv.totalPages) page = _pagSrv.totalPages;
    _pagSrv.currentPage = page;

    const start = (page - 1) * _pagSrv.limit;
    const paginated = _dataServicios.slice(start, start + _pagSrv.limit);

    tbody.innerHTML = paginated.map(s => `
      <tr>
        <td><strong>${s.NombreServicio}</strong></td>
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
        <td><div style="display:flex;gap:0.4rem;"><button class="btn btn-sm btn-dark-outline" onclick="adminVerServicio('${s.IDServicio}')">Ver</button><button class="btn btn-sm btn-dark-outline" onclick="adminEditarServicio('${s.IDServicio}')">Editar</button><button class="btn btn-sm btn-dark-outline" style="color:var(--danger); border-color:rgba(239,83,80,0.3);" onclick="adminEliminarServicio('${s.IDServicio}')">Eliminar</button></div></td>
      </tr>
    `).join('');

    if (pagCtrls) {
      if (_pagSrv.totalPages > 1) {
        pagCtrls.innerHTML = `
          <div class="admin-footer" style="justify-content:center; gap:1rem; padding:1rem; background:transparent; border:none;">
            <button class="btn btn-sm btn-dark-outline" onclick="window.loadServiciosAdmin(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
            <span style="color:var(--dark-muted); font-size:0.85rem;">Página ${page} de ${_pagSrv.totalPages}</span>
            <button class="btn btn-sm btn-dark-outline" onclick="window.loadServiciosAdmin(${page + 1})" ${page === _pagSrv.totalPages ? 'disabled' : ''}>Siguiente →</button>
          </div>
        `;
      } else {
        pagCtrls.innerHTML = '';
      }
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--fire);">Error al cargar servicios</td></tr>';
    if (pagCtrls) pagCtrls.innerHTML = '';
  }
};

// 4. Implement loadClientesAdmin — con paginación y búsqueda
const _cliPag = { currentPage: 1, totalPages: 1, total: 0, limit: 10 };

window.loadClientesAdmin = async function (page = 1) {
  const tbody = document.getElementById('cli-tbody');
  if (!tbody) return;
  const q = document.getElementById('fil-cliente-q')?.value?.trim() || '';
  try {
    const data = await ClientesAPI.listar({ page, limit: _cliPag.limit, q });
    const clis = data.data || [];
    _cliPag.currentPage = data.currentPage || 1;
    _cliPag.totalPages = data.totalPages || 1;
    _cliPag.total = data.total || 0;

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
        <td>
          <label class="toggle-label" title="Cambiar estado">
            <span style="font-size:0.75rem; color:var(--dark-muted);">${(c.Estado === 1 || c.Estado === true) ? 'Activo' : 'Inactivo'}</span>
            <div class="toggle-switch" style="transform:scale(0.85); transform-origin:left center;">
              <input type="checkbox" onchange="toggleEstadoGlobal('usuarios', '${c.IDUsuario}', this)" ${(c.Estado === 1 || c.Estado === true) ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </td>
        <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="btn btn-sm btn-dark-outline" onclick="adminVerCliente('${c.IDUsuario || c.NroDocumento}')">Ver</button><button class="btn btn-sm btn-outline" style="color:var(--fire);border-color:rgba(232,93,4,0.3);" onclick="adminEditarCliente('${c.IDUsuario || c.NroDocumento}')">Editar</button><button class="btn btn-sm btn-dark-outline" style="color:var(--danger); border-color:rgba(239,83,80,0.3);" onclick="adminEliminarCliente('${c.IDUsuario}')">Eliminar</button></div></td>
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
window.cliGoToPage = function (p) {
  if (p < 1 || p > _cliPag.totalPages) return;
  loadClientesAdmin(p);
};
window.cliSearch = function () { loadClientesAdmin(1); };
window.cliClearSearch = function () {
  document.getElementById('fil-cliente-q').value = '';
  loadClientesAdmin(1);
};
let _cliSearchDebounce = null;
window.cliLiveSearch = function () { clearTimeout(_cliSearchDebounce); _cliSearchDebounce = setTimeout(() => loadClientesAdmin(1), 300); };

// Alias loadClientes so the HTML onkeyup/onclick works properly
window.loadClientes = window.loadClientesAdmin;



/* =====================================================================
   ADMIN CRUD INJECTIONS (FIXED)
   ===================================================================== */

// --- CABAÑAS ---
// --- HABITACIONES ---
window.adminNuevaHabitacion = function () {
  document.getElementById('m-hab-id').value = '';
  document.getElementById('m-hab-nombre').value = '';
  document.getElementById('m-hab-cabana').value = '';
  document.getElementById('m-hab-est').value = 'true';
  document.getElementById('m-hab-title').textContent = 'Nueva Habitación';
  openM('m-hab');
};

window.adminEditarHabitacion = async function (id) {
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

window.saveHabitacion = async function () {
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
window.adminEliminarHabitacion = async function (id) {
  if (!(await customConfirm('¿Eliminar esta habitación?'))) return;
  try {
    await req('/habitaciones/' + id, { method: 'DELETE' });
    if (window.loadHabitaciones) loadHabitaciones();
  } catch (err) {
    alert(err.message || 'Error al eliminar');
  }
};

// --- PAQUETES ---
window.adminNuevoPaquete = function () {
  document.getElementById('m-paq-id').value = '';
  document.getElementById('m-paq-nombre').value = '';
  document.getElementById('m-paq-desc').value = '';
  document.getElementById('m-paq-precio').value = '';
  document.getElementById('m-paq-servicio').value = '';
  document.getElementById('m-paq-est').value = 'true';
  document.getElementById('m-paq-title').textContent = 'Nuevo Paquete';
  openM('m-paq');
};

window.adminEditarPaquete = async function (id) {
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

window.savePaquete = async function () {
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

window.adminEliminarPaquete = async function (id) {
  if (!(await customConfirm('¿Eliminar paquete?'))) return;
  try {
    await req('/paquetes/' + id, { method: 'DELETE' });
    if (window.loadPaquetesAdmin) window.loadPaquetesAdmin();
  } catch (err) {
    alert(err.message || 'Error al eliminar');
  }
};

// --- SERVICIOS ---
function _setServicioReadonly(readonly) {
  ['m-srv-nombre', 'm-srv-desc', 'm-srv-cap', 'm-srv-precio'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.readOnly = readonly;
    el.style.opacity = readonly ? '0.75' : '1';
    el.style.cursor = readonly ? 'default' : '';
    el.style.pointerEvents = readonly ? 'none' : '';
  });
  const fileInput = document.getElementById('m-srv-foto');
  if (fileInput) fileInput.style.display = readonly ? 'none' : 'block';
  const btnDel = document.getElementById('btn-del-srv-foto');
  if (btnDel) btnDel.style.display = 'none';
}

window.eliminarFotoServicio = function () {
  const fileInput = document.getElementById('m-srv-foto');
  if (fileInput) fileInput.value = '';
  window._imgServicioBase64 = null;
  const preview = document.getElementById('preview-srv');
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
  const btnDel = document.getElementById('btn-del-srv-foto');
  if (btnDel) btnDel.style.display = 'none';
};

window.eliminarFotoCabana = function (type) {
  if (type === 'cabana') {
    const fileInput = document.getElementById('m-cab-img-cabana');
    if (fileInput) fileInput.value = '';
    window._imgCabanaBase64 = [];
    const preview = document.getElementById('preview-cabana');
    if (preview) preview.innerHTML = '';
    const btnDel = document.getElementById('btn-del-cab-img-cabana');
    if (btnDel) btnDel.style.display = 'none';
  } else if (type === 'hab') {
    const fileInput = document.getElementById('m-cab-img-hab');
    if (fileInput) fileInput.value = '';
    window._imgHabBase64 = [];
    const preview = document.getElementById('preview-hab');
    if (preview) preview.innerHTML = '';
    const btnDel = document.getElementById('btn-del-cab-img-hab');
    if (btnDel) btnDel.style.display = 'none';
  }
};

window.adminVerServicio = async function (id) {
  try {
    _setServicioReadonly(true);
    const modalFt = document.querySelector('#m-srv .modal-ft');
    if (modalFt) {
      if (!window._origSrvFooterHtml) {
        window._origSrvFooterHtml = modalFt.innerHTML;
      }
      modalFt.innerHTML = `<button type="button" class="btn btn-dark-outline" onclick="closeM('m-srv')">Cerrar</button>`;
    }
    const res = await req('/servicios/' + id);
    const s = res.servicio || res.data || res;
    document.getElementById('m-srv-id').value = s.IDServicio;
    document.getElementById('m-srv-nombre').value = s.NombreServicio;
    document.getElementById('m-srv-desc').value = s.Descripcion || '';
    document.getElementById('m-srv-cap').value = s.CantidadMaximaPersonas || 1;
    document.getElementById('m-srv-precio').value = s.Costo || 0;
    document.getElementById('m-srv-est').value = s.Estado ? 'true' : 'false';

    const preview = document.getElementById('preview-srv');
    if (s.Imagen) {
      preview.innerHTML = '<img src="' + s.Imagen + '" style="width:100%;height:auto;display:block;border-radius:8px;"/>';
      preview.style.display = 'block';
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
    document.getElementById('m-srv-title').textContent = 'Detalle de Servicio';
    openM('m-srv');
  } catch (err) {
    alert(err.message || 'Error al obtener servicio');
  }
};

window.adminNuevoServicio = function () {
  _setServicioReadonly(false);
  const modalFt = document.querySelector('#m-srv .modal-ft');
  if (modalFt && window._origSrvFooterHtml) {
    modalFt.innerHTML = window._origSrvFooterHtml;
  }
  document.getElementById('m-srv-id').value = '';
  document.getElementById('m-srv-nombre').value = '';
  document.getElementById('m-srv-desc').value = '';
  document.getElementById('m-srv-cap').value = '1';
  document.getElementById('m-srv-est').value = 'true';
  document.getElementById('m-srv-foto').value = '';
  document.getElementById('preview-srv').innerHTML = '';
  document.getElementById('preview-srv').style.display = 'none';
  window._imgServicioBase64 = null;

  document.getElementById('m-srv-title').textContent = 'Nuevo Servicio';
  openM('m-srv');
};

window.adminEditarServicio = async function (id) {
  try {
    _setServicioReadonly(false);
    const modalFt = document.querySelector('#m-srv .modal-ft');
    if (modalFt && window._origSrvFooterHtml) {
      modalFt.innerHTML = window._origSrvFooterHtml;
    }
    const res = await req('/servicios/' + id);
    const s = res.servicio || res.data || res;
    document.getElementById('m-srv-id').value = s.IDServicio;
    document.getElementById('m-srv-nombre').value = s.NombreServicio;
    document.getElementById('m-srv-desc').value = s.Descripcion || '';
    document.getElementById('m-srv-cap').value = s.CantidadMaximaPersonas || 1;
    document.getElementById('m-srv-precio').value = s.Costo || 0;
    document.getElementById('m-srv-est').value = s.Estado ? 'true' : 'false';
    document.getElementById('m-srv-foto').value = '';
    window._imgServicioBase64 = s.Imagen || null;

    const preview = document.getElementById('preview-srv');
    const btnDel = document.getElementById('btn-del-srv-foto');
    if (s.Imagen) {
      preview.innerHTML = '<img src="' + s.Imagen + '" style="width:100%;height:auto;display:block;border-radius:8px;"/>';
      preview.style.display = 'block';
      if (btnDel) btnDel.style.display = 'block';
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
      if (btnDel) btnDel.style.display = 'none';
    }
    document.getElementById('m-srv-title').textContent = 'Editar Servicio';
    openM('m-srv');
  } catch (err) {
    alert(err.message || 'Error al obtener servicio');
  }
};

window.saveServicio = async function () {
  const id = document.getElementById('m-srv-id').value;
  const data = {
    NombreServicio: document.getElementById('m-srv-nombre').value,
    Descripcion: document.getElementById('m-srv-desc').value,
    CantidadMaximaPersonas: parseInt(document.getElementById('m-srv-cap').value),
    Costo: parseFloat(document.getElementById('m-srv-precio').value),
    Estado: document.getElementById('m-srv-est').value === 'true',
    Imagen: window._imgServicioBase64,
    CobroPorPersona: true
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


window.adminEliminarServicio = async function (id) {
  if (!(await customConfirm('¿Eliminar servicio?'))) return;
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

  const tipoDoc = c.TipoDocumento || c.tipoDocumento || '';
  const numDoc = c.NroDocumento || c.NumeroDocumento || c.numeroDocumento || doc || '';
  document.getElementById('m-cli-doc-display').value = (tipoDoc ? tipoDoc + ' ' : '') + numDoc;

  document.getElementById('m-cli-email').value = c.Email || c.email || c.Correo || '';
  document.getElementById('m-cli-nombre').value = c.Nombre || c.nombre || '';
  document.getElementById('m-cli-apellido').value = c.Apellido || c.apellido || '';
  document.getElementById('m-cli-tel').value = c.Telefono || c.telefono || '';
  document.getElementById('m-cli-nac').value = c.Pais || c.Nacionalidad || c.pais || c.nacionalidad || '';

  // ROL y ESTADO
  const isAdm = (c.IDRol === 1 || c.idRol === 1 || c.rol === 'admin');
  document.getElementById('m-cli-rol').value = isAdm ? 'Administrador' : 'Cliente';

  const isActivo = (c.Estado === 1 || c.Estado === true || c.estado === 1 || c.estado === true);
  document.getElementById('m-cli-estado').value = isActivo ? 'Activo' : 'Inactivo';

  document.getElementById('m-cli-historial').innerHTML = '<em>Historial de reservas se mostrará aquí</em>';

  // Opcional: Cargar historial real desde /reservas?cliente=doc si existe el endpoint, por ahora simulado
  setTimeout(async () => {
    try {
      const hRes = await req('/reservas');
      if (hRes.data) {
        const misRes = hRes.data.filter(r => r.NroDocumentoCliente === doc || r.IDUsuario === c.IDUsuario);
        if (misRes.length > 0) {
          document.getElementById('m-cli-historial').innerHTML = misRes.map(r =>
            `<div style="padding:0.5rem;border-bottom:1px solid rgba(255, 255, 255,0.1);display:flex;justify-content:space-between;">
              <span>Reserva</span>
              <span>${r.Estado}</span>
            </div>`
          ).join('');
        } else {
          document.getElementById('m-cli-historial').innerHTML = 'No tiene reservas registradas.';
        }
      }
    } catch (e) { }
  }, 500);
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
window.adminVerCliente = async function (doc) {
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
window.adminEditarCliente = async function (doc) {
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

window.saveCliente = async function () {
  const doc = document.getElementById('m-cli-doc').value;
  const nombreEl = document.getElementById('m-cli-nombre');
  const apellidoEl = document.getElementById('m-cli-apellido');
  const telEl = document.getElementById('m-cli-tel');
  const nacEl = document.getElementById('m-cli-nac');

  let hasError = false;

  const check = (el, msg) => {
    let errSpan = document.getElementById('err-' + el.id);
    if (!errSpan) {
      errSpan = document.createElement('span');
      errSpan.id = 'err-' + el.id;
      errSpan.style.color = 'var(--fire)';
      errSpan.style.fontSize = '0.8rem';
      errSpan.style.display = 'block';
      errSpan.style.marginTop = '0.3rem';
      el.parentNode.appendChild(errSpan);
    }
    if (!el.value.trim()) {
      el.style.borderColor = 'var(--fire)';
      errSpan.textContent = msg;
      hasError = true;
    } else {
      el.style.borderColor = '';
      errSpan.textContent = '';
    }
  };

  check(nombreEl, 'El nombre es obligatorio.');
  check(apellidoEl, 'El apellido es obligatorio.');
  check(telEl, 'El teléfono es obligatorio.');
  check(nacEl, 'La nacionalidad es obligatoria.');

  if (hasError) return;

  const data = {
    Nombre: nombreEl.value.trim(),
    Apellido: apellidoEl.value.trim(),
    Telefono: telEl.value.trim(),
    Pais: nacEl.value.trim()
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
window.adminEliminarCliente = async function (doc) {
  if (!(await customConfirm('¿Eliminar cliente?'))) return;
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

window.adminVerHabitacion = async function (id) {
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

window.loadHabitaciones = async function () {
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
    window.toggleAccordion = function (id) {
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
            <h4 style="margin-bottom:0.3rem; color: #fff; font-size:1.1rem;">${h.NombreHabitacion}</h4>
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
          <div onclick="toggleAccordion('${key}')" style="cursor:pointer; padding:1rem 1.5rem; background:linear-gradient(135deg,rgba(255, 255, 255,0.05),rgba(255, 255, 255,0.02)); border-bottom:1px solid var(--dark-border); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-family:var(--font-display); color: #fff; font-size:1.2rem;">${isUnassigned ? '⚠️ Sin Asignar' : '🏕️ ' + group.cabana.Nombre} <span style="font-size:0.8rem; font-weight:400; color:var(--dark-muted); margin-left:0.5rem;">(${group.habitaciones.length} habs)</span></h3>
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

window.adminNuevaHabitacion = async function () {
  document.getElementById('m-hab-id').value = '';
  document.getElementById('m-hab-nombre').value = '';
  document.getElementById('m-hab-est').value = 'true';
  window._currentHabFoto = null;
  document.getElementById('m-hab-foto').value = '';
  const preview = document.getElementById('m-hab-foto-preview');
  if (preview) preview.style.display = 'none';
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
  } catch (e) { }

  openM('m-hab');
};

window.adminEditarHabitacion = async function (id) {
  try {
    const res = await req('/habitaciones/' + id);
    const h = res.habitacion || res.data || res;
    document.getElementById('m-hab-id').value = h.IDHabitacion;
    document.getElementById('m-hab-nombre').value = h.NombreHabitacion;
    document.getElementById('m-hab-est').value = h.Estado ? 'true' : 'false';
    window._currentHabFoto = h.ImagenHabitacion || null;
    document.getElementById('m-hab-foto').value = '';
    const preview = document.getElementById('m-hab-foto-preview');
    if (preview) {
      if (h.ImagenHabitacion) {
        preview.innerHTML = '<img src="' + h.ImagenHabitacion + '" style="width:100%; height:auto; display:block;"/>';
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
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
    } catch (e) { }

    openM('m-hab');
  } catch (err) {
    alert(err.message || 'Error al obtener habitación');
  }
};

window.adminNuevoPaquete = async function () {
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
  } catch (e) { }

  openM('m-paq');
};

window.adminEditarPaquete = async function (id) {
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
    } catch (e) { }

    openM('m-paq');
  } catch (err) {
    alert(err.message || 'Error al obtener paquete');
  }
};

window.onPaqSrvChange = function (checkbox) {
  const precioInput = document.getElementById('m-paq-precio');
  const price = parseFloat(checkbox.getAttribute('data-precio')) || 0;
  let current = parseFloat(precioInput.value) || 0;
  if (checkbox.checked) {
    current += price;
  } else {
    current -= price;
  }
  if (current < 0) current = 0;
  precioInput.value = current;
};


/* =====================================================================
   PAQUETES REFACTOR: MULTIPLE SERVICES AND ADMIN NEW RESERVATION
   ===================================================================== */

window.adminNuevoPaquete = async function () {
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
      const activeSrvs = res.data.filter(s => s.Estado === 1 || s.Estado === true);
      srvDiv.innerHTML = activeSrvs.length > 0 ? activeSrvs.map(s => `
        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
          <input type="checkbox" name="paq-srv" value="${s.IDServicio}" data-precio="${s.Costo || s.Precio || 0}" onchange="window.onPaqSrvChange(this)">
          <span style="color: #fff; font-size:0.9rem;">${s.NombreServicio} (+$${((s.Costo || s.Precio || 0) / 1000)}k)</span>
        </label>
      `).join('') : '<div style="text-align:center; padding:1rem; color:var(--dark-muted);">No hay servicios activos</div>';
    } else {
      srvDiv.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--dark-muted);">No hay servicios creados</div>';
    }
  } catch (e) { }

  openM('m-paq');
};

window.adminEditarPaquete = async function (id) {
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
        try { selectedSrvs = JSON.parse(p.ServiciosIncluidos); } catch (e) { }
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
        const renderedSrvs = sRes.data.filter(s => {
          const isSelected = selectedSrvs.includes(s.IDServicio) || selectedSrvs.includes(String(s.IDServicio));
          return (s.Estado === 1 || s.Estado === true) || isSelected;
        });
        srvDiv.innerHTML = renderedSrvs.length > 0 ? renderedSrvs.map(s => {
          const isSelected = selectedSrvs.includes(s.IDServicio) || selectedSrvs.includes(String(s.IDServicio));
          const isChecked = isSelected ? 'checked' : '';
          const isInactive = !(s.Estado === 1 || s.Estado === true);
          const onChangeLogic = isInactive ? `onchange="if(!this.checked) { this.disabled = true; this.parentElement.style.opacity = '0.5'; }"` : '';
          return `
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; ${isInactive && !isSelected ? 'opacity:0.5;' : ''}">
              <input type="checkbox" name="paq-srv" value="${s.IDServicio}" data-precio="${s.Costo || s.Precio || 0}" ${isChecked} ${onChangeLogic} onchange="window.onPaqSrvChange(this)">
              <span style="color: #fff; font-size:0.9rem;">${s.NombreServicio} (+$${((s.Costo || s.Precio || 0) / 1000)}k) ${isInactive ? '(Inactivo)' : ''}</span>
            </label>
          `;
        }).join('') : '<div style="text-align:center; padding:1rem; color:var(--dark-muted);">No hay servicios</div>';
      }
    } catch (e) { }

    openM('m-paq');
  } catch (err) {
    alert(err.message || 'Error al obtener paquete');
  }
};

window.savePaquete = async function () {
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

window.adminEliminarPaquete = async function (id) {
  if (!(await customConfirm('¿Eliminar paquete?'))) return;
  try {
    await req('/paquetes/' + id, { method: 'DELETE' });
    if (window.loadPaquetesAdmin) window.loadPaquetesAdmin();
    if (window.adminRefreshGlobalPackages) window.adminRefreshGlobalPackages();
  } catch (err) {
    alert(err.message || 'Error al eliminar paquete');
  }
};


/* =====================================================================
   ADMIN NUEVA RESERVA: DYNAMIC LOADING
   ===================================================================== */

let _lastAdmPaqsHash = '';
window.adminRefreshGlobalPackages = async function () {
  try {
    const data = await req('/paquetes');
    const paqs = data.paquetes || data.data || [];
    const hash = JSON.stringify(paqs);
    if (_lastAdmPaqsHash === hash) return;
    _lastAdmPaqsHash = hash;

    for (const key in PAQUETES) delete PAQUETES[key];

    let html = '';
    paqs.forEach(p => {
      if (p.Estado !== 1 && p.Estado !== true) return;
      PAQUETES[p.IDPaquete] = { label: p.NombrePaquete, precio: p.Precio, descripcion: p.Descripcion, serviciosIncluidos: p.ServiciosIncluidos };
    });

    if (ADMIN_NUEVA_RES.paquete && !PAQUETES[ADMIN_NUEVA_RES.paquete]) {
      ADMIN_NUEVA_RES.paquete = null;
    }

    paqs.forEach((p) => {
      if (!PAQUETES[p.IDPaquete]) return;
      const isSelected = ADMIN_NUEVA_RES.paquete == p.IDPaquete;

      html += '<button type="button" class="paq-opt ' + (isSelected ? 'selected' : '') + '" id="adm-p-' + p.IDPaquete + '" onclick="adminSelectPaquete(\'' + p.IDPaquete + '\')" style="border:2px solid ' + (isSelected ? 'var(--fire)' : 'var(--dark-border)') + ';background:var(--dark-card);">'
        + '<div class="paq-name" style="font-size:1.05rem;font-weight:700;color: #fff;margin-bottom:0.3rem;">' + p.NombrePaquete + '</div>'
        + '<div class="paq-desc" style="font-size:0.8rem;color:rgba(255,255,255,0.9);margin-bottom:0.4rem;">' + (p.Descripcion || '') + '</div>'
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

    let htmlOptions = '<option value="">Sin paquete</option>';
    paqs.forEach(p => {
      if (p.Estado === 1 || p.Estado === true) {
        htmlOptions += `<option value="${p.IDPaquete}">${p.NombrePaquete}</option>`;
      }
    });
    const selectDetPaq = document.getElementById('m-det-paquete');
    if (selectDetPaq) {
      const currentVal = selectDetPaq.value;
      selectDetPaq.innerHTML = htmlOptions;
      if (currentVal) selectDetPaq.value = currentVal;
    }

    const selectDetPaqExtra = document.getElementById('m-det-paquete-extra');
    if (selectDetPaqExtra) {
      const currentValEx = selectDetPaqExtra.value;
      selectDetPaqExtra.innerHTML = '<option value="">Ninguno</option>' + htmlOptions.replace('<option value="">Sin paquete</option>', '');
      if (currentValEx) selectDetPaqExtra.value = currentValEx;
    }

    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch (e) { }
};

let _lastAdmSrvsHash = '';
window.adminRefreshGlobalServices = async function () {
  try {
    const data = await req('/servicios');
    const srvs = data.servicios || data.data || [];
    const hash = JSON.stringify(srvs);
    if (_lastAdmSrvsHash === hash) return;
    _lastAdmSrvsHash = hash;

    for (const key in SERVICIOS) delete SERVICIOS[key];

    let html = '';
    srvs.forEach(s => {
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo, imagen: s.Imagen };
      if (s.Estado !== 1 && s.Estado !== true) return; // Solo activos renderizan chips
      const cant = ADMIN_NUEVA_RES && ADMIN_NUEVA_RES.servicios && ADMIN_NUEVA_RES.servicios.has(String(s.IDServicio)) ? ADMIN_NUEVA_RES.servicios.get(String(s.IDServicio)) : 1;
      const isSelected = ADMIN_NUEVA_RES && ADMIN_NUEVA_RES.servicios && ADMIN_NUEVA_RES.servicios.has(String(s.IDServicio));
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" id="adm-srv-${s.IDServicio}" onclick="adminToggleSrv('${s.IDServicio}', event)" style="${isSelected ? 'background:var(--fire);color: #fff;border-color:var(--fire);' : 'background:#fff;color:var(--bark);border-color:rgba(255, 255, 255,0.15);'} flex-direction:column; align-items:center;">
          <div>${s.NombreServicio} <span style="font-weight:600; font-size:0.75rem; opacity:0.8;">+${fCop(s.Costo)} / pers</span></div>
          <div id="adm-srv-counter-${s.IDServicio}" style="display:${isSelected?'flex':'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adminAdjustSrvCount('${s.IDServicio}', -1)">-</span>
            <span id="adm-srv-count-${s.IDServicio}" style="font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adminAdjustSrvCount('${s.IDServicio}', 1)">+</span>
          </div>
        </button>`;
    });

    // Buscar la srv-grid dentro del modal de nueva reserva
    const srvGrid = document.querySelector('#m-nueva .srv-grid');
    if (srvGrid) {
      srvGrid.innerHTML = html;
      if (typeof adminCalcTotal === 'function') adminCalcTotal();
    }
  } catch (e) { console.error('Error refreshing admin services', e); }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.adminRefreshGlobalPackages) adminRefreshGlobalPackages();
  if (window.adminRefreshGlobalServices) adminRefreshGlobalServices();
});

setInterval(() => {
  if (window.adminRefreshGlobalPackages) adminRefreshGlobalPackages();
  if (window.adminRefreshGlobalServices) adminRefreshGlobalServices();
  if (window.adminRefreshGlobalCabanas) adminRefreshGlobalCabanas();
}, 5000);


/* =====================================================================
   ADMIN NUEVA RESERVA: DYNAMIC CABANAS
   ===================================================================== */

let _lastAdmCabanasHash = '';
window.adminRefreshGlobalCabanas = async function () {
  try {
    const data = await req('/cabanas');
    const cabanas = data.data || [];
    const hash = JSON.stringify(cabanas);
    if (_lastAdmCabanasHash === hash) return;
    _lastAdmCabanasHash = hash;

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

    let htmlOptionsDet = '';
    cabanas.forEach(c => {
      if (!window.CABANAS[c.IDCabana]) return;
      htmlOptionsDet += `<option value="${c.IDCabana}">${c.Nombre} (${c.CapacidadMaxima} pers.)</option>`;
    });
    const selectDetCab = document.getElementById('m-det-cabana');
    if (selectDetCab) {
      const currentVal = selectDetCab.value;
      selectDetCab.innerHTML = htmlOptionsDet;
      if (currentVal) selectDetCab.value = currentVal;
    }

    populateCalCabFilter();
    if (typeof adminResumenUpdate === 'function') adminResumenUpdate();
  } catch (e) {
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
    .map(r => ({ from: new Date(r.fecha_inicio + 'T12:00:00'), to: new Date(r.fecha_fin + 'T12:00:00') }));
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
      occupied.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      d.setDate(d.getDate() + 1);
    }
  });

  // Para cada día libre entre hoy y +1 año, verificar si está aislado
  const isolated = [];
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const limite = new Date(hoy); limite.setFullYear(limite.getFullYear() + 1);

  for (let d = new Date(manana); d <= limite; d.setDate(d.getDate() + 1)) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (occupied.has(ds)) continue; // está ocupado, no es libre
    // Comprobar si el día siguiente está ocupado
    const sig = new Date(d); sig.setDate(sig.getDate() + 1);
    const sigDs = `${sig.getFullYear()}-${String(sig.getMonth()+1).padStart(2,'0')}-${String(sig.getDate()).padStart(2,'0')}`;
    // Comprobar si el día anterior está ocupado
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    const prevDs = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
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
  const _hs = new Date(); const hoyStr = `${_hs.getFullYear()}-${String(_hs.getMonth()+1).padStart(2,'0')}-${String(_hs.getDate()).padStart(2,'0')}`;

  const ranges = getOccupiedRanges(cab);
  const disabled = getDisabledDates(cab);
  const isModal = document.getElementById(iniId)?.closest('.modal') !== null;
  const commonOpts = { locale: 'es', minDate: hoyStr, dateFormat: 'Y-m-d', disableMobile: true, static: isModal };

  // Destruir instancias previas, preservando valores
  const iniEl = document.getElementById(iniId);
  const finEl = document.getElementById(finId);
  if (!iniEl || !finEl) return;

  // Evitar destruir los calendarios si el usuario está interactuando con ellos
  if ((iniEl._flatpickr && iniEl._flatpickr.isOpen) || (finEl._flatpickr && finEl._flatpickr.isOpen)) {
    return;
  }

  const savedIni = iniEl.value;
  const savedFin = finEl.value;
  if (iniEl._flatpickr) iniEl._flatpickr.destroy();
  if (finEl._flatpickr) finEl._flatpickr.destroy();
  iniEl.value = savedIni; finEl.value = savedFin;

  flatpickr('#' + iniId, {
    ...commonOpts,
    disable: disabled,
    onChange: function (selectedDates, dateStr) {
      const finPicker = finEl._flatpickr;
      if (!finPicker || !selectedDates.length) return;
      // Calcular maxDate: no puede pasar por encima de la siguiente reserva
      const maxDate = getMaxDateAfter(selectedDates[0], ranges);
      // minDate del fin: usar el objeto Date + 1 dia
      const minFin = new Date(selectedDates[0]);
      minFin.setDate(minFin.getDate() + 1);
      finPicker.set('minDate', minFin);
      if (maxDate) {
        finPicker.set('maxDate', maxDate);
      } else {
        finPicker.set('maxDate', null);
      }
      if (finPicker.selectedDates[0] && finPicker.selectedDates[0] < selectedDates[0]) finPicker.clear();

      // Abrir automáticamente el calendario de fin si no hay fecha seleccionada o para fluidez
      setTimeout(() => {
        if (finPicker.element) {
          finPicker.jumpToDate(selectedDates[0]);
          finPicker.open();
        }
      }, 100);

      if (onChangeExtra) onChangeExtra();
    }
  });

  // El finPicker debe iniciar con minDate igual a ini (si existe) o hoyStr
  let finMinDate = hoyStr;
  if (savedIni) {
    const iniDateObj = new Date(savedIni + 'T12:00:00');
    if (!isNaN(iniDateObj.getTime())) {
       iniDateObj.setDate(iniDateObj.getDate() + 1);
       finMinDate = iniDateObj;
    }
  }

  flatpickr('#' + finId, {
    ...commonOpts,
    minDate: finMinDate,
    disable: disabled,
    onChange: function () {
      if (onChangeExtra) onChangeExtra();
    }
  });
}

window.updateAdminDatePickers = function () {
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
  // No llamar updateAdminDatePickers() aquí: las fechas ya fueron seleccionadas
  // antes de elegir la cabaña. Reinicializar los pickers borraría las fechas.
  adminResumenUpdate();
}


// Poblar el filtro de cabanas del calendario (sin precio)
window.populateCalCabFilter = function () {
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
  if (window.adminRefreshGlobalCabanas) adminRefreshGlobalCabanas();
});


window.toggleEstadoGlobal = async function (modulo, idValue, elem) {
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
      if (typeof window.loadClientesAdmin === 'function') window.loadClientesAdmin();
    }
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error al cambiar estado');
    elem.checked = !isChecked;
  } finally {
    elem.disabled = false;
  }
};

window.toggleUsuarioRol = async function (idValue, elem) {
  const isChecked = elem.checked;
  elem.disabled = true;
  try {
    // Si esta marcado (true) es Admin, sino (false) es Cliente
    const nuevoRol = isChecked ? 'admin' : 'cliente';
    const res = await req('/usuarios/' + idValue + '/rol', {
      method: 'PUT',
      body: JSON.stringify({ rol: nuevoRol })
    });

    if (!res.ok) throw new Error(res.mensaje || res.message || 'Error cambiando rol');

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
window.nuTogglePw = function (inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
};

/* ── Fortaleza de contraseña ── */
window.nuCheckPwStrength = function (val) {
  const bars = ['nu-pw-b1', 'nu-pw-b2', 'nu-pw-b3'].map(id => document.getElementById(id));
  const label = document.getElementById('nu-pw-lbl');
  bars.forEach(b => { if (b) b.style.background = 'var(--dark-border)'; });
  if (!val) { if (label) label.textContent = ''; return; }
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;

  const levels = [
    { txt: '', color: 'var(--dark-border)' },
    { txt: 'Débil', color: '#ef5350' },
    { txt: 'Media', color: '#ffca28' },
    { txt: 'Fuerte', color: '#66bb6a' }
  ];
  const lv = levels[score] || levels[1];

  bars.slice(0, score).forEach(b => { if (b) b.style.background = lv.color; });
  if (label) label.textContent = lv.txt;
};

/* ── Tipo de documento → país ── */
window.nuOnTipoDocChange = function () {
  const tipo = document.getElementById('nu-tipo-doc').value;
  const wrap = document.getElementById('nu-pais-wrap');
  const paisInp = document.getElementById('nu-pais');

  if (tipo === 'CC') {
    wrap.style.display = 'block';
    paisInp.value = 'Colombia';
    paisInp.readOnly = true;
    paisInp.style.background = 'rgba(0,0,0,0.4)';
    paisInp.style.cursor = 'not-allowed';
  } else if (tipo) {
    wrap.style.display = 'block';
    paisInp.value = '';
    paisInp.readOnly = false;
    paisInp.style.background = '';
    paisInp.style.cursor = '';
    paisInp.placeholder = 'Escribe el país';
  } else {
    wrap.style.display = 'none';
    paisInp.value = '';
    paisInp.readOnly = false;
    paisInp.style.background = '';
    paisInp.style.cursor = '';
  }
};

/* ── Validación en tiempo real ── */
window.nuShowReq = function (id) {
  const req = document.getElementById('req-' + id);
  if (req) req.style.display = 'block';
  const err = document.getElementById('err-' + id);
  if (err) err.style.display = 'none';
  const el = document.getElementById(id);
  if (el) el.style.borderColor = '';
};

window.nuValReq = function (id) {
  const el = document.getElementById(id);
  const req = document.getElementById('req-' + id);
  const err = document.getElementById('err-' + id);
  if (req) req.style.display = 'none';

  if (id === 'nu-pais' && document.getElementById('nu-pais-wrap').style.display === 'none') {
    if (el) el.style.borderColor = '';
    if (err) err.style.display = 'none';
    return true;
  }

  let valid = true;
  let val = el ? el.value.trim() : '';
  if (id === 'nu-password' || id === 'nu-password-confirm') val = el.value;

  if (id === 'nu-tel') {
    if (!val || val.length < 7) valid = false;
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
    if (err) err.style.display = 'block';
  } else {
    if (el) el.style.borderColor = '';
    if (err) err.style.display = 'none';
  }
  return valid;
};


window.abrirModalNuevoUsuario = function (rolPred) {
  // Reset form
  document.getElementById('f-nuevo-usuario').reset();
  document.getElementById('m-nuevo-usr-alert').innerHTML = '';

  ['nu-tipo-doc', 'nu-num-doc', 'nu-pais', 'nu-nombre', 'nu-apellido', 'nu-tel', 'nu-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = '';
    const req = document.getElementById('req-' + id);
    if (req) req.style.display = 'none';
    const err = document.getElementById('err-' + id);
    if (err) err.style.display = 'none';
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

window.guardarNuevoUsuario = async function (e) {
  e.preventDefault();
  var alertDiv = document.getElementById('m-nuevo-usr-alert');
  var btn = document.getElementById('btn-guardar-usuario');
  var btnTxt = document.getElementById('btn-guardar-usuario-txt');

  alertDiv.innerHTML = '';

  const fds = ['nu-tipo-doc', 'nu-num-doc', 'nu-pais', 'nu-nombre', 'nu-apellido', 'nu-email', 'nu-tel'];
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
    var telefono = document.getElementById('nu-tel') ? document.getElementById('nu-tel').value.trim() : '';
    var pais = document.getElementById('nu-pais').value.trim();
    var tipoDoc = document.getElementById('nu-tipo-doc').value;
    var numDoc = document.getElementById('nu-num-doc').value.trim();
    var rol = document.getElementById('nu-rol').value;
    var estadoCheck = document.getElementById('nu-estado');
    var estado = estadoCheck ? estadoCheck.checked : true;

    var body = { nombre: nombre, apellido: apellido, email: email, telefono: telefono, pais: pais, tipoDocumento: tipoDoc, numeroDocumento: numDoc, rol: rol, estado: estado };

    var res = await req('/usuarios', { method: 'POST', body: JSON.stringify(body) });

    if (!res.ok && !res.success) {
      throw new Error(res.mensaje || res.message || 'Error al crear usuario');
    }

    alertDiv.innerHTML = '<div style="background:rgba(76,175,80,0.15);border:1px solid rgba(76,175,80,0.3);color:#4caf50;padding:0.75rem;border-radius:8px;font-size:0.85rem;">\\u2714 ' + (res.mensaje || 'Cuenta creada. Se envió un correo de invitación al cliente.') + '</div>';
    if (btnTxt) btnTxt.textContent = '\\u2714 Creado';

    // Reload user lists
    if (typeof window.loadUsuariosAdmin === 'function') window.loadUsuariosAdmin();
    if (typeof window.loadClientesAdmin === 'function') window.loadClientesAdmin();

    // Close modal after 1.5s
    setTimeout(function () { closeM('m-nuevo-usuario'); }, 1500);
  } catch (err) {
    console.error(err);
    alertDiv.innerHTML = '<div style="background:rgba(239,83,80,0.15);border:1px solid rgba(239,83,80,0.3);color:#ef5350;padding:0.75rem;border-radius:8px;font-size:0.85rem;">\\u2716 ' + (err.message || 'Error desconocido') + '</div>';
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = 'Crear cuenta';
  }
};

window.toggleSidebar = function () {
  const shell = document.querySelector('.admin-shell');
  const sidebar = document.querySelector('.sidebar');
  if (!shell || !sidebar) return;
  const isCollapsed = shell.classList.toggle('collapsed-menu');
  sidebar.classList.toggle('collapsed', isCollapsed);
  localStorage.setItem('sidebar-collapsed', isCollapsed ? 'true' : 'false');
};

document.addEventListener('DOMContentLoaded', () => {
  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  const shell = document.querySelector('.admin-shell');
  const sidebar = document.querySelector('.sidebar');
  if (isCollapsed) {
    if (shell) shell.classList.add('collapsed-menu');
    if (sidebar) sidebar.classList.add('collapsed');
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (shell) shell.classList.add('ready');
    });
  });
});
// ════════ IMAGE ZOOM VIEWER ════════
window.verImagenCompleta = function (src) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.cursor = 'zoom-out';
  overlay.style.backdropFilter = 'blur(4px)';

  const img = document.createElement('img');
  img.src = src;
  img.style.maxWidth = '90vw';
  img.style.maxHeight = '90vh';
  img.style.width = 'auto';
  img.style.height = 'auto';
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  img.style.objectFit = 'contain';

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  overlay.onclick = function () {
    overlay.remove();
  };
};

/* ════════════════════════════════════════════════════════════════════
   ADMIN — Añadir Servicios y Extras (modal m-add-servicios-admin)
   Same card-style design as the client modal
   ════════════════════════════════════════════════════════════════════ */

let _adminAddResId = null;
let _adminAddResData = null;
let _adminAddPaqExtras = new Map();           // key => cantidad
let _adminAddPaqExtrasOriginales = new Map(); // key => cantidad (ya reservados)
let _adminAddSrvs = new Map();               // key => cantidad
let _adminAddSrvsOriginales = new Map();     // key => cantidad (ya reservados)

async function abrirAddServiciosAdmin(id) {
  _adminAddResId = id;
  const alertEl = document.getElementById('m-add-srv-admin-alert');
  if (alertEl) alertEl.innerHTML = '';
  document.getElementById('m-add-srv-admin-id').textContent = id;

  try {
    const resp = await fetch(`/api/reservas/${id}`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const d = await resp.json();
    const reserva = d.data || d.reserva || d;
    if (!reserva || !reserva.id) { toast('Reserva no encontrada', 'error'); return; }
    _adminAddResData = reserva;

    // --- Parse servicios originales ---
    let srvsArr = reserva.servicios;
    if (typeof srvsArr === 'string') { try { srvsArr = JSON.parse(srvsArr); } catch(e){ srvsArr=[]; } }
    if (!Array.isArray(srvsArr)) srvsArr = [];
    _adminAddSrvsOriginales = new Map(srvsArr.map(s => [String(s.id || s), s.cantidad || 1]));
    _adminAddSrvs = new Map(_adminAddSrvsOriginales);

    // --- Parse paquetes extra originales ---
    let paqExtArr = reserva.paquetes_extra;
    if (typeof paqExtArr === 'string') { try { paqExtArr = JSON.parse(paqExtArr); } catch(e){ paqExtArr=[]; } }
    if (!Array.isArray(paqExtArr)) paqExtArr = [];
    _adminAddPaqExtrasOriginales = new Map(paqExtArr.map(p => {
      if (typeof p === 'object' && p.id) return [String(p.id), p.cantidad || 1];
      return [String(p), 1];
    }));
    _adminAddPaqExtras = new Map(_adminAddPaqExtrasOriginales);

    renderAdminAddPaqExtras();
    renderAdminAddSrvs();
    evaluarAdminAddServicios();
    openM('m-add-servicios-admin');
  } catch(e) {
    toast(e.message || 'Error cargando reserva', 'error');
  }
}

/* ── Render Paquetes Extras como tarjetas con +/- ── */
function renderAdminAddPaqExtras() {
  const grid = document.getElementById('m-add-srv-admin-paq-grid');
  if (!grid) return;

  const paqBase = _adminAddResData.paquete; // paquete inicial, no se puede re-añadir
  const personas = _adminAddResData.num_personas || 1;
  let html = '';

  Object.keys(PAQUETES).forEach(k => {
    const p = PAQUETES[k];
    if (k === paqBase) return; // No mostrar el paquete base

    const strK = String(k);
    const isOriginal = _adminAddPaqExtrasOriginales.has(strK);
    const originalCant = _adminAddPaqExtrasOriginales.get(strK) || 0;
    const isSelected = _adminAddPaqExtras.has(strK);
    const currentCant = _adminAddPaqExtras.get(strK) || 0;

    if (isOriginal) {
      const cant = currentCant > originalCant ? currentCant : originalCant;
      if (!_adminAddPaqExtras.has(strK) || _adminAddPaqExtras.get(strK) < originalCant) {
        _adminAddPaqExtras.set(strK, originalCant);
      }
      const hasIncrease = cant > originalCant;
      html += `
        <button type="button" class="srv-chip selected" style="background:var(--fire);color:#fff;border-color:var(--fire); margin-bottom:0; padding:0.6rem 1rem; font-size:0.85rem; min-width:180px;" title="Ya reservado — puedes aumentar personas">
          ${p.label} <span style="font-weight:600; opacity:1;">Reservado (x${cant})</span>
          <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff; ${cant <= originalCant ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="adjustAdminAddPaqCount('${k}', -1)">−</span>
            <span style="font-weight:bold; color:#fff;">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff;" onclick="adjustAdminAddPaqCount('${k}', 1)">+</span>
          </div>
          ${hasIncrease ? `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.8);">+${cant - originalCant} nuevas → +${fCop(p.precio * (cant - originalCant))}</div>` : `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.6);">Presiona + para agregar más</div>`}
        </button>`;
    } else {
      const cant = isSelected ? currentCant : 0;
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" onclick="toggleAdminAddPaq('${k}', event)" style="${isSelected ? 'background:var(--fire);color:#fff;border-color:var(--fire);' : 'background:#fff;color:var(--bark);border-color:rgba(255,255,255,0.15);'} margin-bottom:0; padding:0.6rem 1rem; font-size:0.85rem; min-width:180px;">
          ${p.label} <span style="font-weight:600; opacity:0.8;">+${fCop(p.precio)} / pers</span>
          <div style="display:${isSelected ? 'flex' : 'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};" onclick="adjustAdminAddPaqCount('${k}', -1)">−</span>
            <span style="font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};" onclick="adjustAdminAddPaqCount('${k}', 1)">+</span>
          </div>
        </button>`;
    }
  });

  grid.innerHTML = html || '<span style="color:var(--dark-muted);font-size:0.85rem;">No hay paquetes extras disponibles</span>';
}

function toggleAdminAddPaq(k, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return;
  const strK = String(k);
  if (_adminAddPaqExtrasOriginales.has(strK)) return;
  if (_adminAddPaqExtras.has(strK)) {
    _adminAddPaqExtras.delete(strK);
  } else {
    const personas = _adminAddResData ? (_adminAddResData.num_personas || 1) : 1;
    _adminAddPaqExtras.set(strK, personas);
  }
  renderAdminAddPaqExtras();
  evaluarAdminAddServicios();
}

function adjustAdminAddPaqCount(k, dir) {
  const strK = String(k);
  if (!_adminAddPaqExtras.has(strK)) return;
  let count = _adminAddPaqExtras.get(strK);
  count += dir;
  const originalMin = _adminAddPaqExtrasOriginales.has(strK) ? _adminAddPaqExtrasOriginales.get(strK) : 1;
  if (count < originalMin) count = originalMin;
  const maxCap = Math.max(...Object.values(CABANAS).map(c => c.capacidad || 0), 1);
  if (count > maxCap) count = maxCap;
  _adminAddPaqExtras.set(strK, count);
  renderAdminAddPaqExtras();
  evaluarAdminAddServicios();
}

/* ── Render Servicios Adicionales como tarjetas con +/- ── */
function renderAdminAddSrvs() {
  const grid = document.getElementById('m-add-srv-admin-srv-grid');
  if (!grid) return;

  const paq = _adminAddResData.paquete ? PAQUETES[_adminAddResData.paquete] : null;
  let includedIds = [];
  if (paq && paq.serviciosIncluidos) {
    try { includedIds = Array.isArray(paq.serviciosIncluidos) ? paq.serviciosIncluidos : JSON.parse(paq.serviciosIncluidos); } catch(e) {}
  }

  let html = '';
  Object.keys(SERVICIOS).forEach(id => {
    const s = SERVICIOS[id];
    const strId = String(id);
    const isIncluded = includedIds.some(incId => String(incId) === strId);
    const isOriginal = _adminAddSrvsOriginales.has(strId);
    const originalCant = _adminAddSrvsOriginales.get(strId) || 0;
    const currentCant = _adminAddSrvs.get(strId) || 0;

    if (isIncluded && _adminAddSrvs.has(strId)) {
      _adminAddSrvs.delete(strId);
    }

    if (isIncluded) {
      const cant = isOriginal ? originalCant : 1;
      html += `
        <button type="button" class="srv-chip disabled" style="background:#fff;color:var(--bark);border-color:rgba(255,255,255,0.15); margin-bottom:0; padding:0.6rem 1rem; font-size:0.85rem; min-width:180px;" title="Incluido en el paquete original">
          ${s.label} <span style="font-weight:600; opacity:0.8;">Incluido (x${cant})</span>
        </button>`;
    } else if (isOriginal) {
      const cant = currentCant > originalCant ? currentCant : originalCant;
      if (!_adminAddSrvs.has(strId) || _adminAddSrvs.get(strId) < originalCant) {
        _adminAddSrvs.set(strId, originalCant);
      }
      const hasIncrease = cant > originalCant;
      html += `
        <button type="button" class="srv-chip selected" style="background:var(--fire);color:#fff;border-color:var(--fire); margin-bottom:0; padding:0.6rem 1rem; font-size:0.85rem; min-width:180px;" title="Ya reservado — puedes aumentar personas">
          ${s.label} <span style="font-weight:600; opacity:1;">Reservado (x${cant})</span>
          <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff; ${cant <= originalCant ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="adjustAdminAddSrvCount('${id}', -1)">−</span>
            <span style="font-weight:bold; color:#fff;">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff;" onclick="adjustAdminAddSrvCount('${id}', 1)">+</span>
          </div>
          ${hasIncrease ? `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.8);">+${cant - originalCant} nuevas → +${fCop(s.precio * (cant - originalCant))}</div>` : `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.6);">Presiona + para agregar más</div>`}
        </button>`;
    } else {
      const isSelected = _adminAddSrvs.has(strId);
      const cant = isSelected ? _adminAddSrvs.get(strId) : 0;
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" onclick="toggleAdminAddSrv('${id}', event)" style="${isSelected ? 'background:var(--fire);color:#fff;border-color:var(--fire);' : 'background:#fff;color:var(--bark);border-color:rgba(255,255,255,0.15);'} margin-bottom:0; padding:0.6rem 1rem; font-size:0.85rem; min-width:180px;">
          ${s.label} <span style="font-weight:600; opacity:0.8;">+${fCop(s.precio)} / pers</span>
          <div style="display:${isSelected ? 'flex' : 'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};" onclick="adjustAdminAddSrvCount('${id}', -1)">−</span>
            <span style="font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected ? '#fff' : 'var(--bark)'};" onclick="adjustAdminAddSrvCount('${id}', 1)">+</span>
          </div>
        </button>`;
    }
  });
  grid.innerHTML = html || '<span style="color:var(--dark-muted);font-size:0.85rem;">No hay servicios adicionales disponibles</span>';
}

function toggleAdminAddSrv(id, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return;
  const strId = String(id);
  if (_adminAddSrvsOriginales.has(strId)) return;
  if (_adminAddSrvs.has(strId)) {
    _adminAddSrvs.delete(strId);
  } else {
    const personas = _adminAddResData ? (_adminAddResData.num_personas || 1) : 1;
    _adminAddSrvs.set(strId, personas);
  }
  renderAdminAddSrvs();
  evaluarAdminAddServicios();
}

function adjustAdminAddSrvCount(id, dir) {
  const strId = String(id);
  if (!_adminAddSrvs.has(strId)) return;
  let count = _adminAddSrvs.get(strId);
  count += dir;
  const originalMin = _adminAddSrvsOriginales.has(strId) ? _adminAddSrvsOriginales.get(strId) : 1;
  if (count < originalMin) count = originalMin;
  const maxCap = Math.max(...Object.values(CABANAS).map(c => c.capacidad || 0), 1);
  if (count > maxCap) count = maxCap;
  _adminAddSrvs.set(strId, count);
  renderAdminAddSrvs();
  evaluarAdminAddServicios();
}

/* ── Evaluar cambios y mostrar resumen ── */
let _adminAddTotalNuevos = 0;
let _adminAddNuevosDetalle = [];

function evaluarAdminAddServicios() {
  if (!_adminAddResData) return;
  const resumenContainer = document.getElementById('m-add-srv-admin-resumen');
  const listaNuevos = document.getElementById('m-add-srv-admin-lista-nuevos');
  const btnGuardar = document.getElementById('btn-add-srv-admin-guardar');

  let htmlResumen = '';
  _adminAddTotalNuevos = 0;
  _adminAddNuevosDetalle = [];

  // Paquetes Extra: cobrar solo diferencia
  for (let [k, cant] of _adminAddPaqExtras.entries()) {
    const p = PAQUETES[k];
    if (!p) continue;
    const originalCant = _adminAddPaqExtrasOriginales.get(k) || 0;
    const extraCant = cant - originalCant;
    if (extraCant > 0) {
      const costo = p.precio * extraCant;
      _adminAddTotalNuevos += costo;
      _adminAddNuevosDetalle.push({
        id: k,
        tipo: 'paquete_extra',
        label: originalCant > 0 ? `Paquete: ${p.label} (+${extraCant} pers adicionales)` : `Paquete Extra: ${p.label} (x${cant} pers)`,
        precio: costo
      });
      htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
        <span>${originalCant > 0 ? `${p.label} (+${extraCant} pers adicionales)` : `Paquete Extra: ${p.label} (x${cant} pers)`}</span>
        <strong>+${fCop(costo)}</strong>
      </div>`;
    }
  }

  // Servicios: cobrar solo diferencia
  for (let [k, cant] of _adminAddSrvs.entries()) {
    const s = SERVICIOS[k];
    if (!s) continue;
    const originalCant = _adminAddSrvsOriginales.get(k) || 0;
    const extraCant = cant - originalCant;
    if (extraCant > 0) {
      const costo = s.precio * extraCant;
      _adminAddTotalNuevos += costo;
      _adminAddNuevosDetalle.push({
        id: k,
        tipo: 'servicio',
        label: originalCant > 0 ? `${s.label} (+${extraCant} pers adicionales)` : `${s.label} (x${cant} pers)`,
        precio: costo
      });
      htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
        <span>${originalCant > 0 ? `${s.label} (+${extraCant} pers adicionales)` : `${s.label} (x${cant} pers)`}</span>
        <strong>+${fCop(costo)}</strong>
      </div>`;
    }
  }

  if (_adminAddTotalNuevos > 0) {
    htmlResumen += `<div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); color:#fff; font-size:1.1rem;">
      <strong>Total Nuevos Cargos:</strong>
      <strong style="color:var(--success);">${fCop(_adminAddTotalNuevos)}</strong>
    </div>`;
    listaNuevos.innerHTML = htmlResumen;
    resumenContainer.style.display = 'block';
    btnGuardar.textContent = 'Continuar con el pago';
    btnGuardar.style.display = 'inline-block';
  } else {
    resumenContainer.style.display = 'none';
    // Check if anything changed at all
    const hasChanges = _adminAddPaqExtras.size !== _adminAddPaqExtrasOriginales.size
      || _adminAddSrvs.size !== _adminAddSrvsOriginales.size
      || [..._adminAddPaqExtras].some(([k,v]) => _adminAddPaqExtrasOriginales.get(k) !== v)
      || [..._adminAddSrvs].some(([k,v]) => _adminAddSrvsOriginales.get(k) !== v);
    btnGuardar.style.display = hasChanges ? 'inline-block' : 'none';
  }
}

/* ── Guardar cambios ── */
async function guardarAddServiciosAdmin() {
  if (!_adminAddResId) return;

  const alertEl = document.getElementById('m-add-srv-admin-alert');
  const btn = document.getElementById('btn-add-srv-admin-guardar');
  if (alertEl) alertEl.innerHTML = '';
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Procesando pago...';

  try {
    // Combinar paquetes extra
    const allPaqExtra = [..._adminAddPaqExtras.entries()].map(([id, cant]) => ({ id, cantidad: cant }));

    // Combinar servicios
    const allSrvsIds = [...new Set([..._adminAddSrvsOriginales.keys(), ..._adminAddSrvs.keys()])];
    const allSrvs = allSrvsIds.map(id => ({ id, cantidad: _adminAddSrvs.get(id) || _adminAddSrvsOriginales.get(id) || 1 }));

    const payload = {
      servicios: allSrvs,
      paquetes_extra: allPaqExtra.map(p => p.id),
      nuevos_servicios_detalle: _adminAddNuevosDetalle,
      total_nuevos_servicios: _adminAddTotalNuevos,
      metodo_pago_nuevos_servicios: 'stripe'
    };

    await ReservasAPI.actualizar(_adminAddResId, payload);

    // Redirect to Stripe for the difference
    const token = typeof Auth !== 'undefined' ? Auth.getToken() : localStorage.getItem('kafe_token');
    const stripeRes = await fetch('/api/pagos/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idReserva: _adminAddResId, source: 'admin_add_extras', montoExtra: _adminAddTotalNuevos })
    });
    
    const stripeData = await stripeRes.json();
    if (stripeData.ok && stripeData.url) {
      window.location.href = stripeData.url;
    } else {
      throw new Error(stripeData.mensaje || 'Error al conectar con la pasarela de pagos Stripe');
    }

  } catch(err) {
    btn.disabled = false;
    btn.textContent = origText;
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}
