// ============================================================
//  KAFE ANCESTRAL — main.js
//  Lógica del frontend: consumo de la API para
//  Clientes y Habitaciones
// ============================================================

const API_BASE = '/api';

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de alerta en pantalla
 * @param {string} mensaje
 * @param {'success'|'error'} tipo
 * @param {string} contenedorId - id del div donde mostrar el mensaje
 */
function mostrarAlerta(mensaje, tipo, contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="alerta alerta--${tipo}">
      ${mensaje}
    </div>
  `;

  setTimeout(() => { contenedor.innerHTML = ''; }, 4000);
}

/**
 * Hace fetch a la API y retorna el JSON
 * @param {string} url
 * @param {object} opciones - opciones del fetch
 */
async function apiFetch(url, opciones = {}) {
  const respuesta = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  return respuesta.json();
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

/**
 * Carga y renderiza la tabla de clientes
 */
async function cargarClientes() {
  const data = await apiFetch('/clientes');

  if (!data.success) {
    mostrarAlerta('Error al cargar los clientes.', 'error', 'alerta-clientes');
    return;
  }

  const tbody = document.getElementById('tabla-clientes-body');
  if (!tbody) return;

  if (data.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No hay clientes registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = data.data.map((c) => `
    <tr>
      <td>${c.NroDocumento}</td>
      <td>${c.Nombre} ${c.Apellido}</td>
      <td>${c.Email}</td>
      <td>${c.Telefono}</td>
      <td>${c.Estado ? 'Activo' : 'Inactivo'}</td>
      <td>
        <button onclick="verCliente('${c.NroDocumento}')">Ver</button>
        <button onclick="abrirModalEditarCliente('${c.NroDocumento}')">Editar</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Busca clientes por nombre o correo
 * @param {string} q - texto de búsqueda
 */
async function buscarClientes(q) {
  if (!q || q.trim() === '') {
    cargarClientes();
    return;
  }

  const data = await apiFetch(`/clientes/search?q=${encodeURIComponent(q)}`);

  if (!data.success) {
    mostrarAlerta('Error al buscar clientes.', 'error', 'alerta-clientes');
    return;
  }

  const tbody = document.getElementById('tabla-clientes-body');
  if (!tbody) return;

  if (data.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No se encontraron resultados.</td></tr>';
    return;
  }

  tbody.innerHTML = data.data.map((c) => `
    <tr>
      <td>${c.NroDocumento}</td>
      <td>${c.Nombre} ${c.Apellido}</td>
      <td>${c.Email}</td>
      <td>${c.Telefono}</td>
      <td>${c.Estado ? 'Activo' : 'Inactivo'}</td>
      <td>
        <button onclick="verCliente('${c.NroDocumento}')">Ver</button>
        <button onclick="abrirModalEditarCliente('${c.NroDocumento}')">Editar</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Carga y muestra el perfil de un cliente con su historial
 * @param {string} nroDocumento
 */
async function verCliente(nroDocumento) {
  const data = await apiFetch(`/clientes/${nroDocumento}`);

  if (!data.success) {
    mostrarAlerta('Cliente no encontrado.', 'error', 'alerta-clientes');
    return;
  }

  const c = data.data;

  const perfil = document.getElementById('perfil-cliente');
  if (!perfil) return;

  const reservasHTML = c.reservas && c.reservas.length > 0
    ? c.reservas.map((r) => `
        <tr>
          <td>${r.IdReserva}</td>
          <td>${r.FechaInicio}</td>
          <td>${r.FechaFinalizacion}</td>
          <td>$${r.MontoTotal?.toLocaleString('es-CO')}</td>
          <td>${r.estadoReserva?.NombreEstadoReserva ?? 'N/A'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5">Sin reservas registradas.</td></tr>';

  perfil.innerHTML = `
    <h3>${c.Nombre} ${c.Apellido}</h3>
    <p><strong>Documento:</strong> ${c.NroDocumento}</p>
    <p><strong>Email:</strong> ${c.Email}</p>
    <p><strong>Teléfono:</strong> ${c.Telefono}</p>
    <p><strong>Dirección:</strong> ${c.Direccion}</p>
    <p><strong>Estado:</strong> ${c.Estado ? 'Activo' : 'Inactivo'}</p>
    <h4>Historial de Reservas</h4>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Inicio</th><th>Fin</th><th>Total</th><th>Estado</th>
        </tr>
      </thead>
      <tbody>${reservasHTML}</tbody>
    </table>
  `;
}

/**
 * Envía el formulario de edición de cliente
 * @param {string} nroDocumento
 */
async function editarCliente(nroDocumento) {
  const body = {
    Nombre:    document.getElementById('edit-nombre')?.value,
    Apellido:  document.getElementById('edit-apellido')?.value,
    Email:     document.getElementById('edit-email')?.value,
    Telefono:  document.getElementById('edit-telefono')?.value,
    Direccion: document.getElementById('edit-direccion')?.value,
  };

  const data = await apiFetch(`/clientes/${nroDocumento}`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  });

  if (data.success) {
    mostrarAlerta('Cliente actualizado correctamente.', 'success', 'alerta-clientes');
    cargarClientes();
  } else {
    mostrarAlerta(data.message || 'Error al actualizar.', 'error', 'alerta-clientes');
  }
}

// ─── HABITACIONES ─────────────────────────────────────────────────────────────

/**
 * Carga y renderiza la tabla de habitaciones
 */
async function cargarHabitaciones() {
  const data = await apiFetch('/habitaciones');

  if (!data.success) {
    mostrarAlerta('Error al cargar las habitaciones.', 'error', 'alerta-habitaciones');
    return;
  }

  const tbody = document.getElementById('tabla-habitaciones-body');
  if (!tbody) return;

  if (data.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay habitaciones registradas.</td></tr>';
    return;
  }

  tbody.innerHTML = data.data.map((h) => `
    <tr>
      <td>${h.IDHabitacion}</td>
      <td>${h.NombreHabitacion}</td>
      <td>${h.Descripcion}</td>
      <td>$${h.Costo?.toLocaleString('es-CO')}</td>
      <td>${h.Estado ? 'Disponible' : 'No disponible'}</td>
      <td>
        <button onclick="verHabitacion(${h.IDHabitacion})">Ver</button>
        <button onclick="abrirModalEditarHabitacion(${h.IDHabitacion})">Editar</button>
        <button onclick="cambiarEstadoHabitacion(${h.IDHabitacion}, ${!h.Estado})">
          ${h.Estado ? 'Deshabilitar' : 'Habilitar'}
        </button>
        <button onclick="eliminarHabitacion(${h.IDHabitacion})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Carga el detalle de una habitación y sus cabañas
 * @param {number} id
 */
async function verHabitacion(id) {
  const data = await apiFetch(`/habitaciones/${id}`);

  if (!data.success) {
    mostrarAlerta('Habitación no encontrada.', 'error', 'alerta-habitaciones');
    return;
  }

  const h = data.data;

  const detalle = document.getElementById('detalle-habitacion');
  if (!detalle) return;

  const cabanasHTML = h.cabanas && h.cabanas.length > 0
    ? h.cabanas.map((c) => `
        <tr>
          <td>${c.IDCabana}</td>
          <td>${c.NombreCabana}</td>
          <td>${c.Capacidad}</td>
          <td>${c.Ubicacion}</td>
          <td>$${c.PrecioNoche?.toLocaleString('es-CO')}</td>
          <td>${c.Estado ? 'Activa' : 'Inactiva'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="6">Sin cabañas asociadas.</td></tr>';

  detalle.innerHTML = `
    <h3>${h.NombreHabitacion}</h3>
    <p><strong>Descripción:</strong> ${h.Descripcion}</p>
    <p><strong>Costo:</strong> $${h.Costo?.toLocaleString('es-CO')}</p>
    <p><strong>Estado:</strong> ${h.Estado ? 'Disponible' : 'No disponible'}</p>
    <h4>Cabañas asociadas</h4>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Nombre</th><th>Capacidad</th>
          <th>Ubicación</th><th>Precio/Noche</th><th>Estado</th>
        </tr>
      </thead>
      <tbody>${cabanasHTML}</tbody>
    </table>
  `;
}

/**
 * Crea una nueva habitación
 */
async function crearHabitacion() {
  const body = {
    NombreHabitacion: document.getElementById('nueva-nombre')?.value,
    Descripcion:      document.getElementById('nueva-descripcion')?.value,
    Costo:            parseFloat(document.getElementById('nueva-costo')?.value),
  };

  const data = await apiFetch('/habitaciones', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

  if (data.success) {
    mostrarAlerta('Habitación creada correctamente.', 'success', 'alerta-habitaciones');
    cargarHabitaciones();
  } else {
    mostrarAlerta(data.message || 'Error al crear.', 'error', 'alerta-habitaciones');
  }
}

/**
 * Edita los datos de una habitación
 * @param {number} id
 */
async function editarHabitacion(id) {
  const body = {
    NombreHabitacion: document.getElementById('edit-hab-nombre')?.value,
    Descripcion:      document.getElementById('edit-hab-descripcion')?.value,
    Costo:            parseFloat(document.getElementById('edit-hab-costo')?.value),
  };

  const data = await apiFetch(`/habitaciones/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  });

  if (data.success) {
    mostrarAlerta('Habitación actualizada correctamente.', 'success', 'alerta-habitaciones');
    cargarHabitaciones();
  } else {
    mostrarAlerta(data.message || 'Error al actualizar.', 'error', 'alerta-habitaciones');
  }
}

/**
 * Cambia el estado disponible/no disponible de una habitación
 * @param {number} id
 * @param {boolean} nuevoEstado
 */
async function cambiarEstadoHabitacion(id, nuevoEstado) {
  const data = await apiFetch(`/habitaciones/${id}/estado`, {
    method: 'PATCH',
    body:   JSON.stringify({ Estado: nuevoEstado }),
  });

  if (data.success) {
    mostrarAlerta(data.message, 'success', 'alerta-habitaciones');
    cargarHabitaciones();
  } else {
    mostrarAlerta(data.message || 'Error al cambiar estado.', 'error', 'alerta-habitaciones');
  }
}

/**
 * Elimina una habitación tras confirmación
 * @param {number} id
 */
async function eliminarHabitacion(id) {
  const confirmar = confirm('¿Estás seguro de que deseas eliminar esta habitación?');
  if (!confirmar) return;

  const data = await apiFetch(`/habitaciones/${id}`, { method: 'DELETE' });

  if (data.success) {
    mostrarAlerta('Habitación eliminada correctamente.', 'success', 'alerta-habitaciones');
    cargarHabitaciones();
  } else {
    mostrarAlerta(data.message || 'Error al eliminar.', 'error', 'alerta-habitaciones');
  }
}

// ─── EVENTOS AL CARGAR EL DOM ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Cargar tablas si los elementos existen en la página
  if (document.getElementById('tabla-clientes-body'))     cargarClientes();
  if (document.getElementById('tabla-habitaciones-body')) cargarHabitaciones();

  // Buscador de clientes
  const inputBuscar = document.getElementById('buscar-cliente');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', (e) => buscarClientes(e.target.value));
  }

  // Formulario crear habitación
  const formCrear = document.getElementById('form-crear-habitacion');
  if (formCrear) {
    formCrear.addEventListener('submit', (e) => {
      e.preventDefault();
      crearHabitacion();
    });
  }
});
