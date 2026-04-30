const request = require('supertest');

// ─── Mock COMPLETO de los modelos ANTES de cargar app ────────────────────────
// Se mockea el módulo completo para evitar que Sequelize intente
// ejecutar asociaciones reales durante los tests
jest.mock('../src/models', () => ({
  Clientes:       {
    findAll:  jest.fn(),
    findByPk: jest.fn(),
    update:   jest.fn(),
  },
  Reserva:        { findAll: jest.fn() },
  EstadosReserva: {},
}));

// Se carga la app DESPUÉS del mock
const app = require('../src/app');

// ─── Datos de prueba ──────────────────────────────────────────────────────────
const clienteMock = {
  NroDocumento: '123456789',
  Nombre:       'Johan',
  Apellido:     'Diez',
  Email:        'johan@email.com',
  Telefono:     '3001234567',
  Direccion:    'Calle 10 #20-30',
  Estado:       true,
};

const reservaMock = {
  IdReserva:         1,
  FechaInicio:       '2024-06-01',
  FechaFinalizacion: '2024-06-05',
  MontoTotal:        350000,
  estadoReserva:     { NombreEstadoReserva: 'Confirmada' },
};

// Importa los mocks ya inicializados
const { Clientes, Reserva } = require('../src/models');

// ─── GET /api/clientes ────────────────────────────────────────────────────────
describe('GET /api/clientes', () => {
  it('retorna lista de clientes con status 200', async () => {
    Clientes.findAll.mockResolvedValue([clienteMock]);

    const res = await request(app).get('/api/clientes');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].NroDocumento).toBe('123456789');
  });

  it('retorna arreglo vacío si no hay clientes', async () => {
    Clientes.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/clientes');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─── GET /api/clientes/search ─────────────────────────────────────────────────
describe('GET /api/clientes/search', () => {
  it('retorna clientes que coincidan con la búsqueda', async () => {
    Clientes.findAll.mockResolvedValue([clienteMock]);

    const res = await request(app).get('/api/clientes/search?q=Johan');

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].Nombre).toBe('Johan');
  });

  it('retorna 400 si no se envía el parámetro q', async () => {
    const res = await request(app).get('/api/clientes/search');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna arreglo vacío si no hay coincidencias', async () => {
    Clientes.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/clientes/search?q=xxxxx');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─── GET /api/clientes/:nroDocumento ─────────────────────────────────────────
describe('GET /api/clientes/:nroDocumento', () => {
  it('retorna el perfil con reservas del cliente', async () => {
    Clientes.findByPk.mockResolvedValue({ ...clienteMock, reservas: [reservaMock] });

    const res = await request(app).get('/api/clientes/123456789');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.NroDocumento).toBe('123456789');
  });

  it('retorna 404 si el cliente no existe', async () => {
    Clientes.findByPk.mockResolvedValue(null);

    const res = await request(app).get('/api/clientes/000000000');

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Cliente no encontrado.');
  });
});

// ─── GET /api/clientes/:nroDocumento/historial ────────────────────────────────
describe('GET /api/clientes/:nroDocumento/historial', () => {
  it('retorna historial de reservas del cliente', async () => {
    Clientes.findByPk.mockResolvedValue(clienteMock);
    Reserva.findAll.mockResolvedValue([reservaMock]);

    const res = await request(app).get('/api/clientes/123456789/historial');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('cliente');
    expect(res.body.data).toHaveProperty('reservas');
  });

  it('retorna 404 si el cliente no existe', async () => {
    Clientes.findByPk.mockResolvedValue(null);

    const res = await request(app).get('/api/clientes/000000000/historial');

    expect(res.statusCode).toBe(404);
  });
});

// ─── PUT /api/clientes/:nroDocumento ─────────────────────────────────────────
describe('PUT /api/clientes/:nroDocumento', () => {
  it('actualiza datos del cliente correctamente', async () => {
    Clientes.findByPk.mockResolvedValue({
      ...clienteMock,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .put('/api/clientes/123456789')
      .send({ Telefono: '3109876543' });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Cliente actualizado correctamente.');
  });

  it('retorna 400 si el Email tiene formato inválido', async () => {
    const res = await request(app)
      .put('/api/clientes/123456789')
      .send({ Email: 'correo_invalido' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 si el Nombre supera los 50 caracteres', async () => {
    const res = await request(app)
      .put('/api/clientes/123456789')
      .send({ Nombre: 'A'.repeat(51) });

    expect(res.statusCode).toBe(400);
  });

  it('retorna 404 si el cliente no existe', async () => {
    Clientes.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/clientes/999999999')
      .send({ Nombre: 'Nuevo' });

    expect(res.statusCode).toBe(404);
  });
});
