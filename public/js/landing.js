// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE — Kcafé Ancestral  (v1.1 corregido)
// FIX: botones de reserva ya no deshabilitan ni cambian texto al redirigir
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  initializeMobileMenu();
  initializeScrollAnimations();
  initializeScrollIndicator();
  initializeButtonInteractions();
  initializeHeroSlider();
  initializeLazyImages();
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

// ── HERO SLIDER (rotación automática de imágenes de cabañas) ─────────────────
function initializeHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  let current = 0;
  let timer   = null;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  }

  function next() { goTo(current + 1); }

  function startAuto() { timer = setInterval(next, 4500); }
  function stopAuto()  { clearInterval(timer); }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { stopAuto(); goTo(i); startAuto(); });
  });

  // Swipe en móvil
  let startX = 0;
  const heroEl = document.querySelector('.hero');
  if (heroEl) {
    heroEl.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    heroEl.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { stopAuto(); goTo(current + (diff > 0 ? 1 : -1)); startAuto(); }
    }, { passive: true });
  }

  goTo(0);
  startAuto();
}

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
