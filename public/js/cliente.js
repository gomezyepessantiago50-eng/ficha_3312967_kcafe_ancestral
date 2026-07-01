/* ═══════════════════════════════════════════════════════════
   KAFE ANCESTRAL — cliente.js  (v1.1 corregido)
   FIXES:
   1. NroDocumentoCliente usaba el email del usuario → ahora usa NumeroDocumento
   2. doLogout() usaba req() no global → usa AuthAPI.logout()
   3. confirmarReserva() calculaba IVA dos veces separado → usa calcMontos()
   4. calculateSubtotal() recalculaba en cada llamada → centralizado
   5. goPanel('disponibilidad') cargaba el calendario al navegar → añadido
   6. Disponibilidad: loadDisponibilidad() implementada correctamente
   7. Sección Configuración añadida
═══════════════════════════════════════════════════════════ */

const CLIENTE_UI = {
  cabana:null, paquete:null, servicios:new Map(),
  fechaInicio:'', fechaFin:'', personas:2, notas:'',
  usuarioId:null, usuarioDoc:null,
};

const CABANAS = {};
const PAQUETES = {};
const SERVICIOS = {};

/* FIX 3: cálculo centralizado */
function calcMontos(sub) {
  const s = parseFloat(sub) || 0;
  const iva = 0; // Sin IVA
  return { subtotal:s, iva, total:s };
}

/* ════════ CONFIGURACIÓN ════════ */
async function cargarDatosConfiguracion() {
  try {
    const res = await AuthAPI.perfil();
    if (res.ok && res.usuario) {
      const u = res.usuario;
      document.getElementById('conf-nombre').value = u.nombre || '';
      document.getElementById('conf-apellido').value = u.apellido || '';
      document.getElementById('conf-email').value = u.email || '';
      document.getElementById('conf-telefono').value = u.telefono || '';
      document.getElementById('conf-tipodoc').value = u.tipoDocumento || '';
      document.getElementById('conf-numdoc').value = u.numeroDocumento || '';
      document.getElementById('conf-pais').value = u.pais || '';
      
      if (u.DocumentoModificado) {
        document.getElementById('conf-tipodoc').disabled = true;
        document.getElementById('conf-numdoc').disabled = true;
        document.getElementById('conf-tipodoc').title = 'Ya no puedes modificar el tipo de documento.';
        document.getElementById('conf-numdoc').title = 'Ya no puedes modificar el número de documento.';
      } else {
        document.getElementById('conf-tipodoc').disabled = false;
        document.getElementById('conf-numdoc').disabled = false;
        document.getElementById('conf-tipodoc').title = '';
        document.getElementById('conf-numdoc').title = '';
      }
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

function showConfError(msg) {
  const alertEl = document.getElementById('conf-form-alert');
  if (msg) {
    alertEl.innerHTML = msg;
    alertEl.style.display = 'block';
    alertEl.style.textAlign = msg.includes('<br>') ? 'left' : 'center';
  } else {
    alertEl.style.display = 'none';
    alertEl.innerHTML = '';
  }
}

async function guardarConfiguracion() {
  showConfError('');
  const btn = document.getElementById('btn-conf-guardar');
  const txt = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const body = {
      nombre: document.getElementById('conf-nombre').value.trim(),
      apellido: document.getElementById('conf-apellido').value.trim(),
      email: document.getElementById('conf-email').value.trim(),
      telefono: document.getElementById('conf-telefono').value.trim(),
      tipoDocumento: document.getElementById('conf-tipodoc').value,
      numeroDocumento: document.getElementById('conf-numdoc').value.trim(),
      pais: document.getElementById('conf-pais').value.trim()
    };

    // Validación detallada — recopilar todos los errores
    const errores = [];

    if (!body.nombre) errores.push('El campo <strong>Nombre</strong> es obligatorio.');
    else if (body.nombre.length < 2) errores.push('El <strong>Nombre</strong> debe tener al menos 2 caracteres.');
    else if (/[0-9]/.test(body.nombre)) errores.push('El <strong>Nombre</strong> no puede contener números.');

    if (!body.apellido) errores.push('El campo <strong>Apellido</strong> es obligatorio.');
    else if (body.apellido.length < 2) errores.push('El <strong>Apellido</strong> debe tener al menos 2 caracteres.');
    else if (/[0-9]/.test(body.apellido)) errores.push('El <strong>Apellido</strong> no puede contener números.');

    if (!body.email) errores.push('El campo <strong>Correo Electrónico</strong> es obligatorio.');

    if (!body.tipoDocumento) errores.push('Debes seleccionar un <strong>Tipo de Documento</strong>.');

    if (!body.numeroDocumento) errores.push('El campo <strong>Número de Documento</strong> es obligatorio.');
    else if (!/^\d+$/.test(body.numeroDocumento)) errores.push('El <strong>Número de Documento</strong> debe contener solo números.');

    if (!body.pais) errores.push('El campo <strong>País</strong> es obligatorio.');

    if (body.telefono && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(body.telefono)) errores.push('El <strong>Teléfono</strong> no puede contener letras.');

    if (errores.length) {
      showConfError(errores.join('<br>'));
      return;
    }

    const res = await AuthAPI.actualizarPerfil(body);
    if (res.ok) {
      toast('Perfil actualizado correctamente', 'ok');
      const currentUser = Auth.getUser();
      const updatedUser = { ...currentUser, ...res.usuario };
      Auth.save(Auth.getToken(), updatedUser);
      document.getElementById('cli-username').textContent = updatedUser.nombre;
      
      if (updatedUser.DocumentoModificado) {
        document.getElementById('conf-tipodoc').disabled = true;
        document.getElementById('conf-numdoc').disabled = true;
      }
    }
  } catch (error) {
    showConfError(error.message);
  } finally {
    btn.textContent = txt;
    btn.disabled = false;
  }
}

function abrirConfirmacionDesactivar() {
  openM('m-desactivar');
}

async function doDesactivarCuenta() {
  try {
    const res = await AuthAPI.desactivar();
    if (res.ok) {
      toast('Cuenta desactivada. Redirigiendo...', 'ok');
      closeM('m-desactivar');
      setTimeout(() => { Auth.clear(); window.location.replace('landing.html'); }, 1500);
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

function abrirConfirmacionEliminar() {
  openM('m-eliminar');
}

async function doEliminarCuenta() {
  try {
    const res = await AuthAPI.eliminar();
    if (res.ok) {
      toast('Cuenta eliminada.', 'ok');
      closeM('m-eliminar');
      setTimeout(() => { Auth.clear(); window.location.replace('landing.html'); }, 1500);
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ════════ INIT ════════ */
async function initClientePage() {
  const user = Auth.getUser();
  if (!user || !user.id) { window.location.replace('landing.html'); return; }

  CLIENTE_UI.usuarioId  = user.id;
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
  const sections = { 
    reservar: 'section-reservar', 
    'mis-reservas': 'section-mis-reservas', 
    historial: 'section-historial',
    disponibilidad: 'section-disponibilidad',
    configuracion: 'section-configuracion'
  };
  Object.entries(sections).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === panel ? 'block' : 'none';
  });
  const habitEl = document.getElementById('section-habitaciones');
  if (habitEl) habitEl.style.display = 'none';

  // Actualizar botones de navegación
  const navBtns = {
    reservar: 'btn-nav-reservar',
    'mis-reservas': 'btn-nav-reservas',
    historial: 'btn-nav-historial',
    configuracion: 'btn-nav-configuracion'
  };
  Object.values(navBtns).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.remove('btn-fire');
      btn.classList.add('btn-dark-outline');
    }
  });
  if (navBtns[panel]) {
    const activeBtn = document.getElementById(navBtns[panel]);
    if (activeBtn) {
      activeBtn.classList.remove('btn-dark-outline');
      activeBtn.classList.add('btn-fire');
    }
  }

  if (panel === 'mis-reservas')   loadMisReservas();
  if (panel === 'historial')      loadHistorial();
  if (panel === 'disponibilidad') loadDisponibilidad();
  if (panel === 'configuracion')  cargarDatosConfiguracion();
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
  const c = CABANAS[key];
  if (!c) return;
  if (reservar) reservar.style.display='none';
  if (habitEl)  habitEl.style.display='block';
  
  const numHab = c.numeroHabitaciones || 1;
  const capMax = c.capacidad || 2;
  const desc = c.descripcion || '';
  const label = c.label || '';
  const precio = c.precio || 0;
  const ubicacion = c.ubicacion || null;

  let fotosHtml = '';
  
  let imgExt = c.imagenCabana || null;
  let imgInt = c.imagenHabitacion || null;
  let arrExt = [];
  let arrInt = [];
  
  try { arrExt = imgExt && imgExt.startsWith('[') ? JSON.parse(imgExt) : (imgExt ? [imgExt] : []); } catch(e) { arrExt = imgExt ? [imgExt] : []; }
  try { arrInt = imgInt && imgInt.startsWith('[') ? JSON.parse(imgInt) : (imgInt ? [imgInt] : []); } catch(e) { arrInt = imgInt ? [imgInt] : []; }

  imgExt = arrExt[0] || 'assets/images/cabana-roble.jpg';
  imgInt = arrInt[0] || 'assets/images/cabana-roble.jpg';

  if (c.imagenCabana && c.imagenHabitacion) {
      fotosHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0;">
          <img src="${imgExt}" alt="${label} Exterior" onerror="this.src='assets/images/cabana-roble.jpg'" style="border-radius: var(--r-xl) 0 0 0; cursor:pointer;" onclick="verImagenCompleta('${imgExt}')">
          <img src="${imgInt}" alt="${label} Interior" onerror="this.src='assets/images/cabana-roble.jpg'" style="border-radius: 0 var(--r-xl) 0 0; cursor:pointer;" onclick="verImagenCompleta('${imgInt}')">
      </div>`;
  } else {
      const singleImg = arrExt[0] || c.imagen || 'assets/images/cabana-roble.jpg';
      fotosHtml = `<img src="${singleImg}" alt="${label}" onerror="this.src='assets/images/cabana-roble.jpg'" style="cursor:pointer;" onclick="verImagenCompleta('${singleImg}')">`;
  }

  let metaHtml = `
    <span>👥 Máx. ${capMax} personas</span>
    <span>🛏 ${numHab} ${numHab === 1 ? 'habitación' : 'habitaciones'}</span>
  `;

  if (gallery) gallery.innerHTML=`
    <div class="room-card">
      ${fotosHtml}
      <div class="room-card-body">
        <div class="room-title"><h3>${label}</h3><small>Detalles de la cabaña</small></div>
        <p style="color:rgba(255,255,255,0.9);">${desc}</p>
        <div class="room-price">${fCop(precio)}<small>/día</small></div>
        ${ubicacion ? `<div class="room-meta" style="margin-bottom:0.75rem;font-size:0.8rem;color:var(--dark-muted);">📍 ${ubicacion}</div>` : ''}
        <div class="room-meta">${metaHtml}</div>
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
    const isSelected = CLIENTE_UI.servicios.has(key);
    btn.classList.toggle('selected', isSelected);
    btn.classList.toggle('disabled', btn.disabled);
    const counterDiv = document.getElementById(`srv-counter-${key}`);
    if (counterDiv) {
      counterDiv.style.display = isSelected ? 'flex' : 'none';
      if (isSelected) {
        document.getElementById(`srv-count-${key}`).textContent = CLIENTE_UI.servicios.get(key);
      }
    }
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

function selectCabana(key) { 
  CLIENTE_UI.cabana=key; 
  highlightSelection(); 
  updateResumen(); 
  const prompt = document.getElementById('cli-cab-prompt');
  if (prompt) {
    prompt.innerHTML = prompt.innerHTML.replace(' <span style="color:var(--danger);">(Es obligatorio seleccionar una cabaña)</span>', '');
  }
}
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
  
  const srvsIds = getPackageIncludedServices(packageId);
  let imgsHtmlArr = [];
  let srvsTags = srvsIds
    .map(id => SERVICIOS[id])
    .filter(Boolean)
    .map(s => {
       if (s.imagen) {
           imgsHtmlArr.push(`<div><strong style="display:block;margin-bottom:0.75rem;color: #fff;font-size:1.1rem;">${s.label}</strong><div style="border-radius:12px;overflow:hidden;box-shadow:var(--sh-sm);"><img src="${s.imagen}" style="width:100%;height:180px;object-fit:cover;transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"/></div></div>`);
       }
       return `<li style="margin-bottom:0.6rem;display:flex;align-items:center;font-size:1.1rem;color: #fff;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--fire)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:0.6rem;"><path d="M20 6L9 17l-5-5"/></svg> <strong>${s.label}</strong></li>`;
    })
    .join('');
    
  let fotosHtml = imgsHtmlArr.length > 0 ? `<div><strong style="display:block;margin-bottom:1rem;color: #fff;font-size:1.2rem;border-bottom: 1px solid var(--dark-border);padding-bottom:0.5rem;">Fotos de Servicios Incluidos</strong><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:1.5rem;">${imgsHtmlArr.join('')}</div></div>` : '';
  
  const modal = document.getElementById('m-paquete-detalle');
  if (!modal) return;
  
  const body = modal.querySelector('.modal-body');
  if (body) {
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem; color: #fff;">
        ${fotosHtml}
        <div>
          <h4 style="color: #fff;margin-bottom:0.75rem;font-size:1.8rem;">${pkg.label}</h4>
          <p style="color:rgba(255,255,255,0.9);line-height:1.7;font-size:1.1rem;margin:0;">${pkg.descripcion||''}</p>
        </div>
        
        <div style="background:linear-gradient(135deg, rgba(232, 93, 4, 0.1), rgba(192, 57, 43, 0.05)); padding:1.5rem; border-radius:16px; border:1px solid rgba(232,93,4,0.3); display:flex; flex-direction:column; align-items:center; gap:0.5rem; box-shadow: var(--sh-sm);">
          <span style="font-size:0.85rem; color: #fff; text-transform:uppercase; letter-spacing:0.1em; font-weight: 700;">Precio del paquete</span>
          <span style="font-size:2.4rem; font-weight:800; color:var(--fire); font-family:var(--font-display); text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${pkg.precio>0 ? '+'+fCop(pkg.precio) : 'Incluido en cabaña'}</span>
        </div>
        
        ${srvsIds.length ? `
          <div>
            <h5 style="color: #fff;margin-bottom:1rem;font-size:1.2rem;border-bottom: 1px solid var(--dark-border);padding-bottom:0.5rem;">Servicios incluidos</h5>
            <ul style="list-style:none;padding:0;margin:0;">
              ${srvsTags || '<li style="color:var(--dark-muted);font-size:1.1rem;">Ninguno</li>'}
            </ul>
          </div>
        ` : '<p style="color:var(--dark-muted);font-style:italic;font-size:1.1rem;">Sin servicios incluidos</p>'}
      </div>
    `;
  }
  
  openM('m-paquete-detalle');
}

function selectCabana(key) {
  if (CLIENTE_UI.cabana === key) {
    CLIENTE_UI.cabana = null;
    CLIENTE_UI.paquete = null;
    CLIENTE_UI.servicios.clear();
  } else {
    CLIENTE_UI.cabana = key;
    CLIENTE_UI.personas = CABANAS[key]?.capacidad || 2;
  }
  
  const secPaq = document.getElementById('sec-paquete');
  const secSrv = document.getElementById('sec-servicio');
  
  if (CLIENTE_UI.cabana) {
    if (secPaq) secPaq.style.display = 'block';
    if (secSrv) secSrv.style.display = 'block';
  } else {
    if (secPaq) secPaq.style.display = 'none';
    if (secSrv) secSrv.style.display = 'none';
  }

  // Re-renderizar paquetes con el nuevo precio total según la capacidad de la cabaña
  if (typeof rerenderPaquetes === 'function') rerenderPaquetes();
  
  highlightSelection();
  updateServiceAvailability();
  updateResumen();
}

function toggleSrv(key, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return; // Ignore if clicked on counter buttons
  const included = getPackageIncludedServices(CLIENTE_UI.paquete);
  if (included.includes(String(key))) {
    if (typeof toast === 'function') toast('Este servicio ya está incluido en el paquete seleccionado','warn');
    return;
  }
  if (CLIENTE_UI.servicios.has(key)) {
    CLIENTE_UI.servicios.delete(key);
  } else {
    CLIENTE_UI.servicios.set(key, CLIENTE_UI.personas || 1); // Default to cabin capacity or 1
  }
  highlightSelection();
  updateResumen();
}

window.adjustSrvCount = function(key, dir) {
  if (!CLIENTE_UI.servicios.has(key)) return;
  let count = CLIENTE_UI.servicios.get(key);
  count += dir;
  const maxCap = Math.max(...Object.values(CABANAS).map(c => c.capacidad || 0), 1);
  if (count < 1) count = 1;
  if (count > maxCap) count = maxCap;
  CLIENTE_UI.servicios.set(key, count);
  highlightSelection();
  updateResumen();
};

/* ════════ FORMULARIO ════════ */
function onForm() {
  document.getElementById('form-alert').innerHTML='';
  const ini=document.getElementById('f-ini').value, fin=document.getElementById('f-fin').value;
  CLIENTE_UI.fechaFin=fin;
  CLIENTE_UI.fechaInicio=ini;
  CLIENTE_UI.personas=CLIENTE_UI.cabana ? (CABANAS[CLIENTE_UI.cabana]?.capacidad||2) : 2;
  CLIENTE_UI.notas=document.getElementById('f-notas')?.value||'';
  updateResumen();
  filterAvailableCabanas();
}

async function filterAvailableCabanas() {
  const ini = CLIENTE_UI.fechaInicio, fin = CLIENTE_UI.fechaFin;
  const grid = document.getElementById('cli-cabana-grid');
  const prompt = document.getElementById('cli-cab-prompt');
  
  if (!ini || !fin) {
    if (grid) grid.style.display = 'none';
    if (prompt) prompt.textContent = '(Selecciona fechas primero)';
    CLIENTE_UI.cabana = null;
    highlightSelection(); updateResumen();
    return;
  }
  
  try {
    const d = await ReservasAPI.disponibilidad();
    const registros = d.data?.registros || d.registros || [];
    
    const fIni = new Date(ini); fIni.setHours(0,0,0,0);
    const fFin = new Date(fin); fFin.setHours(0,0,0,0);
    
    // Find occupied cabins
    const occupied = new Set();
    registros.forEach(r => {
      if (r.estado === 'cancelada' || r.estado === 'completada') return;
      const rIni = new Date(r.fecha_inicio || r.FechaInicio); rIni.setHours(0,0,0,0);
      const rFin = new Date(r.fecha_fin || r.FechaFinalizacion); rFin.setHours(0,0,0,0);
      
      // overlap: checkout day allows checkin. rIni < fFin && rFin > fIni
      if (rIni < fFin && rFin > fIni) {
        occupied.add(String(r.cabana));
      }
    });
    
    let availableCount = 0;
    Object.keys(CABANAS).forEach(cabId => {
      const el = document.getElementById(`cab-${cabId}`);
      if (el) {
        if (occupied.has(cabId)) {
          el.style.display = 'none';
          if (CLIENTE_UI.cabana === cabId) CLIENTE_UI.cabana = null; // deselect if occupied
        } else {
          el.style.display = 'block';
          availableCount++;
        }
      }
    });
    
    if (grid) grid.style.display = 'grid';
    if (prompt) {
      if (availableCount === 0) {
        prompt.innerHTML = `<span style="color:var(--danger);font-weight:600;">(No hay cabañas disponibles para esas fechas)</span>`;
      } else if (!CLIENTE_UI.cabana) {
        prompt.innerHTML = `<span style="color:var(--success);font-weight:600;">(${availableCount} disponibles)</span> <span style="color:var(--danger);">(Es obligatorio seleccionar una cabaña)</span>`;
      } else {
        prompt.innerHTML = `<span style="color:var(--success);font-weight:600;">(${availableCount} disponibles)</span>`;
      }
    }
    
    highlightSelection(); updateResumen();
  } catch(e) { console.error('Error filtering cabanas', e); }
}

function updateResumen() {
  const btn=document.getElementById('btn-continuar-pago');
  const totalRow=document.getElementById('price-total-row');
  const body=document.getElementById('price-body');
  const noches=nights(CLIENTE_UI.fechaInicio,CLIENTE_UI.fechaFin);
  const cab=CLIENTE_UI.cabana ? CABANAS[CLIENTE_UI.cabana] : null;
  const paquete=CLIENTE_UI.paquete ? PAQUETES[CLIENTE_UI.paquete] : { label: 'Ninguno', precio: 0, descripcion: 'Sin paquete adicional' };
  const srvs=Array.from(CLIENTE_UI.servicios.keys()).map(k=>{ const s = SERVICIOS[k]; return s ? {...s, id:k, cantidad:CLIENTE_UI.servicios.get(k)} : null }).filter(Boolean);
  const srvP=srvs.reduce((acc,s)=>acc+(s.precio||0)*s.cantidad,0);
  const paqPrecioTotal = (paquete.precio || 0) * CLIENTE_UI.personas;
  const rawSub = ((cab ? cab.precio : 0) + paqPrecioTotal) * Math.max(noches,1) + srvP;
  /* FIX 3 */
  const {subtotal,iva,total} = calcMontos(rawSub);

  if (!CLIENTE_UI.fechaInicio||!CLIENTE_UI.fechaFin||noches<=0 || !cab) {
    body.innerHTML='<div class="price-empty"><p>' + (!CLIENTE_UI.fechaInicio||!CLIENTE_UI.fechaFin||noches<=0 ? 'Selecciona fechas válidas para calcular el precio.' : 'Selecciona una cabaña para continuar.') + '</p></div>';
    if(totalRow) totalRow.style.display='none';
    if(btn)      btn.disabled=true;
    return;
  }

  body.innerHTML=`
    <div class="price-row"><span class="pk">Cabaña</span><span class="pv">${cab.label} × ${noches} ${noches === 1 ? 'noche' : 'noches'}</span></div>
    <div class="price-row"><span class="pk">Precio cabaña</span><span class="pv">${fCop(cab.precio)} / noche</span></div>
    <div class="price-row" style="margin-bottom:1rem; border-bottom:1px dashed var(--sand-soft); padding-bottom:0.5rem;"><span class="pk" style="font-weight:600;">Total cabaña</span><span class="pv" style="font-weight:600;">${fCop(cab.precio * noches)}</span></div>
    <div class="price-row"><span class="pk">Paquete</span><span class="pv">${paquete.label}</span></div>
    <div class="price-row"><span class="pk">Precio paquete</span><span class="pv">${paquete.precio?`+${fCop(paqPrecioTotal)} (x${CLIENTE_UI.personas} pers)`:'Incluido'}</span></div>
    ${srvs.map(s=>`<div class="price-row"><span class="pk">${s.label}</span><span class="pv">+${fCop(s.precio * s.cantidad)} (${s.cantidad} pers)</span></div>`).join('')}
    ${srvs.length > 0 ? `<div class="price-row" style="margin-bottom:1rem; border-bottom:1px dashed var(--sand-soft); padding-bottom:0.5rem;"><span class="pk" style="font-weight:600;">Total servicios</span><span class="pv" style="font-weight:600;">${fCop(srvP)}</span></div>` : ''}`;

  const ptEl=document.getElementById('pt-val'); if(ptEl) ptEl.textContent=fCop(total);
  if(totalRow) totalRow.style.display='flex';
  if(btn)      btn.disabled=false;
}

/* ════════ MÉTODOS DE PAGO ════════ */
let currentPaymentMethod = 'stripe';

function setPaymentMethod(method) {
  currentPaymentMethod = method;
  
  // Update buttons styling
  document.getElementById('tab-stripe')?.classList.remove('btn-fire');
  document.getElementById('tab-stripe')?.classList.add('btn-outline');
  document.getElementById('tab-transferencia')?.classList.remove('btn-fire');
  document.getElementById('tab-transferencia')?.classList.add('btn-outline');
  
  const activeBtn = document.getElementById(`tab-${method}`);
  if (activeBtn) {
    activeBtn.classList.remove('btn-outline');
    activeBtn.classList.add('btn-fire');
  }

  // Update panels
  const pfStripe = document.getElementById('pf-stripe');
  const pfTransferencia = document.getElementById('pf-transferencia');
  
  if (pfStripe) pfStripe.style.display = 'none';
  if (pfTransferencia) pfTransferencia.style.display = 'none';
  
  const activePanel = document.getElementById(`pf-${method}`);
  if (activePanel) activePanel.style.display = 'flex';
}

function valPayment() {
}

/* ════════ CONFIRMAR RESERVA ════════ */
async function confirmarReserva() {
  const btn=document.getElementById('btn-continuar-pago');
  if (btn?.disabled) return;
  const fIni=document.getElementById('f-ini'), fFin=document.getElementById('f-fin');
  const errores=[];
  if (!fIni.value.trim()) errores.push('Fecha llegada: campo necesario');
  if (!fFin.value.trim()) errores.push('Fecha salida: campo necesario');
  
  let comprobante = 'PAGO-EN-HOTEL';

  if (errores.length) {
    const alertEl = document.getElementById('form-alert');
    alertEl.innerHTML=`<div style="background:#fee;color:#c33;padding:0.75rem;border-radius:4px;margin-bottom:1rem;font-size:0.9rem;">${errores.join('<br>')}</div>`;
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  document.getElementById('form-alert').innerHTML='';

  const noches  = nights(fIni.value, fFin.value);
  const cab     = CLIENTE_UI.cabana ? CABANAS[CLIENTE_UI.cabana] : null;
  const paq     = CLIENTE_UI.paquete ? PAQUETES[CLIENTE_UI.paquete] : { precio: 0 };
  const srvArr  = Array.from(CLIENTE_UI.servicios.entries()).map(([id, cantidad]) => ({ id, cantidad }));
  const srvP    = srvArr.reduce((acc,s)=>acc+(SERVICIOS[s.id]?.precio||0)*s.cantidad,0);
  const paqPrecioTotal = (paq.precio || 0) * CLIENTE_UI.personas;
  const rawSub  = ((cab ? cab.precio : 0) + paqPrecioTotal)*Math.max(noches,1)+srvP;
  /* FIX 3 */
  const {subtotal,iva,total}=calcMontos(rawSub);

  try {
    setLoading(btn,true,'Guardando reserva...');
    /* FIX 1: usar documento numérico del usuario, no su email */
    const res = await ReservasAPI.crear({
      NroDocumentoCliente: CLIENTE_UI.usuarioDoc,
      FechaInicio:         fIni.value,
      FechaFinalizacion:   fFin.value,
      SubTotal:            subtotal,
      Descuento:           0,
      IVA:                 iva,
      MontoTotal:          total,
      MetodoPago:          currentPaymentMethod,
      monto_pagado:        0, // En Stripe, inicia en 0 hasta que pague
      comprobante_pago:    comprobante,
      num_personas:        cab.capacidad,
      cabana:              CLIENTE_UI.cabana,
      paquete:             CLIENTE_UI.paquete,
      servicios:           srvArr,
      notas:               document.getElementById('f-notas').value,
    });
    
    const idReserva = res.data?.id || res.id;
    if (!idReserva) {
      throw new Error('No se obtuvo el ID de la reserva');
    }

    setLoading(btn,true,'Redirigiendo a Stripe...');
    const token = typeof Auth !== 'undefined' ? Auth.getToken() : localStorage.getItem('kafe_token');
    const stripeRes = await fetch('/api/pagos/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idReserva })
    });
    const stripeData = await stripeRes.json();
    if (stripeData.ok && stripeData.url) {
      window.location.href = stripeData.url;
      return; // Stop execution here since we redirect
    } else {
      throw new Error(stripeData.mensaje || 'Error al conectar con la pasarela de pagos');
    }
  } catch(err) {
    toast(err.message||'Error al crear reserva','err');
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
    const activas = reservas.filter(r => (r.estado||r.Estado) !== 'cancelada' && (r.estado||r.Estado) !== 'completada');
    if (!activas.length) { c.innerHTML='<div class="price-empty"><p>No tienes reservas activas.</p></div>'; return; }
    c.innerHTML=activas.map(r=>`
      <div class="res-item">
        <div class="res-info">
          <h4>${fDate(r.fecha_inicio||r.FechaInicio)} → ${fDate(r.fecha_fin||r.FechaFinalizacion)} ${statusBadge(r.estado||'pendiente')}</h4>
          <p>${r.num_personas||1} personas · ${CABANAS[r.cabana]?.label||r.cabana||''} · ${PAQUETES[r.paquete]?.label||r.paquete||''}</p>
        </div>
        <div class="res-actions">
          <button class="btn btn-outline btn-sm" onclick="viewReserva(${r.id})">Ver</button>
          <button class="btn btn-fire btn-sm" onclick="abrirAddServicios(${r.id})">Añadir Extras</button>
          <button class="btn btn-danger btn-sm" onclick="cancelReserva(${r.id})">Cancelar</button>
        </div>
      </div>`).join('');
  } catch { c.innerHTML='<div class="price-empty"><p>Error cargando reservas.</p></div>'; }
}

/* ════════ HISTORIAL DE RESERVAS ════════ */
async function loadHistorial() {
  const c=document.getElementById('historial-list');
  c.innerHTML='<div class="price-empty"><p>Cargando historial…</p></div>';
  try {
    const data=await ReservasAPI.misReservas();
    const reservas=data.data||data.reservas||[];
    const pasadas = reservas.filter(r => (r.estado||r.Estado) === 'cancelada' || (r.estado||r.Estado) === 'completada');
    if (!pasadas.length) { c.innerHTML='<div class="price-empty"><p>No tienes reservas anteriores en tu historial.</p></div>'; return; }
    c.innerHTML=pasadas.map(r=>{
      const estado = r.estado || r.Estado || 'pendiente';
      let motivoHtml = '';
      if (estado === 'cancelada') {
        if (r.motivo) {
          // motivo has format "Admin: razón" or "Cliente: razón"
          const parts = r.motivo.split(': ');
          const quien = parts[0] || '';
          const razon = parts.slice(1).join(': ') || r.motivo;
          const iconoQuien = quien.toLowerCase().includes('admin') ? '🔧' : '👤';
          const quienLabel = quien.toLowerCase().includes('admin') ? 'Administrador' : (quien || 'Cliente');
          motivoHtml = `
            <div style="margin-top:0.75rem; background:rgba(220,53,69,0.12); border:1px solid rgba(220,53,69,0.35); border-left: 4px solid #dc3545; border-radius:8px; padding:0.65rem 0.9rem; display:flex; align-items:flex-start; gap:0.6rem;">
              <span style="font-size:1.1rem; margin-top:0.05rem;">❌</span>
              <div>
                <div style="font-size:0.82rem; font-weight:700; color:#ff6b7a; margin-bottom:0.2rem;">${iconoQuien} Cancelada por ${quienLabel}</div>
                <div style="font-size:0.85rem; color:var(--dark-muted); line-height:1.4;">${razon}</div>
              </div>
            </div>`;
        } else {
          motivoHtml = `
            <div style="margin-top:0.75rem; background:rgba(220,53,69,0.08); border:1px solid rgba(220,53,69,0.25); border-left: 4px solid #dc3545; border-radius:8px; padding:0.55rem 0.9rem; display:flex; align-items:center; gap:0.6rem;">
              <span>❌</span>
              <span style="font-size:0.83rem; color:var(--dark-muted); font-style:italic;">Sin motivo registrado</span>
            </div>`;
        }
      }
      return `
      <div class="res-item" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
          <div class="res-info" style="flex:1;">
            <h4>${fDate(r.fecha_inicio||r.FechaInicio)} → ${fDate(r.fecha_fin||r.FechaFinalizacion)} ${statusBadge(estado)}</h4>
            <p>${r.num_personas||1} personas · ${CABANAS[r.cabana]?.label||r.cabana||''} · ${PAQUETES[r.paquete]?.label||r.paquete||''}</p>
          </div>
          <div class="res-actions" style="flex-shrink:0;">
            <button class="btn btn-outline btn-sm" onclick="viewReserva(${r.id})">Ver</button>
          </div>
        </div>
        ${motivoHtml}
      </div>`;
    }).join('');
  } catch { c.innerHTML='<div class="price-empty"><p>Error cargando historial.</p></div>'; }
}

function cancelReserva(id) {
  document.getElementById('m-cancel-id').textContent='';
  document.getElementById('m-cancel-motivo').value = '';
  window._cancelReservaId=id;
  openM('m-cancel');
}
async function doCancelReserva() {
  const id=window._cancelReservaId; if(!id) return;
  const motivo = document.getElementById('m-cancel-motivo').value.trim();
  if (!motivo) {
    toast('Por favor, ingresa el motivo de la cancelación.', 'err');
    return;
  }
  try {
    await ReservasAPI.eliminar(id, motivo);
    toast('Reserva cancelada correctamente','ok'); closeM('m-cancel'); loadMisReservas();
  } catch(err) { toast(err.message||'No se pudo cancelar','err'); }
}

/* ════════ VER RESERVA ════════ */
window.viewReserva = async function(id) {
  try {
    const data=await ReservasAPI.una(id); const reserva=data.data||data;
    const ini=new Date(reserva.fecha_inicio||reserva.FechaInicio);
    const fin=new Date(reserva.fecha_fin||reserva.FechaFinalizacion);
    const noches=Math.ceil((fin-ini)/(1000*60*60*24));
    let servicios=[];
    if (reserva.servicios) {
      servicios=typeof reserva.servicios==='string' ? JSON.parse(reserva.servicios) : (Array.isArray(reserva.servicios)?reserva.servicios:[]);
    }
    let paquetesExtra = [];
    if (reserva.paquetes_extra) {
      paquetesExtra = typeof reserva.paquetes_extra === 'string' ? JSON.parse(reserva.paquetes_extra) : (Array.isArray(reserva.paquetes_extra) ? reserva.paquetes_extra : []);
    }
    const cabanaObj=CABANAS[reserva.cabana];
    const cabanaLabel=cabanaObj?.label||reserva.cabana||'—';
    const cabanaDesc=cabanaObj?.descripcion||'';
    const paqueteObj=PAQUETES[reserva.paquete];
    const paqueteLabel=paqueteObj?.label||reserva.paquete||'—';
    const paqueteDesc=paqueteObj?.descripcion||'';

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
    const fechaCreacion = (reserva.fecha_reserva||reserva.FechaReserva)
      ? new Date(reserva.fecha_reserva||reserva.FechaReserva).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
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
      // Build included services with images
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
    document.getElementById('m-detalle-body').innerHTML=`
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
let _lastSrvsHash = '';
async function refreshGlobalServices() {
  try {
    const data = await req('/servicios');
    const srvs = data.servicios || data.data || [];
    const hash = JSON.stringify(srvs);
    if (_lastSrvsHash === hash) return;
    _lastSrvsHash = hash;
    
    window.globalServiciosList = srvs; // Save globally for details modal
    for (const key in SERVICIOS) delete SERVICIOS[key];
    
    let html = '';
    srvs.forEach(s => {
      SERVICIOS[s.IDServicio] = { label: s.NombreServicio, precio: s.Costo, imagen: s.Imagen };
      if (!s.Estado && s.Estado !== 1) return; // Only show active services
      html += `
        <button type="button" class="srv-chip" id="srv-${s.IDServicio}" onclick="toggleSrv('${s.IDServicio}', event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          <span style="font-size:1.1rem; text-align:center;">${s.NombreServicio}</span>
          <span class="srv-price">+${fCop(s.Costo)} / pers</span>
          <div id="srv-counter-${s.IDServicio}" style="display:none; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(255,255,255,0.2); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold;" onclick="adjustSrvCount('${s.IDServicio}', -1)">-</span>
            <span id="srv-count-${s.IDServicio}" style="font-weight:bold;">1</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(255,255,255,0.2); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold;" onclick="adjustSrvCount('${s.IDServicio}', 1)">+</span>
          </div>
          <span class="srv-ver btn btn-sm btn-dark-outline" style="margin-top:0.5rem; padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="event.stopPropagation(); openServicioDetails('${s.IDServicio}')">Ver detalles</span>
        </button>`;
    });

    const srvGrid = document.querySelector('#section-reservar .srv-grid');
    if (srvGrid) srvGrid.innerHTML = html;
    if (typeof updateServiceAvailability === 'function') updateServiceAvailability();
    if (typeof highlightSelection === 'function') highlightSelection();
  } catch(e) { console.error('Error refreshing services', e); }
}

window.openServicioDetails = function(servicioId) {
  const srv = (window.globalServiciosList || []).find(s => String(s.IDServicio) === String(servicioId));
  if (!srv) return;
  
  const modal = document.getElementById('m-servicio-detalle');
  if (!modal) return;
  
  const title = modal.querySelector('#m-srv-det-titulo');
  if (title) title.textContent = srv.NombreServicio;
  
  const body = modal.querySelector('#m-srv-det-body');
  if (body) {
    const imgSrc = srv.Imagen || 'assets/images/cabana-roble.jpg';
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem; color: #fff; padding: 0.5rem;">
        <div style="width:100%; height:280px; border-radius:16px; overflow:hidden; border:1px solid var(--dark-border); background:#111; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
          <img src="${imgSrc}" alt="${srv.NombreServicio}" style="width:100%; height:100%; object-fit:cover; transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='assets/images/cabana-roble.jpg'"/>
        </div>
        <div style="background:linear-gradient(135deg, rgba(232, 93, 4, 0.1), rgba(192, 57, 43, 0.05)); padding:1.5rem; border-radius:16px; border:1px solid rgba(232,93,4,0.3); display:flex; flex-direction:column; align-items:center; gap:0.5rem; box-shadow: var(--sh-sm);">
          <span style="font-size:0.85rem; color: #fff; text-transform:uppercase; letter-spacing:0.1em; font-weight: 700;">Costo del Servicio</span>
          <span style="font-size:2.4rem; font-weight:800; color:var(--fire); font-family:var(--font-display); text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${fCop(srv.Costo)}</span>
        </div>
        <div style="padding: 0.5rem;">
          <strong style="display:block; margin-bottom:0.75rem; color: #fff; font-size:1.15rem; border-bottom: 1px solid var(--dark-border); padding-bottom: 0.5rem;">Descripción de la experiencia</strong>
          <p style="color:var(--dark-muted); line-height:1.7; font-size:1.05rem; margin:0;">
            ${srv.Descripcion || 'Disfruta de esta increíble experiencia y mejora tu estadía con nosotros.'}
          </p>
        </div>
      </div>
    `;
  }
  
  openM('m-servicio-detalle');
};

document.addEventListener('DOMContentLoaded', refreshGlobalServices);
refreshGlobalServices();


/* ════════ DYNAMIC PACKAGES IN RESERVATION ════════ */
let _lastPaqsHash = '';
async function refreshGlobalPackages() {
  try {
    const data = await req('/paquetes');
    const paqs = data.paquetes || data.data || [];
    const hash = JSON.stringify(paqs);
    if (_lastPaqsHash === hash) return;
    _lastPaqsHash = hash;
    
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

    if (typeof rerenderPaquetes === 'function') rerenderPaquetes();
    if (typeof updateServiceAvailability === 'function') updateServiceAvailability();
    if (typeof highlightSelection === 'function') highlightSelection();
    if (typeof updateResumen === 'function') updateResumen();
  } catch(e) { console.error('Error refreshing packages', e); }
}

/* Vuelve a renderizar la grilla de paquetes reflejando el precio total según
   la cabaña/personas actualmente seleccionadas. Se llama al seleccionar cabaña. */
function rerenderPaquetes() {
  const grid = document.querySelector('#section-reservar .paquete-grid');
  if (!grid) return;
  const personas = CLIENTE_UI.cabana ? (CABANAS[CLIENTE_UI.cabana]?.capacidad || 1) : null;
  let html = '';
  Object.entries(PAQUETES).forEach(([id, pkg]) => {
    const isSelected = CLIENTE_UI.paquete == id;
    const precioUnitario = pkg.precio || 0;
    let precioHtml;
    if (precioUnitario <= 0) {
      precioHtml = '<span style="color:var(--fire);font-weight:700;">Incluido</span>';
    } else if (personas) {
      const total = precioUnitario * personas;
      precioHtml = `<span style="color:var(--fire);font-weight:800;font-size:1.1rem;">${fCop(total)}</span>
                    <span style="color:rgba(255, 255, 255,0.6);font-size:0.78rem;"> total (${fCop(precioUnitario)}/pers. × ${personas})</span>`;
    } else {
      precioHtml = `<span style="color:var(--fire);font-weight:700;">${fCop(precioUnitario)}/persona</span>`;
    }
    html += `
      <div class="paq-opt ${isSelected?'selected':''}" id="p-${id}" onclick="selectPaquete('${id}')">
        <div class="paq-name">${pkg.label}</div>
        <div class="paq-price">${precioUnitario > 0 ? '+' : ''}${precioHtml}</div>
        <button type="button" class="btn btn-dark-outline btn-block" style="margin-top:1rem; padding:0.5rem;" onclick="event.stopPropagation();openPaqueteDetails('${id}')">Ver Descripción</button>
      </div>`;
  });
  grid.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', refreshGlobalPackages);
refreshGlobalPackages();


/* ════════ DYNAMIC CABANAS IN RESERVATION ════════ */
let _lastCabanasHash = '';
async function refreshGlobalCabanas() {
  try {
    const data = await req('/cabanas');
    const cabanas = data.data || [];
    const hash = JSON.stringify(cabanas);
    if (_lastCabanasHash === hash) return;
    _lastCabanasHash = hash;
    
    for (const key in CABANAS) delete CABANAS[key];
    
    let html = '';
    let firstCab = null;
    cabanas.forEach(c => {
      if (!c.Estado && c.Estado !== 1) return;
      if (!firstCab) firstCab = c.IDCabana;
      let firstImg = c.ImagenCabana || c.ImagenHabitacion || c.Foto || 'assets/images/cabana-roble.jpg';
      try {
         if (firstImg.startsWith('[')) firstImg = JSON.parse(firstImg)[0];
      } catch(e) {}
      const imgSrc = firstImg;
      CABANAS[c.IDCabana] = { 
        label: c.Nombre, 
        precio: c.Costo, 
        descripcion: c.Descripcion, 
        capacidad: c.CapacidadMaxima, 
        ubicacion: c.Ubicacion, 
        imagen: imgSrc,
        imagenCabana: c.ImagenCabana,
        imagenHabitacion: c.ImagenHabitacion,
        numeroHabitaciones: c.NumeroHabitaciones || 1
      };
    });
    
    if (!CLIENTE_UI.cabana && firstCab && document.getElementById('cli-cabana-grid')?.style.display !== 'none') {
      // CLIENTE_UI.cabana = firstCab;
    }

    cabanas.forEach((c) => {
      if (!CABANAS[c.IDCabana]) return;
      const isSelected = CLIENTE_UI.cabana == c.IDCabana;
      const imgSrc = CABANAS[c.IDCabana].imagen;
      
      html += `
        <div class="cabana-opt ${isSelected?'selected':''}" id="cab-${c.IDCabana}" style="display:flex;flex-direction:column;">
          <div onclick="selectCabana('${c.IDCabana}')" style="flex:1;display:flex;flex-direction:column;">
            <div class="cabana-img">
              <img src="${imgSrc}" alt="${c.Nombre}" onerror="this.src='assets/images/cabana-roble.jpg'">
            </div>
            <div class="cabana-info" style="flex:1;display:flex;flex-direction:column;">
              <div class="cabana-title-row"><h4>${c.Nombre}</h4><span class="cabana-price-inline">${fCop(c.Costo)}</span></div>
              <div style="font-size:0.72rem;color:var(--mist);margin-top:0.2rem;">Hasta ${c.CapacidadMaxima} pers.</div>
              ${c.Ubicacion ? `<div style="font-size:0.72rem;color:var(--mist);margin-top:0.2rem;">📍 ${c.Ubicacion}</div>` : ''}
              <div style="margin-top:auto; padding-top:1rem;">
                <button type="button" class="btn btn-dark-outline btn-block" style="padding:0.4rem;font-size:0.85rem;" onclick="event.stopPropagation(); openCabanaDetails('${c.IDCabana}')">Ver Detalles</button>
              </div>
            </div>
          </div>
        </div>`;
    });

    const grid = document.getElementById('cab-roble')?.parentNode || document.querySelector('#section-reservar .cabana-grid');
    if (grid) grid.innerHTML = html;
    
    if (typeof updateResumen === 'function') updateResumen();
  } catch(e) { console.error('Error refreshing cabanas', e); }
}

document.addEventListener('DOMContentLoaded', refreshGlobalCabanas);
refreshGlobalCabanas();

setInterval(() => {
  refreshGlobalServices();
  refreshGlobalPackages();
  refreshGlobalCabanas();
}, 5000);

// ════════ IMAGE ZOOM VIEWER ════════
window.verImagenCompleta = function(src) {
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

  overlay.onclick = function() {
    overlay.remove();
  };
};

/* ════════ AÑADIR SERVICIOS (CLIENTE) ════════ */
let _addReservaId = null;
let _addReservaData = null;
let _addReservaSrvs = new Map();
let _addReservaSrvsOriginales = new Map();
let _addReservaPaquetesExtraOriginales = new Set();

async function abrirAddServicios(id) {
  _addReservaId = id;
  const alertEl = document.getElementById('m-add-srv-alert');
  if (alertEl) alertEl.innerHTML = '';
  document.getElementById('m-add-srv-id').textContent = id;
  
  try {
    const res = await ReservasAPI.misReservas(); // Or a specific API call if needed, but misReservas gives everything.
    const reservas = res.data || res.reservas || [];
    _addReservaData = reservas.find(r => r.id === id || String(r.IdReserva) === String(id));
    if (!_addReservaData) { toast('Reserva no encontrada', 'err'); return; }
    
    // Parse original services
    let srvsArr = _addReservaData.servicios;
    if (typeof srvsArr === 'string') { try { srvsArr = JSON.parse(srvsArr); } catch(e){ srvsArr=[]; } }
    if (!Array.isArray(srvsArr)) srvsArr = [];
    
    _addReservaSrvsOriginales = new Map(srvsArr.map(s => [String(s.id || s), s.cantidad || 1]));
    _addReservaSrvs = new Map(_addReservaSrvsOriginales);

    // Parse original extra packages
    let paqExtArr = _addReservaData.paquetes_extra;
    if (typeof paqExtArr === 'string') { try { paqExtArr = JSON.parse(paqExtArr); } catch(e){ paqExtArr=[]; } }
    if (!Array.isArray(paqExtArr)) paqExtArr = [];
    _addReservaPaquetesExtraOriginales = new Set(paqExtArr.map(String));

    // Populate Paquete Extra dropdown
    const selPaqExtra = document.getElementById('m-add-srv-paquete-extra');
    if (selPaqExtra) {
      selPaqExtra.innerHTML = '<option value="">Ninguno</option>';
      Object.keys(PAQUETES).forEach(k => {
        const p = PAQUETES[k];
        if (k !== _addReservaData.paquete && !_addReservaPaquetesExtraOriginales.has(String(k))) {
          selPaqExtra.innerHTML += `<option value="${k}">${p.label} (+${fCop(p.precio)} / pers)</option>`;
        }
      });
      selPaqExtra.value = '';
    }

    renderClientAddSrvs();
    evaluarClientAddServicios();
    openM('m-add-servicios');
  } catch(e) {
    toast(e.message, 'err');
  }
}

function renderClientAddSrvs() {
  const grid = document.getElementById('m-add-srv-grid');
  if (!grid) return;

  const paq = _addReservaData.paquete ? PAQUETES[_addReservaData.paquete] : null;
  let includedIds = [];
  if (paq && paq.serviciosIncluidos) {
    try { includedIds = Array.isArray(paq.serviciosIncluidos) ? paq.serviciosIncluidos : JSON.parse(paq.serviciosIncluidos); } catch (e) { }
  }

  let html = '';
  Object.keys(SERVICIOS).forEach(id => {
    const s = SERVICIOS[id];
    const strId = String(id);
    const isIncluded = includedIds.some(incId => String(incId) === strId);
    const isOriginal = _addReservaSrvsOriginales.has(strId);
    const originalCant = _addReservaSrvsOriginales.get(strId) || 0;
    const currentCant = _addReservaSrvs.get(strId) || 0;

    if (isIncluded && _addReservaSrvs.has(strId)) {
      _addReservaSrvs.delete(strId);
    }

    if (isIncluded) {
      const cant = isOriginal ? originalCant : 1;
      html += `
        <button type="button" class="srv-chip disabled" style="background:#fff;color:var(--bark);border-color:rgba(255, 255, 255,0.15); margin-bottom:0; padding:0.4rem 0.8rem; font-size:0.8rem;" title="Incluido en el paquete original">
          ${s.label} <span style="font-weight:600; opacity:0.8;">Incluido (x${cant})</span>
        </button>`;
    } else if (isOriginal) {
      // Ya reservado: permite AUMENTAR personas pero NO reducir por debajo del original
      const cant = currentCant > originalCant ? currentCant : originalCant;
      // Sync the map
      if (!_addReservaSrvs.has(strId) || _addReservaSrvs.get(strId) < originalCant) {
        _addReservaSrvs.set(strId, originalCant);
      }
      const hasIncrease = cant > originalCant;
      html += `
        <button type="button" class="srv-chip selected" style="background:var(--fire);color:#fff;border-color:var(--fire); margin-bottom:0; padding:0.4rem 0.8rem; font-size:0.8rem;" title="Ya reservado — puedes aumentar personas">
          ${s.label} <span style="font-weight:600; opacity:1;">Reservado (x${cant})</span>
          <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff; ${cant <= originalCant ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="adjustClientAddSrvCount('${id}', -1)">-</span>
            <span style="font-weight:bold; color:#fff;">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.15); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:#fff;" onclick="adjustClientAddSrvCount('${id}', 1)">+</span>
          </div>
          ${hasIncrease ? `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.8);">+${cant - originalCant} nuevas → +${fCop(s.precio * (cant - originalCant))}</div>` : `<div style="font-size:0.7rem; margin-top:0.25rem; color:rgba(255,255,255,0.6);">Presiona + para agregar más</div>`}
        </button>`;
    } else {
      const isSelected = _addReservaSrvs.has(strId);
      const cant = isSelected ? _addReservaSrvs.get(strId) : 0;
      html += `
        <button type="button" class="srv-chip ${isSelected ? 'selected' : ''}" onclick="toggleClientAddSrv('${id}', event)" style="${isSelected ? 'background:var(--fire);color: #fff;border-color:var(--fire);' : 'background:#fff;color:var(--bark);border-color:rgba(255, 255, 255,0.15);'} margin-bottom:0; padding:0.4rem 0.8rem; font-size:0.8rem;">
          ${s.label} <span style="font-weight:600; opacity:0.8;">+${fCop(s.precio)} / pers</span>
          <div style="display:${isSelected?'flex':'none'}; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.5rem;" onclick="event.stopPropagation()">
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adjustClientAddSrvCount('${id}', -1)">-</span>
            <span style="font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};">${cant}</span>
            <span class="srv-counter-btn" style="cursor:pointer; background:rgba(0,0,0,0.1); padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; color:${isSelected?'#fff':'var(--bark)'};" onclick="adjustClientAddSrvCount('${id}', 1)">+</span>
          </div>
        </button>`;
    }
  });
  grid.innerHTML = html || '<span style="color:var(--dark-muted);font-size:0.85rem;">No hay servicios adicionales disponibles</span>';
}


function toggleClientAddSrv(id, evt) {
  if (evt && evt.target.closest('.srv-counter-btn')) return;
  const strId = String(id);
  const isOriginal = _addReservaSrvsOriginales.has(strId);
  if (isOriginal) return; // Cannot modify original here
  
  if (_addReservaSrvs.has(strId)) {
    _addReservaSrvs.delete(strId);
  } else {
    const personas = _addReservaData ? (_addReservaData.num_personas || 1) : 1;
    _addReservaSrvs.set(strId, personas);
  }
  renderClientAddSrvs();
  evaluarClientAddServicios();
}

function adjustClientAddSrvCount(id, dir) {
  const strId = String(id);
  if (!_addReservaSrvs.has(strId)) return;
  let count = _addReservaSrvs.get(strId);
  count += dir;
  
  // Si es un servicio ya reservado, no permitir bajar del original
  const originalMin = _addReservaSrvsOriginales.has(strId) ? _addReservaSrvsOriginales.get(strId) : 1;
  if (count < originalMin) count = originalMin;
  
  const maxCap = Math.max(...Object.values(CABANAS).map(c => c.capacidad || 0), 1);
  if (count > maxCap) count = maxCap;
  _addReservaSrvs.set(strId, count);
  renderClientAddSrvs();
  evaluarClientAddServicios();
}

let _clienteTotalNuevosSrvs = 0;
let _clienteNuevosSrvsDetalle = [];

function evaluarClientAddServicios() {
  if (!_addReservaData) return;
  const resumenContainer = document.getElementById('m-add-srv-resumen');
  const listaNuevos = document.getElementById('m-add-srv-lista-nuevos');
  const btnPago = document.getElementById('btn-add-srv-pago');
  
  const paqExtraEl = document.getElementById('m-add-srv-paquete-extra');
  const paqueteExtraVal = paqExtraEl ? paqExtraEl.value : null;

  const personas = _addReservaData.num_personas || 1;
  let htmlResumen = '';
  _clienteTotalNuevosSrvs = 0;
  _clienteNuevosSrvsDetalle = [];

  // Paquete Extra
  if (paqueteExtraVal) {
    const pExtra = PAQUETES[paqueteExtraVal];
    if (pExtra) {
      const costoPaq = (pExtra.precio || 0) * personas;
      _clienteTotalNuevosSrvs += costoPaq;
      _clienteNuevosSrvsDetalle.push({
        id: paqueteExtraVal,
        label: `Paquete Extra: ${pExtra.label} (x${personas} pers)`,
        precio: costoPaq
      });
      htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
        <span>Paquete Extra: ${pExtra.label} (x${personas} pers)</span>
        <strong>+${fCop(costoPaq)}</strong>
      </div>`;
    }
  }

  // Servicios: cobrar solo la DIFERENCIA (aumentos sobre originales + nuevos completos)
  for (let [k, cant] of _addReservaSrvs.entries()) {
    const s = SERVICIOS[k];
    if (!s) continue;
    
    const originalCant = _addReservaSrvsOriginales.get(k) || 0;
    const extraCant = cant - originalCant; // Diferencia: solo las nuevas personas
    
    if (extraCant > 0) {
      const costo = s.precio * extraCant;
      _clienteTotalNuevosSrvs += costo;
      
      if (originalCant > 0) {
        // Aumento sobre un servicio existente
        _clienteNuevosSrvsDetalle.push({
          id: s.id,
          label: `${s.label} (+${extraCant} pers adicionales)`,
          precio: costo
        });
        htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span>${s.label} (+${extraCant} pers adicionales)</span>
          <strong>+${fCop(costo)}</strong>
        </div>`;
      } else {
        // Servicio completamente nuevo
        _clienteNuevosSrvsDetalle.push({
          id: s.id,
          label: `${s.label} (x${cant} pers)`,
          precio: costo
        });
        htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span>${s.label} (x${cant} pers)</span>
          <strong>+${fCop(costo)}</strong>
        </div>`;
      }
    }
  }

  if (_clienteTotalNuevosSrvs > 0) {
    htmlResumen += `<div style="display:flex; justify-content:space-between; margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255, 255, 255,0.1); color: #fff; font-size:1.1rem;">
      <strong>Total a Pagar:</strong>
      <strong style="color:var(--success);">${fCop(_clienteTotalNuevosSrvs)}</strong>
    </div>`;
    listaNuevos.innerHTML = htmlResumen;
    resumenContainer.style.display = 'block';
    btnPago.style.display = 'inline-block';
  } else {
    resumenContainer.style.display = 'none';
    btnPago.style.display = 'none';
  }
}

async function guardarAddServicios() {
  if (!_addReservaId || _clienteTotalNuevosSrvs <= 0) return;
  
  const alertEl = document.getElementById('m-add-srv-alert');
  const btn = document.getElementById('btn-add-srv-pago');
  if (alertEl) alertEl.innerHTML = '';
  setLoading(btn, true, 'Procesando...');

  try {
    const paqExtraEl = document.getElementById('m-add-srv-paquete-extra');
    const paqueteExtraVal = paqExtraEl ? paqExtraEl.value : null;
    
    // Combinar extras originales + el nuevo
    const allPaqExtra = new Set(_addReservaPaquetesExtraOriginales);
    if (paqueteExtraVal) allPaqExtra.add(paqueteExtraVal);

    // Combinar servicios originales + nuevos
    const allSrvsIds = [...new Set([..._addReservaSrvsOriginales.keys(), ..._addReservaSrvs.keys()])];
    const allSrvs = allSrvsIds.map(id => ({ id, cantidad: _addReservaSrvs.get(id) || _addReservaSrvsOriginales.get(id) || 1 }));

    // Calcular el SubTotal completo de la reserva combinando todo
    const pExtraCostTotal = Array.from(allPaqExtra).reduce((s, p) => s + ((PAQUETES[p]?.precio || 0) * (_addReservaData.num_personas||1)), 0);
    const srvCostTotal = allSrvs.reduce((s, obj) => s + ((SERVICIOS[obj.id]?.precio || 0) * obj.cantidad), 0);
    const cabanaCost = CABANAS[_addReservaData.cabana]?.precio || 0;
    const paqCost = (PAQUETES[_addReservaData.paquete]?.precio || 0) * (_addReservaData.num_personas||1);
    
    const baseTotal = (cabanaCost * nights(_addReservaData.fecha_inicio, _addReservaData.fecha_fin)) + paqCost + pExtraCostTotal + srvCostTotal;

    const payload = {
      servicios: allSrvs,
      paquetes_extra: Array.from(allPaqExtra),
      metodo_pago_nuevos_servicios: 'stripe',
      nuevos_servicios_detalle: _clienteNuevosSrvsDetalle,
      total_nuevos_servicios: _clienteTotalNuevosSrvs
    };

    await ReservasAPI.actualizar(_addReservaId, payload);

    // Redirigir a Stripe para cobrar la diferencia
    const token = typeof Auth !== 'undefined' ? Auth.getToken() : localStorage.getItem('kafe_token');
    const stripeRes = await fetch('/api/pagos/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idReserva: _addReservaId, source: 'cliente', montoExtra: _clienteTotalNuevosSrvs })
    });
    
    const stripeData = await stripeRes.json();
    if (stripeData.ok && stripeData.url) {
      window.location.href = stripeData.url;
    } else {
      throw new Error(stripeData.mensaje || 'Error al conectar con la pasarela de pagos Stripe');
    }

  } catch(err) {
    setLoading(btn, false, 'Pagar en Stripe');
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">⚠ ${err.message}</div>`;
  }
}


/* ════════ FLATPICKR CLIENTE ════════ */
function setupClientDatePickers() {
  if (typeof flatpickr === 'undefined') return;
  const _hc = new Date(); const hoyStr = `${_hc.getFullYear()}-${String(_hc.getMonth()+1).padStart(2,'0')}-${String(_hc.getDate()).padStart(2,'0')}`;
  const commonOpts = { locale: 'es', minDate: 'today', dateFormat: 'Y-m-d', disableMobile: true };

  const iniEl = document.getElementById('f-ini');
  const finEl = document.getElementById('f-fin');
  if (!iniEl || !finEl) return;

  flatpickr('#f-ini', {
    ...commonOpts,
    onChange: function(selectedDates) {
      const finPicker = finEl._flatpickr;
      if (!finPicker || !selectedDates.length) return;
      const minFin = new Date(selectedDates[0]);
      minFin.setDate(minFin.getDate() + 1);
      finPicker.set('minDate', minFin);
      if (finPicker.selectedDates[0] && finPicker.selectedDates[0] <= selectedDates[0]) finPicker.clear();
      
      setTimeout(() => {
        if (finPicker.element) {
          finPicker.jumpToDate(selectedDates[0]);
          finPicker.open();
        }
      }, 100);
      onForm();
    }
  });

  flatpickr('#f-fin', {
    ...commonOpts,
    onChange: function() {
      onForm();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupClientDatePickers();
});
