# Desarrollo local · Kafe Ancestral

## Configuración local

Ejemplo para un archivo `.env` en la raíz. Sustituye los valores de ejemplo con los de tu entorno local. Git ignora este archivo.

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kcafe_local
DB_USER=kcafe_local
DB_PASS=REEMPLAZAR_CON_CLAVE_LOCAL
JWT_SECRET=REEMPLAZAR_CON_UN_SECRETO_ALEATORIO
PORT=3000
NODE_ENV=development
```

| Variable adicional | Uso |
| --- | --- |
| `JWT_EXPIRES_IN` | Duración de sesión. El valor predeterminado del servicio es `8h`. |
| `RESEND_API_KEY`, `MAIL_FROM` | Envío de correo y remitente. Si no configuras Resend, el servicio simula el envío y lo registra en consola. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout y validación de eventos. Usa credenciales de prueba durante el desarrollo. |

El acceso con Google tiene configuración propia en el [servicio de autenticación](../src/services/auth.service.js). Para la primera prueba local usa el registro e inicio de sesión por correo.

## Base de demostración

Usa una base de datos local que puedas descartar. Al iniciar, Sequelize sincroniza el esquema y el servidor ejecuta tareas de mantenimiento de reservas. El [script de datos de demostración](../src/database/seed.js) **vacía tablas y carga datos de ejemplo**. Revisa `DB_NAME` y `DB_HOST` antes de ejecutarlo.

```bash
node src/database/seed.js
```

## Mapa de la API

Las rutas se montan en [`src/app.js`](../src/app.js). Consulta los archivos de [`src/routes/`](../src/routes/) para ver los métodos, validaciones y permisos de cada operación.

| Prefijo | Módulo |
| --- | --- |
| `/api/auth`, `/api/usuarios` | Autenticación y cuentas. |
| `/api/reservas`, `/api/pagos` | Reservas y flujos de pago. |
| `/api/cabanas`, `/api/paquetes`, `/api/servicios` | Catálogo del alojamiento. |
| `/api/dashboard`, `/api/clientes` | Gestión administrativa y clientes. |

## Verificación manual

1. Abre `/` y comprueba que la página pública cargue.
2. Registra una cuenta de prueba e inicia sesión desde `/index.html`.
3. Con una cabaña de ejemplo disponible, crea una reserva de prueba y verifica que aparezca en la vista de cliente.
4. Con una cuenta de administración del entorno de prueba, revisa la reserva desde `/admin`.

Si la API devuelve `503` al arrancar, revisa en consola si MySQL se conectó y si terminó la sincronización. Si aparece un error de dependencias, verifica la versión de Node y vuelve a instalar con `npm ci`. El proyecto declara `npm run dev` y `npm start` en [`package.json`](../package.json).
