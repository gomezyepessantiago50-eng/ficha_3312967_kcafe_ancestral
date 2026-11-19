# Kafe Ancestral · Sistema de reservas

Proyecto formativo del SENA (ficha 3312967). Aplicación web para consultar cabañas, paquetes y servicios, gestionar reservas y administrar la operación desde un panel separado.

| Vista | Ruta local | Función |
| --- | --- | --- |
| Sitio público | `/` | Información del alojamiento y su oferta. |
| Acceso | `/index.html` | Inicio de sesión y registro. |
| Cliente | `/cliente` | Consulta y gestión de reservas del cliente. |
| Administración | `/admin` | Gestión de reservas, clientes, cabañas, paquetes y servicios. |

## Inicio local

1. Instala Node.js **20.19 o posterior dentro de la rama 20**, npm y MySQL. Crea una base local vacía y un usuario con permisos sobre esa base.
2. Crea un archivo `.env` en la raíz. Usa los nombres y valores de ejemplo de la [guía de desarrollo](docs/desarrollo.md#configuración-local).
3. Desde la raíz, instala las dependencias y arranca la aplicación.

   ```bash
   npm ci
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000) o el puerto que indique la consola. Para arrancar sin el observador de archivos, usa `npm start`.

La base de datos comienza a conectarse al iniciar el servidor. El sitio público puede abrir antes de que la API esté lista. Para cargar datos de demostración, sigue las indicaciones de la [guía de desarrollo](docs/desarrollo.md#base-de-demostración).

## Estructura

| Ruta | Contenido |
| --- | --- |
| [`public/`](public/) | Páginas HTML, JavaScript del navegador, estilos y recursos. |
| [`src/app.js`](src/app.js) | Configuración de Express, páginas y rutas de la API. |
| [`src/server.js`](src/server.js) | Arranque, conexión a la base y mantenimiento de reservas. |
| [`src/routes/`](src/routes/) y [`src/controllers/`](src/controllers/) | Entrada HTTP y coordinación de las solicitudes. |
| [`src/services/`](src/services/) y [`src/models/`](src/models/) | Reglas de aplicación y modelos de Sequelize. |
| [`src/database/`](src/database/) | Configuración de MySQL y carga de datos de demostración. |

[Guía de desarrollo y verificación local](docs/desarrollo.md)
