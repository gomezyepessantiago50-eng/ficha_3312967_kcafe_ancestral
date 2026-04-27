# Landing Page Kcafé Ancestral

## 📋 Descripción

Landing page profesional, moderna y visualmente atractiva para Kcafé Ancestral - una plataforma de hospedaje tipo glamping en cabañas naturales.

## 🎯 Características

### Diseño
- **Responsivo**: Adaptable a móviles, tablets y escritorio
- **Moderno**: Estética minimalista con enfoque ecológico
- **Inmersivo**: Scroll vertical fluido con animaciones suaves
- **Accesible**: Cumple con estándares WCAG 2.1

### Secciones
1. **Hero Section** - Imagen impactante con CTA principal
2. **Quiénes Somos** - Información de la empresa y valores
3. **Nuestras Cabañas** - Galería de 4 cabañas con características
4. **Experiencia** - Beneficios y características únicas
5. **Galería Visual** - Fotos inmersivas del entorno
6. **Paquetes** - Ofertas: Romántico, Familiar, Aventura
7. **Testimonios** - Reseñas de huéspedes
8. **CTA Final** - Llamado a la acción final
9. **Footer** - Información de contacto y links

## 🚀 Inicio Rápido

### Archivos Principales
- `landing.html` - Estructura HTML semántica
- `css/landing.css` - Estilos modernos y responsive
- `js/landing.js` - Interactividad y animaciones

### Estructura de Archivos
```
public/
├── landing.html
├── css/
│   ├── variables.css (existente)
│   ├── reset.css (existente)
│   ├── styles.css (existente)
│   └── landing.css (nuevo)
├── js/
│   └── landing.js (nuevo)
└── assets/
    ├── images/
    │   ├── landing/ (para imágenes específicas)
    │   └── testimonios/ (para fotos de clientes)
    └── icons/
        └── features/ (para iconos de características)
```

## 🎨 Sistema de Diseño

### Paleta de Colores
- **Fire**: #E85D04 (CTA principal)
- **Amber**: #F48C06 (Acentos cálidos)
- **Earth**: #8B5E3C (Texto principal)
- **Bone**: #FAF7F2 (Fondos claros)
- **Bark**: #2E1A0E (Textos oscuros)

### Tipografía
- **Display**: Fraunces (elegante, serif)
- **Body**: Outfit (legible, sans-serif)

### Espaciado
- Máximo ancho: 1280px
- Padding: 1.5rem en mobile, escalable en desktop
- Gap grid: 2.5rem en secciones principales

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: > 768px

### Características Responsive
- Menú hamburguesa en mobile
- Grid fluido que se adapta automáticamente
- Imágenes optimizadas con aspect-ratio
- Tipografía escalable con clamp()

## ⚡ Optimizaciones

### Performance
- Lazy loading de imágenes
- Preload de imágenes críticas
- CSS minificado
- JavaScript asíncrono
- Uso de Unsplash CDN para imágenes

### Mejoras Futuras
1. Reemplazar URLs de Unsplash con imágenes locales optimizadas
2. Implementar WebP con fallback
3. Agregar service worker para PWA
4. Optimizar CLS (Cumulative Layout Shift)

## 🔄 Uso de Imágenes

Actualmente usa Unsplash CDN. Para usar imágenes locales:

1. **Optimizar imágenes** (máx 1600x900px)
```bash
# Usando ImageMagick
mogrify -resize 1600x900 -quality 80 *.jpg
```

2. **Crear WebP** para mejor compresión
```bash
cwebp -q 80 imagen.jpg -o imagen.webp
```

3. **Actualizar HTML**
```html
<picture>
  <source srcset="imagen.webp" type="image/webp">
  <img src="imagen.jpg" alt="Descripción">
</picture>
```

## 🎯 Funcionalidades JavaScript

### Menú Mobile
- Toggle del menú hamburguesa
- Cierre al hacer click en enlace
- Cierre al hacer click fuera

### Animaciones
- Fade-in al hacer scroll
- Hover effects en tarjetas
- Animaciones de entrada en hero

### Interactividad
- Botones con feedback visual
- Smooth scroll a secciones
- Preload de imágenes críticas
- Tracking de eventos (integración GA)

## 📊 Analytics

Se pueden integrar fácilmente eventos de tracking:
```javascript
trackEvent('reserva_click', {
  button_location: 'hero',
  timestamp: new Date()
});
```

## 🔗 Enlaces y CTAs

### Botones Principales
- "Reservar Ahora" (Hero)
- "Ver Disponibilidad" (Hero)
- "Seleccionar Paquete" (Paquetes)
- "Reserva tu experiencia ahora" (Final CTA)

Estos necesitarán ser vinculados a:
- Página de reservas del sistema
- API de disponibilidad
- Dashboard de reservas

## 🛠️ Personalización

### Cambiar Colores
Editar `public/css/variables.css`:
```css
:root {
  --fire: #E85D04;
  --amber: #F48C06;
  /* ... más variables */
}
```

### Cambiar Contenido de Cabañas
Editar sección en `landing.html` (búscar "CABAÑA 1", etc.)

### Cambiar Información de Contacto
Búscar "info@kcafeancestral.com" y "+57 (300) 123-4567"

## 📋 Checklist de Implementación

- [ ] Reemplazar URLs de Unsplash con imágenes locales
- [ ] Actualizar información de contacto real
- [ ] Configurar Google Analytics
- [ ] Implementar formulario de contacto/newsletter
- [ ] Agregar certificados SSL
- [ ] Configurar CDN para imágenes
- [ ] Testing en navegadores reales
- [ ] Lighthouse audit (objetivo: >90)
- [ ] SEO: Meta descriptions, Open Graph
- [ ] Crear página de política de privacidad

## 🔍 Testing

### Navegadores Soportados
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance Targets
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

## 📚 Recursos Utilizados

- **Imágenes**: Unsplash (dominio público)
- **Tipografía**: Google Fonts
- **Iconos**: Emojis Unicode
- **Inspiración**: Hotel Dann Carlton

## 📞 Soporte

Para actualizar contenido o reportar problemas, contactar al equipo de desarrollo.

---

**Última actualización**: Abril 2024
**Versión**: 1.0.0
