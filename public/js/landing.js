// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE — Kcafé Ancestral  (v1.1 corregido)
// FIX: botones de reserva ya no deshabilitan ni cambian texto al redirigir
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  initializeMobileMenu();
  initializeScrollAnimations();
  initializeScrollIndicator();
  initializeButtonInteractions();
  initializeLazyImages();
  loadLandingCabanas();
  loadLandingPaquetes();
  setupReservaForm();
});

// ── MENÚ MOBILE ──────────────────────────────────────────────────────────────
function initializeMobileMenu() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.querySelector('.nav-menu');
  const navLinks   = document.querySelectorAll('.nav-link');
  if (!menuToggle || !navMenu) return;

  menuToggle.addEventListener('click', function() {
    menuToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
  });
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      menuToggle.classList.remove('active');
      navMenu.classList.remove('active');
    });
  });
  document.addEventListener('click', function(e) {
    if (!navMenu.contains(e.target) && !menuToggle.contains(e.target) && navMenu.classList.contains('active')) {
      menuToggle.classList.remove('active');
      navMenu.classList.remove('active');
    }
  });
}

// ── HERO (imagen estática — slider eliminado) ────────────────────────────────
// La imagen del hero ahora usa una animación Ken Burns por CSS.
// No se necesita lógica JS para el slider.

// ── ANIMACIONES EN SCROLL ─────────────────────────────────────────────────────
function initializeScrollAnimations() {
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        const cards = entry.target.querySelectorAll(
          '.cabaña-card, .experiencia-card, .paquete-card, .testimonio-card, .value-card'
        );
        cards.forEach((card, i) => {
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, i * 100);
        });
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });

  document.querySelectorAll('.cabanas, .experiencia, .paquetes, .testimonios, .gallery, .about').forEach(s => {
    observer.observe(s);
  });

  document.querySelectorAll('.cabaña-card, .experiencia-card, .paquete-card, .testimonio-card, .value-card').forEach(card => {
    card.style.opacity    = '0';
    card.style.transform  = 'translateY(24px)';
    card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
  });
}

// ── INDICADOR SCROLL ──────────────────────────────────────────────────────────
function initializeScrollIndicator() {
  const heroScroll = document.querySelector('.hero-scroll');
  if (!heroScroll) return;
  heroScroll.addEventListener('click', function() {
    document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' });
  });
  window.addEventListener('scroll', function() {
    heroScroll.style.opacity         = window.scrollY > 80 ? '0' : '1';
    heroScroll.style.pointerEvents   = window.scrollY > 80 ? 'none' : 'auto';
  }, { passive: true });
}

// ── BOTONES DE RESERVA ────────────────────────────────────────────────────────
// FIX: redirige directamente sin deshabilitar el botón ni cambiar su texto
function initializeButtonInteractions() {

  // Botones principales de reserva (header + hero + CTA final)
  document.querySelectorAll(
    '#header-reserve-btn, #hero-reserve-btn, .final-cta-reserve-btn'
  ).forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  });

  // Botón "Ver Disponibilidad" → scroll a cabañas
  const availBtn = document.getElementById('check-availability-btn');
  if (availBtn) {
    availBtn.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelector('#cabanas')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Los botones de cabañas ahora usan abrirModalCabana() definido globalmente

}

// ── CARGAR CABAÑAS DINÁMICAMENTE ─────────────────────────────────────────────
async function loadLandingCabanas() {

  const cGrid = document.getElementById('landing-cabanas-grid');
  const gGrid = document.getElementById('landing-gallery-grid');
  const selectCabana = document.getElementById('select-cabana');
  if (!cGrid) return;

  try {
    const res = await fetch('/api/cabanas');
    const data = await res.json();
    let cabanas = data.data || [];
    cabanas = cabanas.filter(c => c.Estado == 1); // Solo activas
    window.cabanasDisponibles = cabanas;

    // Actualizar select de cabañas si existe
    if (selectCabana) {
      const prevValue = selectCabana.value;
      selectCabana.innerHTML = '<option value="">Seleccione una cabaña</option>' +
        cabanas.map(c => `<option value="${c.IDCabana}">${c.Nombre}</option>`).join('');
      // Restaurar selección si es posible
      if (prevValue && cabanas.some(c => c.IDCabana == prevValue)) {
        selectCabana.value = prevValue;
      }
    }

    if (cabanas.length === 0) {
      cGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay cabañas disponibles en este momento</div>';
      if (gGrid) gGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay fotos disponibles en la galería</div>';
      return;
    }

// Mantener selects y fecha visibles y funcionales
function setupReservaForm() {
  const form = document.getElementById('reserva-form');
  const fechaInput = document.getElementById('fecha-reserva');
  const selectCabana = document.getElementById('select-cabana');
  if (!form || !fechaInput || !selectCabana) return;

  // Opcional: mantener la fecha seleccionada en localStorage
  fechaInput.value = localStorage.getItem('fecha-reserva') || '';
  fechaInput.addEventListener('change', () => {
    localStorage.setItem('fecha-reserva', fechaInput.value);
  });

  // Opcional: mantener la cabaña seleccionada en localStorage
  selectCabana.value = localStorage.getItem('select-cabana') || '';
  selectCabana.addEventListener('change', () => {
    localStorage.setItem('select-cabana', selectCabana.value);
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // Aquí puedes agregar lógica para buscar disponibilidad o mostrar detalles
    alert(`Fecha: ${fechaInput.value}\nCabaña: ${selectCabana.options[selectCabana.selectedIndex].text}`);
  });
}

    // 1. Renderizar tarjetas de cabañas
    cGrid.innerHTML = cabanas.map(c => {
      let img = 'https://images.unsplash.com/photo-1518991669915-32c39c6f5981?w=500&h=400&fit=crop';
      try { 
        img = c.ImagenCabana && c.ImagenCabana.startsWith('[') ? JSON.parse(c.ImagenCabana)[0] : (c.ImagenCabana || img); 
      } catch(e) { img = c.ImagenCabana || img; }

      return `
        <div class="cabaña-card">
          <div class="cabaña-image">
            <img src="${img}" alt="${c.Nombre}"/>
          </div>
          <div class="cabaña-content">
            <h3>${c.Nombre}</h3>
            <ul class="cabaña-features">
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Capacidad: ${c.CapacidadMaxima} huéspedes</li>
              <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;"><path d="M3 22v-8"/><path d="M21 22v-8"/><path d="M3 14h18"/><path d="M7 14v-4a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v4"/><path d="M12 6V2"/></svg> Habitaciones: ${c.NumeroHabitaciones}</li>
              ${c.Ubicacion ? `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ubicación: ${c.Ubicacion}</li>` : ''}
            </ul>
            <div class="cabaña-footer">
              <span class="price">$${Number(c.Costo).toLocaleString('es-CO')}<small>/noche</small></span>
              <button class="btn btn-outline btn-sm" onclick="abrirModalCabana('${c.IDCabana}')">Ver detalles</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 2. Renderizar Galería (Extraer todas las fotos de las cabañas activas)
    if (gGrid) {
      let galleryHTML = '';
      cabanas.forEach((c, index) => {
        const sizeClass = (index % 3 === 0) ? 'large' : '';
        if (c.ImagenCabana) {
          try {
            const arr = c.ImagenCabana.startsWith('[') ? JSON.parse(c.ImagenCabana) : [c.ImagenCabana];
            arr.forEach((img, i) => {
              galleryHTML += `
                <div class="gallery-item ${i === 0 ? sizeClass : ''}">
                  <img src="${img}" alt="${c.Nombre} - Foto ${i+1}"/>
                </div>
              `;
            });
          } catch(e) {
            galleryHTML += `
              <div class="gallery-item ${sizeClass}">
                <img src="${c.ImagenCabana}" alt="${c.Nombre}"/>
              </div>
            `;
          }
        }
        if (c.ImagenHabitacion) {
          try {
            const arrH = c.ImagenHabitacion.startsWith('[') ? JSON.parse(c.ImagenHabitacion) : [c.ImagenHabitacion];
            arrH.forEach((imgH, i) => {
              galleryHTML += `
                <div class="gallery-item">
                  <img src="${imgH}" alt="Interior de ${c.Nombre} - Foto ${i+1}"/>
                </div>
              `;
            });
          } catch(e) {
            galleryHTML += `
              <div class="gallery-item">
                <img src="${c.ImagenHabitacion}" alt="Interior de ${c.Nombre}"/>
              </div>
            `;
          }
        }
      });

      if (galleryHTML) {
        gGrid.innerHTML = galleryHTML;
      } else {
        gGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">Aún no hay fotos en la galería</div>';
      }
    }

    // Asegurar que lazyloading se aplique a las nuevas imágenes
    initializeLazyImages();
    // Animaciones
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('#landing-cabanas-grid .cabaña-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      setTimeout(() => observer.observe(card), i * 100);
    });

  } catch (error) {
    console.error(error);
    cGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:#f44336;padding:2rem;">Error al cargar las cabañas</div>';
  }
}

// ── CARGAR PAQUETES DINÁMICAMENTE ─────────────────────────────────────────────
async function loadLandingPaquetes() {
  const grid = document.getElementById('landing-paquetes-grid');
  if (!grid) return;
  try {
    const [resPaq, resSrv] = await Promise.all([
      fetch('/api/paquetes'),
      fetch('/api/servicios')
    ]);
    const dataPaq = await resPaq.json();
    const dataSrv = await resSrv.json();
    
    window._landingServiciosMap = {};
    const serviciosArray = dataSrv.data || dataSrv || [];
    serviciosArray.forEach(s => {
      window._landingServiciosMap[s.IDServicio] = s;
    });

    let paqs = dataPaq.paquetes || dataPaq.data || [];
    paqs = paqs.filter(p => p.Estado); // Solo mostrar activos

    if (paqs.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay paquetes disponibles en este momento</div>';
      return;
    }

    window._landingPaquetesMap = {};
    paqs.forEach(p => {
      window._landingPaquetesMap[p.IDPaquete] = p;
    });

    grid.innerHTML = paqs.map(p => {
      // Determinar precio para mostrar
      const isFree = !p.Precio || p.Precio <= 0;
      const priceText = isFree ? 'Incluido' : (p.Precio / 1000) + 'K';
      
      let srvsIds = [];
      try {
        if (p.ServiciosIncluidos) {
          srvsIds = typeof p.ServiciosIncluidos === 'string' ? JSON.parse(p.ServiciosIncluidos) : p.ServiciosIncluidos;
        }
      } catch (e) {}
      
      let srvsObjs = srvsIds.map(id => window._landingServiciosMap[id]).filter(Boolean);
      let srvsHtml = '';
      if (srvsObjs.length > 0) {
        srvsHtml = `<div style="margin-top:1rem; font-size:0.9rem; color:var(--bark); font-weight:bold; text-align:left;">Servicios incluidos:</div><ul style="list-style:none; padding:0; margin: 0.5rem 0 1rem; font-size:0.85rem; color:var(--mist); text-align:left;">` + 
          srvsObjs.map(s => {
            let img = s.Imagen ? `<img src="${s.Imagen}" style="width:20px;height:20px;border-radius:4px;object-fit:cover;margin-right:8px;vertical-align:middle;display:inline-block;" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--fire)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            return `<li style="margin-bottom:0.4rem; border-bottom:1px solid rgba(255, 255, 255,0.05); padding-bottom:0.4rem; display:flex; align-items:center;">${img} ${s.NombreServicio}</li>`;
          }).join('') +
          `</ul>`;
      }
      
      return `
        <div class="paquete-card" style="display:flex; flex-direction:column;">
          <div class="paquete-header">
            <h3>${p.NombrePaquete}</h3>
          </div>
          <div class="paquete-price">
            <span class="currency">${isFree ? '' : '$'}</span>
            <span class="amount">${priceText}</span>
            <span class="period"></span>
          </div>
          ${srvsHtml}
          <button class="btn btn-outline btn-block" style="margin-top:auto;" onclick="landingVerPaquete('${p.IDPaquete}')">Ver detalle</button>
        </div>
      `;
    }).join('');

    // Cargar sección de servicios después de paquetes
    loadLandingServicios(serviciosArray);

    // Re-bind listeners si es necesario
    initializeButtonInteractions();

  } catch (error) {
    console.error("Error cargando paquetes:", error);
    grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:#f44336;padding:2rem;">Error al cargar los paquetes</div>';
  }
}

window.landingVerPaquete = function(id) {
    const p = window._landingPaquetesMap[id];
    if (!p) return;
    
    let srvsIds = [];
    try { srvsIds = typeof p.ServiciosIncluidos === 'string' ? JSON.parse(p.ServiciosIncluidos) : (p.ServiciosIncluidos||[]); } catch(e){}
    
    let srvsTags = [];
    let srvsImgs = [];
    srvsIds.forEach(srvId => {
        const s = window._landingServiciosMap[srvId];
        if (s) {
            srvsTags.push(`<li style="margin-bottom:0.5rem;display:flex;align-items:center;"><strong>${s.NombreServicio}</strong></li>`);
            if (s.Imagen) {
                srvsImgs.push(`<div><strong style="display:block;margin-bottom:0.5rem;color:var(--bark);">${s.NombreServicio}</strong><img src="${s.Imagen}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid rgba(255, 255, 255,0.1);"/></div>`);
            }
        }
    });

    const isFree = !p.Precio || p.Precio <= 0;
    const priceText = isFree ? 'Incluido' : '$' + Number(p.Precio).toLocaleString('es-CO');

    const modalHTML = `
        <div id="landing-vp-overlay" class="overlay open" onclick="if(event.target===this){ this.remove(); document.body.style.overflow=''; }" style="z-index:9999;">
            <div class="modal" style="max-width:600px; max-height:90vh;">
                <div class="modal-hd">
                    <h3 style="margin:0;color:var(--fire);font-family:var(--font-display);font-size:1.6rem;">${p.NombrePaquete}</h3>
                    <button class="modal-close" onclick="document.getElementById('landing-vp-overlay').remove(); document.body.style.overflow='';">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--mist);margin-bottom:1.5rem;font-size:1rem;line-height:1.6;">${p.Descripcion || 'Sin descripción'}</p>
                    
                    <div style="background:var(--cream);padding:1rem;border-radius:8px;border:1px solid rgba(230,81,0,0.1);margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                        <span style="font-size:0.9rem;color:var(--bark);margin-bottom:0.2rem;">Precio</span>
                        <span style="font-size:1.8rem;font-weight:800;color:var(--fire);font-family:var(--font-display);">${priceText}</span>
                    </div>

                    <div style="margin-bottom:1.5rem;">
                        <strong style="display:block;margin-bottom:0.8rem;color:var(--bark);font-size:1.1rem;">Servicios Incluidos:</strong>
                        <ul style="list-style:none;padding:0;margin:0;color:var(--mist);">
                            ${srvsTags.length ? srvsTags.join('') : '<li>Ninguno</li>'}
                        </ul>
                    </div>
                    
                    ${srvsImgs.length ? `
                    <div style="margin-top:1.5rem;">
                        <strong style="display:block;margin-bottom:1rem;color:var(--bark);font-size:1.1rem;">Fotos de Servicios:</strong>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                            ${srvsImgs.join('')}
                        </div>
                    </div>` : ''}
                </div>
                <div class="modal-ft">
                    <button class="btn btn-outline" onclick="document.getElementById('landing-vp-overlay').remove(); document.body.style.overflow='';">Cerrar</button>
                    <button class="btn btn-fire" onclick="window.location.href='index.html'">Reservar ahora</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
};

// ── LAZY LOADING ──────────────────────────────────────────────────────────────
function initializeLazyImages() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.style.transition = 'opacity 0.4s ease-in';
        img.style.opacity    = '0';
        img.onload = () => { img.style.opacity = '1'; };
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });
  document.querySelectorAll('img').forEach(img => obs.observe(img));
}

// ── TRACKING (opcional) ───────────────────────────────────────────────────────
function trackEvent(name, data = {}) {
  if (window.gtag) gtag('event', name, data);
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('btn-fire')) {
    trackEvent('click_cta', { text: e.target.textContent.trim() });
  }
});

// ── MODAL DETALLES CABAÑA ───────────────────────────────────────────────────
function abrirModalCabana(id) {
  if (!window.cabanasDisponibles) return;
  const cabana = window.cabanasDisponibles.find(c => c.IDCabana == id);
  if (!cabana) return;

  const modal = document.getElementById('modal-cabana-detalle');
  if (!modal) return;

  let img = 'https://images.unsplash.com/photo-1518991669915-32c39c6f5981?w=500&h=400&fit=crop';
  try { img = cabana.ImagenCabana && cabana.ImagenCabana.startsWith('[') ? JSON.parse(cabana.ImagenCabana)[0] : (cabana.ImagenCabana || img); } catch(e) { img = cabana.ImagenCabana || img; }
  
  document.getElementById('modal-cabana-img').src = img;
  document.getElementById('modal-cabana-img').alt = cabana.Nombre;
  
  // Create mini gallery below main image if there are multiple images
  const createMiniGallery = (imgStr, containerId) => {
    let arr = [];
    try { arr = imgStr && imgStr.startsWith('[') ? JSON.parse(imgStr) : (imgStr ? [imgStr] : []); } catch(e) { arr = imgStr ? [imgStr] : []; }
    if(arr.length <= 1) return '';
    return '<div style="display:flex; gap:0.5rem; margin-top:0.5rem; overflow-x:auto;">' + arr.map(i => `<img src="${i}" onclick="document.getElementById('${containerId}').src='${i}'" style="width:60px; height:45px; object-fit:cover; border-radius:4px; cursor:pointer; opacity:0.8; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" />`).join('') + '</div>';
  };
  
  // Insert mini gallery for exterior
  const extGalleryHtml = createMiniGallery(cabana.ImagenCabana, 'modal-cabana-img');
  let extGalleryContainer = document.getElementById('modal-cabana-gallery');
  if (!extGalleryContainer) {
    extGalleryContainer = document.createElement('div');
    extGalleryContainer.id = 'modal-cabana-gallery';
    document.getElementById('modal-cabana-img').parentNode.insertBefore(extGalleryContainer, document.getElementById('modal-cabana-img').nextSibling);
  }
  extGalleryContainer.innerHTML = extGalleryHtml;
  
  document.getElementById('modal-cabana-titulo').textContent = cabana.Nombre;
  document.getElementById('modal-cabana-desc').textContent = cabana.Descripcion || 'Experimenta la naturaleza y el confort.';
  document.getElementById('modal-cabana-capacidad').textContent = cabana.CapacidadMaxima;
  document.getElementById('modal-cabana-habitaciones').textContent = cabana.NumeroHabitaciones;
  
  const ubEl = document.getElementById('modal-cabana-ubicacion');
  if (cabana.Ubicacion) {
    ubEl.textContent = cabana.Ubicacion;
    ubEl.parentElement.style.display = 'flex';
  } else {
    ubEl.parentElement.style.display = 'none';
  }

  const habContainer = document.getElementById('modal-cabana-habitacion-container');
  const habImg = document.getElementById('modal-cabana-img-habitacion');
  if (habContainer && habImg) {
    if (cabana.ImagenHabitacion) {
      let firstHabImg = cabana.ImagenHabitacion;
      try { firstHabImg = cabana.ImagenHabitacion.startsWith('[') ? JSON.parse(cabana.ImagenHabitacion)[0] : cabana.ImagenHabitacion; } catch(e) {}
      habImg.src = firstHabImg;
      habContainer.style.display = 'block';
      
      const intGalleryHtml = createMiniGallery(cabana.ImagenHabitacion, 'modal-cabana-img-habitacion');
      let intGalleryContainer = document.getElementById('modal-cabana-int-gallery');
      if (!intGalleryContainer) {
        intGalleryContainer = document.createElement('div');
        intGalleryContainer.id = 'modal-cabana-int-gallery';
        habImg.parentNode.insertBefore(intGalleryContainer, habImg.nextSibling);
      }
      intGalleryContainer.innerHTML = intGalleryHtml;
    } else {
      habContainer.style.display = 'none';
    }
  }

  document.getElementById('modal-cabana-precio').textContent = '$' + Number(cabana.Costo).toLocaleString('es-CO');

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarModalCabana() {
  const modal = document.getElementById('modal-cabana-detalle');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-cabana-detalle');
  if (modal && e.target === modal) {
    cerrarModalCabana();
  }
});

window.landingPage = { trackEvent };
console.log('🌿 Kcafé Ancestral Landing — v1.1');

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


// -- CARGAR SERVICIOS --------------------------------------------------------
function loadLandingServicios(serviciosArray) {
  const container = document.getElementById("landing-servicios-container");
  if (!container) return;
  
  const activos = serviciosArray.filter(s => s.Estado == 1);
  if (activos.length === 0) {
    container.innerHTML = "<div style=\"text-align:center;padding:2rem;width:100%;color:var(--dark-muted);\">No hay servicios disponibles</div>";
    return;
  }
  
  container.innerHTML = activos.map(s => {
    const isFree = !s.Costo || s.Costo <= 0;
    const priceText = isFree ? "Gratis" : "$" + Number(s.Costo).toLocaleString("es-CO");
    const imgHtml = s.Imagen 
      ? `<img src="${s.Imagen}" alt="${s.NombreServicio}" loading="lazy"/>`
      : `<div style="width:100%;height:200px;background:var(--dark-bg);display:flex;align-items:center;justify-content:center;color:var(--dark-muted);">Sin imagen</div>`;
      
    return `
      <div class="servicio-card">
        ${imgHtml}
        <div class="servicio-card-body">
          <h3>${s.NombreServicio}</h3>
          <div class="precio">${priceText}</div>
          <p>${s.Descripcion || "Vive una experiencia relajante."}</p>
        </div>
      </div>
    `;
  }).join("");
}

