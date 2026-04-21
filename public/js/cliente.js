const CLIENTE_UI = {
  cabana: 'roble',
  paquete: 'basico',
  servicios: new Set([]),
  fechaInicio: '',
  fechaFin: '',
  personas: 2,
  notas: ''
};

const CABANAS = {
  roble: { label:'El Roble', precio:280000, descripcion:'Chimenea · Vista bosque', capacidad:2 },
  ceiba: { label:'La Ceiba', precio:420000, descripcion:'Hamacas · Jardín privado', capacidad:4 },
  ancestral: { label:'Ancestral', precio:650000, descripcion:'Vista panorámica · Artesanal', capacidad:6 },
};

const HABITACIONES = {
  roble: {
    title: 'Habitación El Roble',
    fotos: ['assets/images/cabana-roble.jpg'],
    descripcion: 'Habitación acogedora para parejas con chimenea, detalles en madera natural y una vista directa al bosque. Incluye cama queen, ropa de cama artesanal y baño privado con amenidades.',
    caracteristicas: ['2 personas', 'Cama queen', 'Baño privado', 'Chimenea']
  },
  ceiba: {
    title: 'Habitación La Ceiba',
    fotos: ['assets/images/cabana-ceiba.jpg'],
    descripcion: 'Amplia habitación familiar con mucha luz y conexión al jardín privado. Perfecta para grupos pequeños que buscan descanso entre hamacas y naturaleza.',
    caracteristicas: ['4 personas', 'Cama doble + sofá cama', 'Baño privado', 'Jardín privado']
  },
  ancestral: {
    title: 'Habitación Ancestral',
    fotos: ['assets/images/cabana-ancestral.jpg'],
    descripcion: 'Suite principal con decoración artesanal, espacio adicional y vistas panorámicas. Ideal para grupos o familias que prefieren un ambiente exclusivo y tranquilo.',
    caracteristicas: ['6 personas', '2 camas queen', 'Sala de estar', 'Vista panorámica']
  },
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

function initClientePage() {
  if (localStorage.getItem('kafe_role') !== 'cliente') {
    localStorage.setItem('kafe_role','cliente');
  }
  document.getElementById('cli-username').textContent = 'Cliente Demo';
  highlightSelection();
  document.getElementById('f-personas').value = CLIENTE_UI.personas;
  setMinDateInputs();
  goPanel('reservar');
  updateResumen();
  loadMisReservas();
}

function togglePanel() {
  const reservarSection = document.getElementById('section-reservar');
  const target = reservarSection.style.display === 'none' ? 'reservar' : 'mis-reservas';
  goPanel(target);
}

function doLogout() {
  localStorage.removeItem('kafe_role');
  window.location.href = 'index.html';
}

function goPanel(panel) {
  const reservar = document.getElementById('section-reservar');
  const habitaciones = document.getElementById('section-habitaciones');
  const mis = document.getElementById('section-mis-reservas');
  const toggleBtn = document.getElementById('toggle-panel-btn');
  habitaciones.style.display = 'none';
  if (panel === 'mis-reservas') {
    reservar.style.display = 'none';
    mis.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = 'Reservar';
  } else {
    reservar.style.display = 'block';
    mis.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = 'Mis Reservas';
  }
}

function openCabanaDetails(key) {
  const reservar = document.getElementById('section-reservar');
  const habitaciones = document.getElementById('section-habitaciones');
  const gallery = document.getElementById('room-gallery');
  const info = HABITACIONES[key] || HABITACIONES.roble;
  reservar.style.display = 'none';
  habitaciones.style.display = 'block';
  gallery.innerHTML = `
    <div class="room-card">
      <img src="${info.fotos[0]}" alt="${info.title}">
      <div class="room-card-body">
        <div class="room-title"><h3>${info.title}</h3><small>${CABANAS[key].label}</small></div>
        <p>${info.descripcion}</p>
        <div class="room-price">${fCop(CABANAS[key].precio)}<small>/noche</small></div>
        <div class="room-meta">
          ${info.caracteristicas.map(item => `<span>${item}</span>`).join('')}
        </div>
      </div>
    </div>
    <div>
      <h3 style="margin-bottom:0.85rem;">Fotos de la habitación</h3>
      <div class="room-thumbs">
        ${info.fotos.map(src => `<div class="room-thumb"><img src="${src}" alt="${info.title}"></div>`).join('')}
      </div>
    </div>
  `;
}

function closeCabanaDetails() {
  document.getElementById('section-habitaciones').style.display = 'none';
  document.getElementById('section-reservar').style.display = 'block';
}

function highlightSelection() {
  document.querySelectorAll('.cabana-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.id === `cab-${CLIENTE_UI.cabana}`);
  });
  document.querySelectorAll('.paq-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.id === `p-${CLIENTE_UI.paquete}`);
  });
  document.querySelectorAll('.srv-chip').forEach(btn => {
    const srv = btn.id.replace('srv-','');
    btn.classList.toggle('selected', CLIENTE_UI.servicios.has(srv));
  });
}

function selectCabana(key) {
  CLIENTE_UI.cabana = key;
  highlightSelection();
  updateResumen();
}

function selectPaquete(key) {
  CLIENTE_UI.paquete = key;
  highlightSelection();
  updateResumen();
}

function toggleSrv(key) {
  if (CLIENTE_UI.servicios.has(key)) CLIENTE_UI.servicios.delete(key);
  else CLIENTE_UI.servicios.add(key);
  highlightSelection();
  updateResumen();
}

function onForm() {
  // Limpiar alertas previas
  document.getElementById('form-alert').innerHTML = '';
  
  const ini = document.getElementById('f-ini').value;
  const fin = document.getElementById('f-fin').value;
  
  // Validar que fin sea después de inicio
  if (ini && fin && new Date(fin) <= new Date(ini)) {
    document.getElementById('f-fin').value = '';
    CLIENTE_UI.fechaFin = '';
  } else {
    CLIENTE_UI.fechaFin = fin;
  }
  
  // Establecer min de fecha fin = día siguiente a la fecha inicio
  if (ini) {
    const minFinDate = new Date(ini);
    minFinDate.setDate(minFinDate.getDate() + 1);
    document.getElementById('f-fin').setAttribute('min', minFinDate.toISOString().split('T')[0]);
  }
  
  CLIENTE_UI.fechaInicio = ini;
  CLIENTE_UI.personas = Number(document.getElementById('f-personas').value) || 1;
  CLIENTE_UI.notas = document.getElementById('f-notas')?.value || '';
  updateResumen();
}

function updateResumen() {
  const btn = document.getElementById('btn-confirmar');
  const totalRow = document.getElementById('price-total-row');
  const footer = document.getElementById('price-footer');
  const body = document.getElementById('price-body');
  const noches = nights(CLIENTE_UI.fechaInicio, CLIENTE_UI.fechaFin);
  const cab = CABANAS[CLIENTE_UI.cabana];
  const paquete = PAQUETES[CLIENTE_UI.paquete];
  const servicios = Array.from(CLIENTE_UI.servicios).map(s => SERVICIOS[s]);
  const serviciosPrecio = servicios.reduce((acc, item) => acc + (item?.precio || 0), 0);
  const subtotal = (cab.precio + paquete.precio) * Math.max(noches, 1) + serviciosPrecio * CLIENTE_UI.personas;
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  
  // Siempre mostrar el botón, pero solo calcular precio si hay fechas válidas
  if (!CLIENTE_UI.fechaInicio || !CLIENTE_UI.fechaFin || noches <= 0) {
    body.innerHTML = '<div class="price-empty"><p>Selecciona fechas válidas para calcular el precio.</p></div>';
    totalRow.style.display = 'none';
    footer.style.display = 'block'; // Mostrar footer con botón
    btn.disabled = false; // Permitir intentar enviar para ver validaciones
    return;
  }
  
  body.innerHTML = `
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} x ${noches} noche(s)</span></div>
    <div class="price-row"><span class="pk">Precio cabaña</span><span class="pv">${fCop(cab.precio)} / noche</span></div>
    <div class="price-row"><span class="pk">Paquete</span><span class="pv">${paquete.label}</span></div>
    <div class="price-row" style="color:var(--mist);font-size:0.85rem;"><span class="pk"></span><span class="pv">${paquete.descripcion}</span></div>
    <div class="price-row"><span class="pk">Precio paquete</span><span class="pv">${paquete.precio ? `+${fCop(paquete.precio)}` : 'Incluido'}</span></div>
    ${servicios.map(s => `<div class="price-row"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio)} por persona</span></div>`).join('')}
    <div class="price-row" style="border-bottom:none;"><span class="pk">Subtotal</span><span class="pv">${fCop(subtotal)}</span></div>
    <div class="price-row" style="border-bottom:none;color:var(--mist);font-size:0.78rem;"><span class="pk">IVA</span><span class="pv">${fCop(iva)}</span></div>
  `;
  document.getElementById('pt-val').textContent = fCop(total);
  totalRow.style.display = 'flex';
  footer.style.display = 'block';
  btn.disabled = false;
}

async function confirmarReserva() {
  const btn = document.getElementById('btn-confirmar');
  if (btn.disabled) return;
  
  // Validar campos requeridos
  const errores = [];
  const fIni = document.getElementById('f-ini');
  const fFin = document.getElementById('f-fin');
  const fPersonas = document.getElementById('f-personas');
  
  if (!fIni.value.trim()) {
    errores.push('Fecha llegada: campo necesario');
  }
  if (!fFin.value.trim()) {
    errores.push('Fecha salida: campo necesario');
  }
  if (!fPersonas.value.trim()) {
    errores.push('Número de personas: campo necesario');
  }
  
  if (errores.length > 0) {
    const alertDiv = document.getElementById('form-alert');
    alertDiv.innerHTML = `<div style="background:#fee;color:#c33;padding:0.75rem;border-radius:4px;margin-bottom:1rem;font-size:0.9rem;">${errores.join('<br>')}</div>`;
    return;
  }
  
  // Limpiar alertas previas
  document.getElementById('form-alert').innerHTML = '';
  
  try {
    setLoading(btn, true, 'Guardando…');
    await ReservasAPI.crear({
      NroDocumentoCliente: 'demo-client',
      FechaInicio: fIni.value,
      FechaFinalizacion: fFin.value,
      SubTotal: calculateSubtotal(),
      Descuento: 0,
      IVA: Math.round(calculateSubtotal() * 0.19),
      MontoTotal: calculateSubtotal() + Math.round(calculateSubtotal() * 0.19),
      MetodoPago: 1,
      num_personas: Number(fPersonas.value),
      cabana: CLIENTE_UI.cabana,
      paquete: CLIENTE_UI.paquete,
      servicios: Array.from(CLIENTE_UI.servicios),
      notas: document.getElementById('f-notas').value,
    });
    toast('Reserva creada con éxito', 'ok');
    loadMisReservas();
    document.getElementById('f-ini').value = '';
    document.getElementById('f-fin').value = '';
    CLIENTE_UI.fechaInicio = '';
    CLIENTE_UI.fechaFin = '';
    CLIENTE_UI.servicios.clear();
    highlightSelection();
    updateResumen();
  } catch (err) {
    toast(err.message || 'Error al crear reserva', 'err');
  } finally {
    setLoading(btn, false, 'Confirmar Reserva');
  }
}

function calculateSubtotal() {
  const noches = nights(CLIENTE_UI.fechaInicio, CLIENTE_UI.fechaFin);
  const cab = CABANAS[CLIENTE_UI.cabana];
  const paquete = PAQUETES[CLIENTE_UI.paquete];
  const servicios = Array.from(CLIENTE_UI.servicios).reduce((sum, key) => sum + (SERVICIOS[key]?.precio || 0), 0);
  return (cab.precio + paquete.precio) * Math.max(noches, 1) + servicios * CLIENTE_UI.personas;
}

async function loadMisReservas() {
  const container = document.getElementById('reservas-list');
  container.innerHTML = '<div class="price-empty"><p>Cargando reservas…</p></div>';
  try {
    const data = await ReservasAPI.misReservas();
    const reservas = data.reservas || data || [];
    if (!reservas.length) {
      container.innerHTML = '<div class="price-empty"><p>No tienes reservas aún.</p></div>';
      return;
    }
    container.innerHTML = reservas.map(r => `
      <div class="res-item">
        <div class="res-id">#${r.id}</div>
        <div class="res-info"><h4>${fDate(r.FechaInicio)} → ${fDate(r.FechaFinalizacion)} ${statusBadge(r.estado || r.Estado || 'pendiente')}</h4><p>${r.num_personas || r.num_personas || 1} personas · ${r.cabana || ''} · ${r.paquete || ''}</p></div>
        <div class="res-actions"><button class="btn btn-outline btn-sm" type="button" onclick="viewReserva(${r.id})">Ver</button>${r.estado !== 'cancelada' ? ` <button class="btn btn-danger btn-sm" type="button" onclick="cancelReserva(${r.id})">Cancelar</button>` : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="price-empty"><p>Error cargando reservas.</p></div>';
  }
}

async function cancelReserva(id) {
  try {
    await ReservasAPI.eliminar(id);
    toast('Reserva cancelada', 'ok');
    loadMisReservas();
  } catch (err) {
    toast(err.message || 'No se pudo cancelar', 'err');
  }
}

function viewReserva(id) {
  toast(`Reserva #${id}`, 'ok');
}

window.addEventListener('DOMContentLoaded', initClientePage);
