/* ═══════════════════════════════════════════════════════════
   KAFE ANCESTRAL — cliente.js  (v1.1 corregido)
   FIXES:
   1. NroDocumentoCliente usaba el email del usuario → ahora usa NumeroDocumento
   2. doLogout() usaba req() no global → usa AuthAPI.logout()
   3. confirmarReserva() calculaba IVA dos veces separado → usa calcMontos()
   4. calculateSubtotal() recalculaba en cada llamada → centralizado
   5. goPanel('disponibilidad') cargaba el calendario al navegar → añadido
   6. Disponibilidad: loadDisponibilidad() implementada correctamente
═══════════════════════════════════════════════════════════ */

const CLIENTE_UI = {
  cabana:'roble', paquete:null, servicios:new Set(),
  fechaInicio:'', fechaFin:'', personas:2, notas:'',
  usuarioId:null, usuarioDoc:null,
};

const CABANAS = {
  roble:     { label:'El Roble',   precio:280000, descripcion:'Chimenea · Vista bosque',       capacidad:2 },
  ceiba:     { label:'La Ceiba',   precio:420000, descripcion:'Hamacas · Jardín privado',       capacidad:4 },
  ancestral: { label:'Ancestral',  precio:650000, descripcion:'Vista panorámica · Artesanal',   capacidad:6 },
};
const HABITACIONES = {
  roble:     { title:'Habitación El Roble',    fotos:['assets/images/cabana-roble.jpg'],    descripcion:'Acogedora para parejas con chimenea y vista al bosque. Cama queen, baño privado.', caracteristicas:['2 personas','Cama queen','Baño privado','Chimenea'] },
  ceiba:     { title:'Habitación La Ceiba',    fotos:['assets/images/cabana-ceiba.jpg'],    descripcion:'Amplia familiar con hamacas y jardín privado. Perfecta para grupos pequeños.', caracteristicas:['4 personas','Cama doble + sofá cama','Baño privado','Jardín privado'] },
  ancestral: { title:'Habitación Ancestral',   fotos:['assets/images/cabana-ancestral.jpg'],descripcion:'Suite principal con decoración artesanal y vistas panorámicas.', caracteristicas:['6 personas','2 camas queen','Sala de estar','Vista panorámica'] },
};
const PAQUETES = {
  basico:   { label:'Básico',   precio:0,      descripcion:'Alojamiento en cabaña sin servicios adicionales' },
  cafetero: { label:'Cafetero', precio:80000,  descripcion:'Incluye tour guiado por café y desayuno típico' },
  premium:  { label:'Premium',  precio:200000, descripcion:'Incluye tour, spa, gastronomía y fogata' },
};
const SERVICIOS = {
  spa:        { label:'Spa',        precio:90000  },
  fogata:     { label:'Fogata',     precio:45000  },
  transporte: { label:'Transporte', precio:60000  },
  fotografia: { label:'Fotografía', precio:120000 },
};

/* FIX 3: cálculo centralizado */
function calcMontos(sub) {
  const iva = Math.round(sub * 0.19);
  return { subtotal:sub, iva, total:sub+iva };
}

/* ════════ INIT ════════ */
async function initClientePage() {
  const user = Auth.getUser();
  if (!user || !user.id) { window.location.replace('landing.html'); return; }

  CLIENTE_UI.usuarioId  = user.id;
  /* FIX 1: guardar documento (número), no email */
  CLIENTE_UI.usuarioDoc = user.numeroDocumento || user.NumeroDocumento || String(user.id);

  document.getElementById('cli-username').textContent = user.nombre || 'Cliente';

  const zone = document.getElementById('hdr-user-zone');
  if (zone) {
    zone.innerHTML = `
      <div class="hdr-user-chip"><div class="hdr-user-avatar">👤</div><span>${user.nombre||'Cliente'}</span></div>
      <button class="hdr-btn-logout" onclick="doLogout()">⎋ Salir</button>`;
  }

  highlightSelection();
  setMinDateInputs();
  goPanel('reservar');
  updateResumen();
  await Promise.all([refreshGlobalCabanas(), refreshGlobalPackages(), refreshGlobalServices()]);
  await loadMisReservas();
  /* FIX 6 */
  loadDisponibilidad();
}

/* ════════ LOGOUT — FIX 2 ════════ */
async function doLogout() {
  try { await AuthAPI.logout(); } catch { /* silencioso */ }
  Auth.clear();
  window.location.replace('landing.html');
}

/* ════════ NAVEGACIÓN ════════ */
function goPanel(panel) {
  const sections = { reservar:'section-reservar', 'mis-reservas':'section-mis-reservas', disponibilidad:'section-disponibilidad' };
  Object.entries(sections).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === panel ? 'block' : 'none';
  });
  const habitEl = document.getElementById('section-habitaciones');
  if (habitEl) habitEl.style.display = 'none';

  /* Actualizar nav activo */
  document.getElementById('nav-disp')?.classList.toggle('active', panel==='disponibilidad');
  document.getElementById('nav-rsv')?.classList.toggle('active',  panel==='reservar');
  document.getElementById('nav-mine')?.classList.toggle('active', panel==='mis-reservas');

  if (panel === 'mis-reservas')   loadMisReservas();
  if (panel === 'disponibilidad') loadDisponibilidad();
}

/* ════════ TOGGLE PANEL (botón header) ════════ */
let _currentPanel = 'reservar';
function togglePanel() {
  if (_currentPanel === 'reservar') {
    _currentPanel = 'mis-reservas';
    goPanel('mis-reservas');
    const btn = document.getElementById('toggle-panel-btn');
    if (btn) { btn.textContent = 'Nueva Reserva'; }
  } else {
    _currentPanel = 'reservar';
    goPanel('reservar');
    const btn = document.getElementById('toggle-panel-btn');
    if (btn) { btn.textContent = 'Mis Reservas'; }
  }
}

/* FIX 6: disponibilidad con calendario real */
async function loadDisponibilidad() {
  const calEl = document.getElementById('cli-cal');
  if (!calEl) return;
  try {
    const d = await ReservasAPI.disponibilidad();
    const reservadas = d.data?.reservadas || d.reservadas || [];
    const bloqueadas = d.data?.bloqueadas || d.bloqueadas || [];
    const now = new Date();
    if (typeof _cals !== 'undefined') {
      if (!_cals['cli-cal']) _cals['cli-cal'] = { y:now.getFullYear(), m:now.getMonth(), refresh:loadDisponibilidad };
      const s = _cals['cli-cal'];
      buildCal('cli-cal', s.y, s.m, reservadas, bloqueadas);
    } else {
      buildCal('cli-cal', now.getFullYear(), now.getMonth(), reservadas, bloqueadas);
    }
  } catch { /* silencioso */ }
}

/* ════════ DETALLES CABAÑA ════════ */
function openCabanaDetails(key) {
  const reservar  = document.getElementById('section-reservar');
  const habitEl   = document.getElementById('section-habitaciones');
  const gallery   = document.getElementById('room-gallery');
  const info      = HABITACIONES[key]||HABITACIONES.roble;
  if (reservar) reservar.style.display='none';
  if (habitEl)  habitEl.style.display='block';
  if (gallery) gallery.innerHTML=`
    <div class="room-card">
      <img src="${info.fotos[0]}" alt="${info.title}">
      <div class="room-card-body">
        <div class="room-title"><h3>${info.title}</h3><small>${CABANAS[key].label}</small></div>
        <p>${info.descripcion}</p>
        <div class="room-price">${fCop(CABANAS[key].precio)}<small>/noche</small></div>
        <div class="room-meta">${info.caracteristicas.map(i=>`<span>${i}</span>`).join('')}</div>
      </div>
    </div>`;
}
function closeCabanaDetails() {
  document.getElementById('section-habitaciones').style.display='none';
  document.getElementById('section-reservar').style.display='block';
}

/* ════════ SELECCIONES ════════ */
function highlightSelection() {
  document.querySelectorAll('.cabana-opt').forEach(btn=>btn.classList.toggle('selected',btn.id===`cab-${CLIENTE_UI.cabana}`));
  document.querySelectorAll('.paq-opt').forEach(btn=>btn.classList.toggle('selected', CLIENTE_UI.paquete !== null && btn.id===`p-${CLIENTE_UI.paquete}`));
  document.querySelectorAll('.srv-chip').forEach(btn=> {
    const key = btn.id.replace('srv-','');
    btn.classList.toggle('selected', CLIENTE_UI.servicios.has(key));
    btn.classList.toggle('disabled', btn.disabled);
  });
}

function getPackageIncludedServices(packageKey) {
  const pkg = PAQUETES[packageKey];
  if (!pkg) return [];
  return Array.isArray(pkg.includedServices) ? pkg.includedServices.map(String) : [];
}

function updateServiceAvailability() {
  const included = new Set(getPackageIncludedServices(CLIENTE_UI.paquete));
  included.forEach(id => CLIENTE_UI.servicios.delete(String(id)));

  document.querySelectorAll('.srv-chip').forEach(btn => {
    const key = btn.id.replace('srv-','');
    const disabled = included.has(key);
    btn.disabled = disabled;
    btn.classList.toggle('disabled', disabled);
    if (disabled) {
      btn.title = 'Incluido en el paquete seleccionado';
      btn.classList.remove('selected');
    } else {
      btn.title = '';
    }
  });
}

function selectCabana(key) { CLIENTE_UI.cabana=key; highlightSelection(); updateResumen(); }
function selectPaquete(key){
  if (CLIENTE_UI.paquete === key) {
    CLIENTE_UI.paquete = null;
  } else {
    CLIENTE_UI.paquete = key;
  }
  const included = getPackageIncludedServices(CLIENTE_UI.paquete);
  included.forEach(id => CLIENTE_UI.servicios.delete(String(id)));
  highlightSelection();
  updateServiceAvailability();
  updateResumen();
}

function openPaqueteDetails(packageId) {
  const pkg = PAQUETES[packageId];
  if (!pkg) return;
  
  const includedIds = getPackageIncludedServices(packageId);
  const includedServices = includedIds
    .map(id => SERVICIOS[id])
    .filter(Boolean)
    .map(s => `<li style="margin-bottom:0.5rem;"><strong>${s.label}</strong></li>`)
    .join('');
  
  const modal = document.getElementById('m-paquete-detalle');
  if (!modal) return;
  
  const body = modal.querySelector('.modal-body');
  if (body) {
    body.innerHTML = `
      <div style="margin-bottom:1.5rem;">
        <h4 style="color:var(--bark);margin-bottom:0.5rem;">${pkg.label}</h4>
        <p style="color:var(--mist);line-height:1.6;margin-bottom:1rem;">${pkg.descripcion||''}</p>
        
        <div style="background:var(--sand-soft);padding:1rem;border-radius:8px;margin-bottom:1rem;">
          <div style="font-size:0.9rem;color:var(--mist);margin-bottom:0.25rem;">Precio del paquete:</div>
          <div style="font-size:1.8rem;font-weight:700;color:var(--fire);">${pkg.precio>0 ? '+'+fCop(pkg.precio) : 'Incluido en cabaña'}</div>
        </div>
        
        ${includedServices ? `
          <div>
            <h5 style="color:var(--bark);margin-bottom:0.5rem;font-size:1rem;">Servicios incluidos:</h5>
            <ul style="list-style:none;padding:0;margin:0;">
              ${includedServices}
            </ul>
          </div>
        ` : '<p style="color:var(--mist);font-style:italic;">Sin servicios incluidos</p>'}
      </div>
    `;
  }
  
  openM('m-paquete-detalle');
}

function toggleSrv(key) {
  const included = getPackageIncludedServices(CLIENTE_UI.paquete);
  if (included.includes(String(key))) {
    if (typeof toast === 'function') toast('Este servicio ya está incluido en el paquete seleccionado','warn');
    return;
  }
  CLIENTE_UI.servicios.has(key) ? CLIENTE_UI.servicios.delete(key) : CLIENTE_UI.servicios.add(key);
  highlightSelection();
  updateResumen();
}

/* ════════ FORMULARIO ════════ */
function onForm() {
  document.getElementById('form-alert').innerHTML='';
  const ini=document.getElementById('f-ini').value, fin=document.getElementById('f-fin').value;
  if (ini&&fin&&new Date(fin)<=new Date(ini)) { document.getElementById('f-fin').value=''; CLIENTE_UI.fechaFin=''; }
  else CLIENTE_UI.fechaFin=fin;
  if (ini) {
    const mf=new Date(ini); mf.setDate(mf.getDate()+1);
    document.getElementById('f-fin').setAttribute('min',mf.toISOString().split('T')[0]);
  }
  CLIENTE_UI.fechaInicio=ini;
  CLIENTE_UI.personas=CABANAS[CLIENTE_UI.cabana].capacidad||2;
  CLIENTE_UI.notas=document.getElementById('f-notas')?.value||'';
  updateResumen();
}

function updateResumen() {
  const btn=document.getElementById('btn-confirmar');
  const totalRow=document.getElementById('price-total-row');
  const footer=document.getElementById('price-footer');
  const body=document.getElementById('price-body');
  const noches=nights(CLIENTE_UI.fechaInicio,CLIENTE_UI.fechaFin);
  const cab=CABANAS[CLIENTE_UI.cabana];
  const paquete=CLIENTE_UI.paquete ? PAQUETES[CLIENTE_UI.paquete] : { label: 'Ninguno', precio: 0, descripcion: 'Sin paquete adicional' };
  const srvs=Array.from(CLIENTE_UI.servicios).map(s=>SERVICIOS[s]);
  const srvP=srvs.reduce((acc,s)=>acc+(s?.precio||0),0);
  const rawSub=(cab.precio+paquete.precio)*Math.max(noches,1)+srvP*CLIENTE_UI.personas;
  /* FIX 3 */
  const {subtotal,iva,total}=calcMontos(rawSub);

  if (!CLIENTE_UI.fechaInicio||!CLIENTE_UI.fechaFin||noches<=0) {
    body.innerHTML='<div class="price-empty"><p>Selecciona fechas válidas para calcular el precio.</p></div>';
    if(totalRow) totalRow.style.display='none';
    if(footer)   footer.style.display='block';
    if(btn)      btn.disabled=false;
    return;
  }

  body.innerHTML=`
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} × ${noches} noche(s)</span></div>
    <div class="price-row"><span class="pk">Precio cabaña</span><span class="pv">${fCop(cab.precio)} / noche</span></div>
    <div class="price-row"><span class="pk">Paquete</span><span class="pv">${paquete.label}</span></div>
    <div class="price-row" style="color:var(--mist);font-size:0.85rem;"><span class="pk"></span><span class="pv">${paquete.descripcion}</span></div>
    <div class="price-row"><span class="pk">Precio paquete</span><span class="pv">${paquete.precio?`+${fCop(paquete.precio)}`:'Incluido'}</span></div>
    ${srvs.map(s=>`<div class="price-row"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio)} por persona</span></div>`).join('')}
    <div class="price-row" style="border-bottom:none;"><span class="pk">Subtotal</span><span class="pv">${fCop(subtotal)}</span></div>
    <div class="price-row" style="border-bottom:none;color:var(--mist);font-size:0.78rem;"><span class="pk">IVA (19%)</span><span class="pv">${fCop(iva)}</span></div>`;

  const ptEl=document.getElementById('pt-val'); if(ptEl) ptEl.textContent=fCop(total);
  if(totalRow) totalRow.style.display='flex';
  if(footer)   footer.style.display='block';
  if(btn)      btn.disabled=false;
}

/* ════════ CONFIRMAR RESERVA ════════ */
async function confirmarReserva() {
  const btn=document.getElementById('btn-confirmar');
  if (btn?.disabled) return;
  const fIni=document.getElementById('f-ini'), fFin=document.getElementById('f-fin');
  const errores=[];
  if (!fIni.value.trim()) errores.push('Fecha llegada: campo necesario');
  if (!fFin.value.trim()) errores.push('Fecha salida: campo necesario');
  
  const tNum = document.getElementById('mn-tarjeta-num')?.value.replace(/\s+/g,'');
  const tTitular = document.getElementById('mn-tarjeta-titular')?.value.trim();
  const tExp = document.getElementById('mn-tarjeta-exp')?.value.trim();
  const tCvv = document.getElementById('mn-tarjeta-cvv')?.value.trim();

  if (!tNum || tNum.length < 14 || !/^\d+$/.test(tNum)) errores.push('Número de tarjeta inválido');
  if (!tTitular) errores.push('Ingresa el titular de la tarjeta');
  if (!tExp) errores.push('Ingresa la fecha de vencimiento');
  if (!tCvv || tCvv.length < 3) errores.push('CVV inválido');

  if (errores.length) {
    document.getElementById('form-alert').innerHTML=`<div style="background:#fee;color:#c33;padding:0.75rem;border-radius:4px;margin-bottom:1rem;font-size:0.9rem;">${errores.join('<br>')}</div>`;
    return;
  }
  document.getElementById('form-alert').innerHTML='';

  const comprobante = 'XXXX-XXXX-XXXX-' + tNum.slice(-4);

  const noches  = nights(fIni.value, fFin.value);
  const cab     = CABANAS[CLIENTE_UI.cabana];
  const paq     = CLIENTE_UI.paquete ? PAQUETES[CLIENTE_UI.paquete] : { precio: 0 };
  const srvArr  = Array.from(CLIENTE_UI.servicios);
  const srvP    = srvArr.reduce((acc,k)=>acc+(SERVICIOS[k]?.precio||0),0);
  const rawSub  = (cab.precio+paq.precio)*Math.max(noches,1)+srvP*CLIENTE_UI.personas;
  /* FIX 3 */
  const {subtotal,iva,total}=calcMontos(rawSub);

  try {
    setLoading(btn,true,'Guardando…');
    /* FIX 1: usar documento numérico del usuario, no su email */
    await ReservasAPI.crear({
      NroDocumentoCliente: CLIENTE_UI.usuarioDoc,
      FechaInicio:         fIni.value,
      FechaFinalizacion:   fFin.value,
      SubTotal:            subtotal,
      Descuento:           0,
      IVA:                 iva,
      MontoTotal:          total,
      MetodoPago:          'tarjeta',
      monto_pagado:        total,
      comprobante_pago:    comprobante,
      num_personas:        cab.capacidad,
      cabana:              CLIENTE_UI.cabana,
      paquete:             CLIENTE_UI.paquete,
      servicios:           srvArr,
      notas:               document.getElementById('f-notas').value,
    });
    toast('Reserva creada con éxito','ok');
    loadMisReservas();
    fIni.value=''; fFin.value='';
    
    // Limpiar campos de tarjeta
    ['mn-tarjeta-num', 'mn-tarjeta-titular', 'mn-tarjeta-exp', 'mn-tarjeta-cvv'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    CLIENTE_UI.fechaInicio=''; CLIENTE_UI.fechaFin=''; CLIENTE_UI.servicios.clear();
    highlightSelection(); updateResumen();
    goPanel('mis-reservas');
  } catch(err) {
    toast(err.message||'Error al crear reserva','err');
  } finally {
    setLoading(btn,false,'Confirmar Reserva');
  }
}

/* ════════ MIS RESERVAS ════════ */
async function loadMisReservas() {
  const c=document.getElementById('reservas-list');
  c.innerHTML='<div class="price-empty"><p>Cargando reservas…</p></div>';
  try {
    const data=await ReservasAPI.misReservas();
    const reservas=data.data||data.reservas||[];
    if (!reservas.length) { c.innerHTML='<div class="price-empty"><p>No tienes reservas aún.</p></div>'; return; }
    c.innerHTML=reservas.map(r=>`
      <div class="res-item">
        <div class="res-id">#${r.id}</div>
        <div class="res-info">
          <h4>${fDate(r.fecha_inicio||r.FechaInicio)} → ${fDate(r.fecha_fin||r.FechaFinalizacion)} ${statusBadge(r.estado||'pendiente')}</h4>
          <p>${r.num_personas||1} personas · ${CABANAS[r.cabana]?.label||r.cabana||''} · ${PAQUETES[r.paquete]?.label||r.paquete||''}</p>
        </div>
        <div class="res-actions">
          <button class="btn btn-outline btn-sm" onclick="viewReserva(${r.id})">Ver</button>
          ${r.estado!=='cancelada'&&r.estado!=='completada'?`<button class="btn btn-danger btn-sm" onclick="cancelReserva(${r.id})">Cancelar</button>`:''}
        </div>
      </div>`).join('');
  } catch { c.innerHTML='<div class="price-empty"><p>Error cargando reservas.</p></div>'; }
}

function cancelReserva(id) {
  document.getElementById('m-cancel-id').textContent=`#${id}`;
  window._cancelReservaId=id;
  openM('m-cancel');
}
async function doCancelReserva() {
  const id=window._cancelReservaId; if(!id) return;
  try {
    await ReservasAPI.eliminar(id);
    toast('Reserva cancelada correctamente','ok'); closeM('m-cancel'); loadMisReservas();
  } catch(err) { toast(err.message||'No se pudo cancelar','err'); }
}

/* ════════ VER RESERVA ════════ */
async function viewReserva(id) {
  try {
    const data=await ReservasAPI.una(id); const reserva=data.data||data;
    const ini=new Date(reserva.fecha_inicio||reserva.FechaInicio);
    const fin=new Date(reserva.fecha_fin||reserva.FechaFinalizacion);
    const noches=Math.ceil((fin-ini)/(1000*60*60*24));
    let servicios=[];
    if (reserva.servicios) {
      servicios=typeof reserva.servicios==='string' ? JSON.parse(reserva.servicios) : (Array.isArray(reserva.servicios)?reserva.servicios:[]);
    }
    const srvLabels=servicios.map(s=>typeof s==='string'?(SERVICIOS[s]?.label||s):s.label||s);
    const cabanaLabel=CABANAS[reserva.cabana]?.label||reserva.cabana||'—';
    const paqueteLabel=PAQUETES[reserva.paquete]?.label||reserva.paquete||'—';

    document.getElementById('m-detalle-body').innerHTML=`
      <div style="display:grid;gap:1.5rem;">
        <div style="border-bottom:1px solid var(--sand);padding-bottom:1rem;">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
            <span class="badge badge-fire">#${reserva.id}</span>${statusBadge(reserva.estado||'pendiente')}
          </div>
          <p style="color:var(--mist);font-size:0.85rem;margin:0;">Reservada el ${fDate(reserva.fecha_reserva||reserva.FechaReserva)}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.3rem;font-weight:600;">Fecha llegada</label><div style="font-size:0.95rem;font-weight:600;color:var(--bark);">${fDate(reserva.fecha_inicio||reserva.FechaInicio)}</div></div>
          <div><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.3rem;font-weight:600;">Fecha salida</label><div style="font-size:0.95rem;font-weight:600;color:var(--bark);">${fDate(reserva.fecha_fin||reserva.FechaFinalizacion)}</div></div>
          <div><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.3rem;font-weight:600;">Duración</label><div style="font-size:0.95rem;font-weight:600;color:var(--bark);">${noches} ${noches===1?'noche':'noches'}</div></div>
          <div><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.3rem;font-weight:600;">Personas</label><div style="font-size:0.95rem;font-weight:600;color:var(--bark);">${reserva.num_personas||1}</div></div>
        </div>
        <div style="border-top:1px solid var(--sand);border-bottom:1px solid var(--sand);padding:1.25rem 0;">
          <div style="margin-bottom:0.75rem;"><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.4rem;font-weight:600;">Cabaña</label><div style="font-size:0.95rem;color:var(--bark);font-weight:500;">🏠 ${cabanaLabel}</div></div>
          <div style="margin-bottom:0.75rem;"><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.4rem;font-weight:600;">Paquete</label><div style="font-size:0.95rem;color:var(--bark);font-weight:500;">📦 ${paqueteLabel}</div></div>
          ${srvLabels.length?`<div><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.4rem;font-weight:600;">Servicios</label><div style="display:flex;flex-wrap:wrap;gap:0.5rem;">${srvLabels.map(s=>`<span style="background:var(--fire-soft);color:var(--fire);padding:0.35rem 0.7rem;border-radius:4px;font-size:0.8rem;font-weight:600;">✓ ${s}</span>`).join('')}</div></div>`:'<div style="font-size:0.9rem;color:var(--mist);">Sin servicios adicionales</div>'}
          ${reserva.notas?`<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--sand);"><label style="display:block;color:var(--mist);font-size:0.8rem;margin-bottom:0.4rem;font-weight:600;">Notas</label><div style="font-size:0.9rem;color:var(--bark);font-style:italic;">${reserva.notas}</div></div>`:''}
        </div>
        <div style="background:var(--fire-soft);padding:1.25rem;border-radius:8px;border:1px solid var(--fire-border);">
          <div style="margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid var(--fire-border);">
            <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:0.4rem;"><span style="color:var(--bark);">Subtotal</span><span style="font-weight:600;color:var(--bark);">${fCop(reserva.subtotal||reserva.SubTotal||0)}</span></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--bark);margin-bottom:0.75rem;opacity:0.85;"><span>IVA (19%)</span><span>${fCop(reserva.iva||reserva.IVA||0)}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid var(--fire);padding-top:0.75rem;">
            <span style="font-weight:700;font-size:0.95rem;color:var(--bark);">Total</span>
            <span style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;color:var(--fire);">${fCop(reserva.monto_total||reserva.MontoTotal||0)}</span>
          </div>
        </div>
      </div>`;
    openM('m-detalle');
  } catch(err) { toast(err.message||'Error al cargar detalle','err'); }
}

window.addEventListener('DOMContentLoaded', initClientePage);

/* ════════ PROTECCIÓN BOTÓN ATRÁS ════════ */
window.addEventListener('pageshow', (event) => {
  if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
    if (!Auth.isLogged()) {
      window.location.replace('landing.html');
    }
  }
});


/* ════════ DYNAMIC SERVICES IN RESERVATION ════════ */
async function refreshGlobalServices() {
  try {
    const data = await req('/servicios');
    const srvs = data.servicios || data.data || [];
    
    for (const key in SERVICIOS) delete SERVICIOS[key];
    
    let html = '';
    srvs.forEach(s => {
      if (!s.Estado && s.Estado !== 1) return; // Only show active services
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo };
      html += `
        <button type="button" class="srv-chip" id="srv-${s.IDServicio}" onclick="toggleSrv('${s.IDServicio}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M5 12l5 5L20 7"/></svg> ${s.NombreServicio} <span class="srv-price">+${s.Costo/1000}k</span>
        </button>`;
    });

    const srvGrid = document.querySelector('#section-reservar .srv-grid');
    if (srvGrid) srvGrid.innerHTML = html;
    if (typeof updateServiceAvailability === 'function') updateServiceAvailability();
    if (typeof highlightSelection === 'function') highlightSelection();
  } catch(e) { console.error('Error refreshing services', e); }
}

document.addEventListener('DOMContentLoaded', refreshGlobalServices);
refreshGlobalServices();


/* ════════ DYNAMIC PACKAGES IN RESERVATION ════════ */
async function refreshGlobalPackages() {
  try {
    const data = await req('/paquetes');
    const paqs = data.paquetes || data.data || [];
    
    for (const key in PAQUETES) delete PAQUETES[key];
    
    let html = '';
    let firstPaq = null;
    paqs.forEach(p => {
      if (!p.Estado && p.Estado !== 1) return;
      if (!firstPaq) firstPaq = p.IDPaquete;
      const included = new Set();
      if (p.IDServicio) included.add(String(p.IDServicio));
      if (p.ServiciosIncluidos) {
        try {
          const parsed = typeof p.ServiciosIncluidos === 'string' ? JSON.parse(p.ServiciosIncluidos) : p.ServiciosIncluidos;
          if (Array.isArray(parsed)) parsed.forEach(s => included.add(String(s)));
        } catch (error) {
          // ignore malformed included services
        }
      }
      PAQUETES[p.IDPaquete] = {
        label: p.NombrePaquete,
        precio: p.Precio,
        descripcion: p.Descripcion,
        includedServices: [...included],
        includedLabel: p.NombreServicio || null,
      };
    });
    
    // Don't auto-select: paquete is optional

    paqs.forEach((p) => {
      if (!PAQUETES[p.IDPaquete]) return;
      const pkg = PAQUETES[p.IDPaquete];
      const isSelected = CLIENTE_UI.paquete == p.IDPaquete;
      
      html += `
        <div class="paq-opt ${isSelected?'selected':''}" id="p-${p.IDPaquete}" style="display:flex;flex-direction:column;justify-content:space-between;position:relative;">
          <div onclick="selectPaquete('${p.IDPaquete}')" style="cursor:pointer;flex:1;display:flex;flex-direction:column;">
            <div class="paq-ico" style="color:var(--amber);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
            <div class="paq-name">${p.NombrePaquete}</div>
            <div class="paq-price">${p.Precio>0 ? '+'+fCop(p.Precio) : 'Incluido'}</div>
          </div>
          <button type="button" class="btn btn-fire btn-block" style="margin-top:0.8rem;" onclick="event.stopPropagation();openPaqueteDetails('${p.IDPaquete}')">Ver</button>
          ${isSelected ? '<span style="position:absolute;top:0.6rem;right:0.6rem;width:20px;height:20px;border-radius:50%;background:var(--fire);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;">✓</span>' : ''}
        </div>`;
    });

    const grid = document.getElementById('p-basico')?.parentNode || document.querySelector('#section-reservar .paquete-grid');
    if (grid) grid.innerHTML = html;
    
    if (typeof updateServiceAvailability === 'function') updateServiceAvailability();
    if (typeof highlightSelection === 'function') highlightSelection();
    if (typeof updateResumen === 'function') updateResumen();
  } catch(e) { console.error('Error refreshing packages', e); }
}

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
      if (!c.Estado && c.Estado !== 1) return;
      if (!firstCab) firstCab = c.IDCabana;
      CABANAS[c.IDCabana] = { label: c.Nombre, precio: c.Costo, descripcion: c.Descripcion, capacidad: c.CapacidadMaxima };
    });
    
    if (!CABANAS[CLIENTE_UI.cabana] && firstCab) {
      CLIENTE_UI.cabana = firstCab;
    }

    cabanas.forEach((c) => {
      if (!CABANAS[c.IDCabana]) return;
      const isSelected = CLIENTE_UI.cabana == c.IDCabana;
      const imgSrc = c.ImagenCabana || c.ImagenHabitacion || c.Foto || 'assets/images/cabana-roble.jpg';
      
      html += `
        <button type="button" class="cabana-opt ${isSelected?'selected':''}" id="cab-${c.IDCabana}" onclick="selectCabana('${c.IDCabana}')">
          <div class="cabana-img">
            <img src="${imgSrc}" alt="${c.Nombre}" onerror="this.src='assets/images/cabana-roble.jpg'">
            <span class="cabana-action" onclick="event.stopPropagation(); openCabanaDetails('${c.IDCabana}')">✕</span>
          </div>
          <div class="cabana-info">
            <div class="cabana-title-row"><h4>${c.Nombre}</h4><span class="cabana-price-inline">${fCop(c.Costo)}</span></div>
            <p>${c.Descripcion || ''}</p>
            <div style="font-size:0.72rem;color:var(--mist);margin-top:0.2rem;">Hasta ${c.CapacidadMaxima} pers.</div>
          </div>
        </button>`;
    });

    const grid = document.getElementById('cab-roble')?.parentNode || document.querySelector('#section-reservar .cabana-grid');
    if (grid) grid.innerHTML = html;
    
    if (typeof updateResumen === 'function') updateResumen();
  } catch(e) { console.error('Error refreshing cabanas', e); }
}

document.addEventListener('DOMContentLoaded', refreshGlobalCabanas);
refreshGlobalCabanas();
