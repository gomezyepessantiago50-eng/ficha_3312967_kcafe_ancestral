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

  // Botones "Ver detalles" de cabañas → redirige al login
  document.querySelectorAll('.cabaña-footer .btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  });

  // Botones de paquetes → redirige al login
  document.querySelectorAll('.paquete-card .btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  });
}

// ── CARGAR PAQUETES DINÁMICAMENTE ─────────────────────────────────────────────
async function loadLandingPaquetes() {
  const grid = document.getElementById('landing-paquetes-grid');
  if (!grid) return;
  try {
    const res = await fetch('/api/paquetes');
    const data = await res.json();
    let paqs = data.paquetes || data.data || [];
    paqs = paqs.filter(p => p.Estado); // Solo mostrar activos

    if (paqs.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;color:var(--dark-muted);padding:2rem;">No hay paquetes disponibles en este momento</div>';
      return;
    }

    grid.innerHTML = paqs.map(p => {
      // Determinar precio para mostrar
      const isFree = !p.Precio || p.Precio <= 0;
      const priceText = isFree ? 'Incluido' : (p.Precio / 1000) + 'K';
      
      return `
        <div class="paquete-card">
          <div class="paquete-header">
            <h3>${p.NombrePaquete}</h3>
            ${p.NombreServicio ? `<p class="paquete-subtitle">Incluye: ${p.NombreServicio}</p>` : ''}
          </div>
          <div class="paquete-price">
            <span class="currency">${isFree ? '' : '$'}</span>
            <span class="amount">${priceText}</span>
            <span class="period">${isFree ? '' : '/noche'}</span>
          </div>
          <p class="paquete-description">${p.Descripcion || 'Vive una experiencia inigualable en nuestro Glamping.'}</p>
          <button class="btn btn-outline btn-block" onclick="window.location.href='index.html'">Seleccionar</button>
        </div>
      `;
    }).join('');

    // Re-bind listeners si es necesario
    initializeButtonInteractions();

  } catch (error) {
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

window.landingPage = { trackEvent };
console.log('🌿 Kcafé Ancestral Landing — v1.1');
