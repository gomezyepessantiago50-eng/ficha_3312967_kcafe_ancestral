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

  // Botones de paquetes → redirige al login
  document.querySelectorAll('.paquete-card .btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  });
}

// ── CARGAR CABAÑAS DINÁMICAMENTE ─────────────────────────────────────────────
async function loadLandingCabanas() {
  const cGrid = document.getElementById('landing-cabanas-grid');
  const gGrid = document.getElementById('landing-gallery-grid');
  if (!cGrid) return;
  
  try {
    const res = await fetch('/api/cabanas');
    const data = await res.json();
    let cabanas = data.data || [];
    cabanas = cabanas.filter(c => c.Estado == 1); // Solo activas
    window.cabanasDisponibles = cabanas;

    if (cabanas.length === 0) {
      cGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay cabañas disponibles en este momento</div>';
      if (gGrid) gGrid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay fotos disponibles en la galería</div>';
      return;
    }

    // 1. Renderizar tarjetas de cabañas
    cGrid.innerHTML = cabanas.map(c => {
      const img = c.ImagenCabana || 'https://images.unsplash.com/photo-1518991669915-32c39c6f5981?w=500&h=400&fit=crop';
      return `
        <div class="cabaña-card">
          <div class="cabaña-image">
            <img src="${img}" alt="${c.Nombre}"/>
          </div>
          <div class="cabaña-content">
            <h3>${c.Nombre}</h3>
            <p class="cabaña-description">${c.Descripcion || 'Experimenta la naturaleza y el confort.'}</p>
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
        // La primera imagen de cada iteración podría ser grande para variedad
        const sizeClass = (index % 3 === 0) ? 'large' : '';
        if (c.ImagenCabana) {
          galleryHTML += `
            <div class="gallery-item ${sizeClass}">
              <img src="${c.ImagenCabana}" alt="${c.Nombre}"/>
            </div>
          `;
        }
        if (c.ImagenHabitacion) {
          galleryHTML += `
            <div class="gallery-item">
              <img src="${c.ImagenHabitacion}" alt="Interior de ${c.Nombre}"/>
            </div>
          `;
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
    
    const serviciosMap = {};
    const serviciosArray = dataSrv.data || dataSrv || [];
    serviciosArray.forEach(s => {
      serviciosMap[s.IDServicio] = s.NombreServicio;
    });

    let paqs = dataPaq.paquetes || dataPaq.data || [];
    paqs = paqs.filter(p => p.Estado); // Solo mostrar activos

    if (paqs.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay paquetes disponibles en este momento</div>';
      return;
    }

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
      
      let srvsNames = srvsIds.map(id => serviciosMap[id]).filter(Boolean);
      let srvsHtml = '';
      if (srvsNames.length > 0) {
        srvsHtml = `<ul style="list-style:none; padding:0; margin: 1rem 0; font-size:0.85rem; color:var(--mist); text-align:left;">` + 
          srvsNames.map(n => `<li style="margin-bottom:0.4rem; border-bottom:1px solid rgba(46,26,14,0.05); padding-bottom:0.4rem;"><svg viewBox="0 0 24 24" fill="none" stroke="var(--fire)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ${n}</li>`).join('') +
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
            <span class="period">${isFree ? '' : '/noche'}</span>
          </div>
          <p class="paquete-description" style="margin-bottom:0;">${p.Descripcion || 'Vive una experiencia inigualable en nuestro Glamping.'}</p>
          ${srvsHtml}
          <button class="btn btn-outline btn-block" style="margin-top:auto;" onclick="window.location.href='index.html'">Seleccionar</button>
        </div>
      `;
    }).join('');

    // Re-bind listeners si es necesario
    initializeButtonInteractions();

  } catch (error) {
    console.error("Error cargando paquetes:", error);
    grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:#f44336;padding:2rem;">Error al cargar los paquetes</div>';
  }
}

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

  const img = cabana.ImagenCabana || 'https://images.unsplash.com/photo-1518991669915-32c39c6f5981?w=500&h=400&fit=crop';
  
  document.getElementById('modal-cabana-img').src = img;
  document.getElementById('modal-cabana-img').alt = cabana.Nombre;
  document.getElementById('modal-cabana-titulo').textContent = cabana.Nombre;
  document.getElementById('modal-cabana-desc').textContent = cabana.Descripcion || 'Experimenta la naturaleza y el confort.';
  document.getElementById('modal-cabana-capacidad').textContent = cabana.CapacidadMaxima;
  document.getElementById('modal-cabana-habitaciones').textContent = cabana.NumeroHabitaciones;
  
  const ubEl = document.getElementById('modal-cabana-ubicacion');
  if (cabana.Ubicacion) {
    ubEl.textContent = cabana.Ubicacion;
    ubEl.parentElement.style.display = 'block';
  } else {
    ubEl.parentElement.style.display = 'none';
  }

  document.getElementById('modal-cabana-precio').textContent = '$' + Number(cabana.Costo).toLocaleString('es-CO');

  modal.classList.add('open');
}

function cerrarModalCabana() {
  const modal = document.getElementById('modal-cabana-detalle');
  if (modal) modal.classList.remove('open');
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
