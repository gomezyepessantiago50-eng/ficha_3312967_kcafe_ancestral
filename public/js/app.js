/* ═══════════════════════════════════════════
   KAFE ANCESTRAL — App Utilities
═══════════════════════════════════════════ */

/* ── Toast ──────────────────────────────── */
function toast(msg, type = 'ok') {
  let w = document.getElementById('_tw');
  if (!w) { w = Object.assign(document.createElement('div'), { id:'_tw', className:'toast-wrap' }); document.body.appendChild(w); }
  const t = document.createElement('div');
  const icons = { ok:'✓', err:'✕', warn:'!' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-ico">${icons[type]||'i'}</span><span>${msg}</span>`;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(12px)'; t.style.transition='all 0.3s'; }, 3000);
  setTimeout(() => t.remove(), 3350);
}

/* ── Modal ──────────────────────────────── */
const openM  = id => document.getElementById(id)?.classList.add('open');
const closeM = id => document.getElementById(id)?.classList.remove('open');
document.addEventListener('click', e => { if (e.target.classList.contains('overlay')) e.target.classList.remove('open'); });

/* ── Tabs ───────────────────────────────── */
function initTabs(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-tabs]').forEach(g => {
    g.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        g.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        g.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        g.querySelector('#' + btn.dataset.tab)?.classList.add('active');
      });
    });
  });
}

/* ── Format helpers ─────────────────────── */
const fDate  = s => s ? new Date(String(s).includes('T') ? s : s + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fDateTime = s => s ? new Date(String(s).includes('T') ? s : s + 'T12:00:00').toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const nights = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
const fCop   = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);

/* ── Status badge ───────────────────────── */
const statusBadge = s => {
  const m = { pendiente:['badge-pending','⏳ Pendiente'], confirmada:['badge-confirm','✓ Confirmada'], cancelada:['badge-cancel','✕ Cancelada'] };
  const [c,l] = m[s] || ['badge-muted', s];
  return `<span class="badge ${c}">${l}</span>`;
};

/* ── Validación de fechas ───────────────────────── */
function setMinDateInputs() {
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  // Aplicar a cliente
  const fIni = document.getElementById('f-ini');
  const fFin = document.getElementById('f-fin');
  if (fIni) fIni.setAttribute('min', minDate);
  if (fFin) fFin.setAttribute('min', minDate);
  
  // Aplicar a admin
  const mnIni = document.getElementById('mn-ini');
  const mnFin = document.getElementById('mn-fin');
  if (mnIni) mnIni.setAttribute('min', minDate);
  if (mnFin) mnFin.setAttribute('min', minDate);
}

/* ── Calendar ───────────────────────────── */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WDAYS  = ['L','M','X','J','V','S','D'];
const _cals  = {};

function buildCal(id, y, m, reserved = [], blocked = [], onClick = null) {
  const el = document.getElementById(id); if (!el) return;
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const heads   = WDAYS.map(d => `<div class="cal-wday">${d}</div>`).join('');
  const empties = '<div class="cal-day cal-empty"></div>'.repeat(first);
  let cells = '';
  for (let d = 1; d <= total; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const todayUTC = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const cellUTC = new Date(y, m, d).getTime();
    const isTod  = cellUTC === todayUTC;
    const isPast = cellUTC < todayUTC;
    const isRes  = reserved.includes(ds);
    const isBlk  = blocked.includes(ds);
    let cls = 'cal-day';
    if (isTod)       cls += ' cal-today';
    else if (isBlk)  cls += ' cal-blocked';
    else if (isRes)  cls += ' cal-reserved';
    else if (isPast) cls += ' cal-past';
    const click = onClick && !isPast ? `onclick="${onClick}('${ds}')"` : '';
    cells += `<div class="${cls}" data-date="${ds}" ${click} title="${ds}">${d}</div>`;
  }
  el.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="calMove('${id}',-1)">‹</button>
        <span class="cal-title">${MONTHS[m]} ${y}</span>
        <button class="cal-nav-btn" onclick="calMove('${id}',1)">›</button>
      </div>
      <div class="cal-grid">${heads}${empties}${cells}</div>
      <div class="cal-legend">
        <div class="cal-legend-item"><div class="cal-dot" style="background:var(--fire)"></div>Hoy</div>
        <div class="cal-legend-item"><div class="cal-dot" style="background:var(--success-bg);border:1px solid var(--success)"></div>Reservado</div>
        <div class="cal-legend-item"><div class="cal-dot" style="background:var(--danger-bg);border:1px solid var(--danger)"></div>Bloqueado</div>
      </div>
    </div>`;
}

function calMove(id, dir) {
  const s = _cals[id]; if (!s) return;
  s.m += dir;
  if (s.m > 11) { s.m = 0;  s.y++; }
  if (s.m < 0)  { s.m = 11; s.y--; }
  s.refresh();
}

function regCal(id, y, m, refreshFn) {
  _cals[id] = { y, m, refresh: refreshFn };
}

/* ── Loading spinner ────────────────────── */
function setLoading(btn, loading, label = 'Cargando…') {
  if (loading) { btn.dataset.orig = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span> ${label}`; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.orig || label; btn.disabled = false; }
}

/* ── Pricing engine ─────────────────────── */
const PRICES = {
  cabanas: {
    '1':          { base: 280000, label: 'Cabaña El Roble'    },
    '2':          { base: 420000, label: 'Cabaña La Ceiba'    },
    '3':          { base: 650000, label: 'Cabaña Ancestral'   },
  },
  paquetes: {
    '1':          { precio: 150000, label: 'Viaje Familiar'   },
    '2':          { precio: 95000,  label: 'Experiencia Cafetera' },
    '3':          { precio: 220000, label: 'Paquete Premium'  },
  },
  servicios: {
    '1':          { precio: 150000, label: 'Spa y Relajación' },
    '2':          { precio: 75000,  label: 'Noche de Fogata'  },
    '3':          { precio: 100000, label: 'Transporte Privado'},
    '4':          { precio: 180000, label: 'Sesión Fotográfica'},
    '5':          { precio: 90000,  label: 'Tour Cafetero'    },
    '6':          { precio: 35000,  label: 'Desayuno Campesino'},
    '7':          { precio: 50000,  label: 'Senderismo Guiado'},
  },
  iva: 0.19,
};

function calcTotal(cabana, paquete, servicios = [], numPersonas = 2, numNoches = 1) {
  const cab   = PRICES.cabanas[cabana]   || { base: 0 };
  const paq   = PRICES.paquetes[paquete] || { precio: 0 };
  const srvs  = servicios.reduce((s, k) => s + (PRICES.servicios[k]?.precio || 0), 0);
  const sub   = (cab.base + paq.precio) * numNoches + srvs * numPersonas;
  const iva   = sub * PRICES.iva;
  const total = sub + iva;
  return { sub, iva, total, perNoche: cab.base + paq.precio };
}

document.addEventListener('DOMContentLoaded', initTabs);
