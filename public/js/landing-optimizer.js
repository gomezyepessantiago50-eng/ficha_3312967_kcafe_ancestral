// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE OPTIMIZER — Kcafé Ancestral
// Utilidades de optimización y configuración
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN PERSONALIZABLE ────────────────────────────────────────────
const LANDING_CONFIG = {
  // Información de contacto
  contact: {
    email: 'info@kcafeancestral.com',
    phone: '+57 (300) 123-4567',
    whatsapp: '+573001234567',
    location: 'Selva Tropical, Valle del Cauca - Colombia'
  },

  // URLs importantes
  urls: {
    reservas: '/reservas',
    dashboard: '/dashboard',
    galeria: '/galeria',
    politicaPrivacidad: '/politica-privacidad',
    terminosCondiciones: '/terminos-condiciones'
  },

  // Configuración de imágenes
  images: {
    useWebP: true, // Convertir a WebP si está disponible
    lazyLoad: true,
    preloadCritical: true,
    errorFallback: '/assets/images/placeholder.jpg'
  },

  // Configuración de análisis
  analytics: {
    enabled: true,
    googleAnalyticsId: 'G-XXXXXXXXXX', // Reemplazar con ID real
    trackingEvents: true
  },

  // Configuración de caché
  cache: {
    ttl: 3600, // segundos
    enableServiceWorker: false // Activar cuando esté listo
  },

  // URLs de cabañas (dinámicas)
  cabanas: [
    {
      id: 1,
      nombre: 'Serenidad',
      precio: 180,
      tipo: 'Romántica',
      capacidad: 2,
      area: 45
    },
    {
      id: 2,
      nombre: 'Familia',
      precio: 320,
      tipo: 'Familiar',
      capacidad: 6,
      area: 85,
      featured: true
    },
    {
      id: 3,
      nombre: 'Aventura',
      precio: 220,
      tipo: 'Aventura',
      capacidad: 3,
      area: 55
    },
    {
      id: 4,
      nombre: 'Retiro',
      precio: 450,
      tipo: 'Premium',
      capacidad: 4,
      area: 100
    }
  ],

  // Paquetes (dinámicos)
  paquetes: [
    {
      id: 1,
      nombre: 'Romántico',
      precio: 450,
      popular: false
    },
    {
      id: 2,
      nombre: 'Familiar',
      precio: 650,
      popular: true
    },
    {
      id: 3,
      nombre: 'Aventura',
      precio: 520,
      popular: false
    }
  ]
};

// ── OPTIMIZACIÓN DE IMÁGENES ────────────────────────────────────────────────
class ImageOptimizer {
  constructor(config) {
    this.config = config;
    this.supportedFormats = this.detectImageFormats();
  }

  detectImageFormats() {
    const formats = {
      webp: false,
      avif: false
    };

    // Detectar soporte WebP
    const canvas = document.createElement('canvas');
    if (canvas.toDataURL && canvas.toDataURL('image/webp').indexOf('image/webp') === 0) {
      formats.webp = true;
    }

    return formats;
  }

  optimizeImageUrl(url) {
    if (!url || url.startsWith('data:')) return url;

    // Para URLs de Unsplash, agregar parámetros de optimización
    if (url.includes('unsplash.com')) {
      const params = [
        'w=1600', // ancho máximo
        'q=80',   // calidad
        'fit=crop', // corte inteligente
        'fm=webp'  // formato
      ];

      const separator = url.includes('?') ? '&' : '?';
      return url + separator + params.join('&');
    }

    return url;
  }

  createPictureElement(url, alt, sizes = {}) {
    const picture = document.createElement('picture');

    // WebP source
    if (this.supportedFormats.webp) {
      const sourceWebP = document.createElement('source');
      sourceWebP.srcset = this.optimizeImageUrl(url);
      sourceWebP.type = 'image/webp';
      picture.appendChild(sourceWebP);
    }

    // Fallback JPEG
    const img = document.createElement('img');
    img.src = this.optimizeImageUrl(url);
    img.alt = alt;
    img.loading = 'lazy';

    if (sizes.width) img.width = sizes.width;
    if (sizes.height) img.height = sizes.height;

    picture.appendChild(img);

    return picture;
  }
}

// ── HERRAMIENTAS DE PERFORMANCE ─────────────────────────────────────────────
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
  }

  markStart(name) {
    performance.mark(`${name}-start`);
  }

  markEnd(name) {
    performance.mark(`${name}-end`);
    try {
      performance.measure(name, `${name}-start`, `${name}-end`);
      const measure = performance.getEntriesByName(name)[0];
      this.metrics[name] = measure.duration;
      console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
    } catch (e) {
      console.error('Error mediendo performance:', e);
    }
  }

  getMetrics() {
    return this.metrics;
  }

  reportWebVitals() {
    if ('web-vital' in window) {
      window.addEventListener('web-vital', (e) => {
        const {name, value} = e.detail;
        console.log(`📊 Web Vital: ${name} = ${value}`);
      });
    }
  }
}

// ── HELPERS PARA CONVERSIÓN DE MONEDA ───────────────────────────────────────
class CurrencyFormatter {
  constructor(locale = 'es-CO', currency = 'COP') {
    this.locale = locale;
    this.currency = currency;
  }

  format(amount) {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatPrice(amount, showCurrency = true) {
    const formatter = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    const formatted = formatter.format(amount);
    return showCurrency ? `$${formatted}` : formatted;
  }
}

// ── GESTIÓN DE ESTADO LOCAL ─────────────────────────────────────────────────
class LocalStateManager {
  constructor(storageKey = 'kcafe_landing_state') {
    this.storageKey = storageKey;
    this.state = this.loadState();
  }

  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Error loading state:', e);
      return {};
    }
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }

  get(key, defaultValue = null) {
    return this.state[key] || defaultValue;
  }

  set(key, value) {
    this.state[key] = value;
    this.saveState();
  }

  remove(key) {
    delete this.state[key];
    this.saveState();
  }

  clear() {
    this.state = {};
    localStorage.removeItem(this.storageKey);
  }
}

// ── UTILIDADES DE NOTIFICACIONES ────────────────────────────────────────────
class NotificationManager {
  constructor() {
    this.container = this.createContainer();
  }

  createContainer() {
    const container = document.createElement('div');
    container.className = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
    `;
    document.body.appendChild(container);
    return container;
  }

  show(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    
    const bgColor = {
      success: '#2D7A4F',
      error: '#C0392B',
      warning: '#F48C06',
      info: '#5B8DEE'
    }[type] || '#5B8DEE';

    notification.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease-out;
      font-family: 'Outfit', sans-serif;
    `;
    
    notification.textContent = message;
    this.container.appendChild(notification);

    if (duration > 0) {
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }, duration);
    }

    return notification;
  }

  success(message) { return this.show(message, 'success'); }
  error(message) { return this.show(message, 'error', 4000); }
  warning(message) { return this.show(message, 'warning'); }
  info(message) { return this.show(message, 'info'); }
}

// ── INICIALIZAR GLOBALES ────────────────────────────────────────────────────
const landing = {
  config: LANDING_CONFIG,
  images: new ImageOptimizer(LANDING_CONFIG.images),
  performance: new PerformanceMonitor(),
  currency: new CurrencyFormatter(),
  state: new LocalStateManager(),
  notifications: new NotificationManager(),

  // Helper para hacer reserva
  makeReservation(cabanaId) {
    const cabaña = LANDING_CONFIG.cabanas.find(c => c.id === cabanaId);
    if (!cabaña) {
      this.notifications.error('Cabaña no encontrada');
      return;
    }

    // Guardar en estado local
    this.state.set('selectedCabaña', cabanaId);
    this.state.set('lastReservationAttempt', new Date().toISOString());

    // Redirigir o abrir modal
    window.location.href = LANDING_CONFIG.urls.reservas;
  },

  // Helper para trackear evento
  trackEvent(name, data = {}) {
    console.log(`📊 Event: ${name}`, data);

    if (LANDING_CONFIG.analytics.enabled && window.gtag) {
      gtag('event', name, data);
    }
  }
};

// Exportar para uso global
window.LANDING = landing;

console.log('🌿 Kcafé Ancestral Landing Optimizer - Cargado');
console.log('Usar: window.LANDING para acceder a utilidades');
