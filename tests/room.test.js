const request = require('supertest');

// ─── Mock COMPLETO de los modelos ANTES de cargar app ────────────────────────
jest.mock('../src/models', () => ({
  Clientes:       {
    findAll:  jest.fn(),
    findByPk: jest.fn(),
  },
  Habitacion:     {
    findAll:  jest.fn(),
    findByPk: jest.fn(),
    create:   jest.fn(),
  },
  Cabanas:        {},
  Reserva:        { findAll: jest.fn() },
  EstadosReserva: {},
}));

// Se carga la app DESPUÉS del mock
const app = require('../src/app');

// ─── Datos de prueba ──────────────────────────────────────────────────────────
const habitacionMock = {
  IDHabitacion:     1,
  NombreHabitacion: 'Habitación Bosque',
  Descripcion:      'Rodeada de naturaleza',
  Costo:            180000,
  Estado:           true,
};

const cabanaMock = {
  IDCabana:    1,
  NombreCabana:'Cabaña Aurora',
  Capacidad:   4,
  Ubicacion:   'Zona A',
  PrecioNoche: 350000,
  Estado:      true,
};

const { Habitacion } = require('../src/models');

// ─── GET /api/habitaciones ────────────────────────────────────────────────────
describe('GET /api/habitaciones', () => {
  it('retorna lista de habitaciones con status 200', async () => {
    Habitacion.findAll.mockResolvedValue([habitacionMock]);

    const res = await request(app).get('/api/habitaciones');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].NombreHabitacion).toBe('Habitación Bosque');
  });

  it('retorna arreglo vacío si no hay habitaciones', async () => {
    Habitacion.findAll.mockResolvedValue([]);

    const res = await request(app).get('/api/habitaciones');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─── GET /api/habitaciones/:id ────────────────────────────────────────────────
describe('GET /api/habitaciones/:id', () => {
  it('retorna la habitación con sus cabañas', async () => {
    Habitacion.findByPk.mockResolvedValue({ ...habitacionMock, cabanas: [cabanaMock] });

    const res = await request(app).get('/api/habitaciones/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.IDHabitacion).toBe(1);
    expect(res.body.data.cabanas).toHaveLength(1);
  });

  it('retorna 404 si la habitación no existe', async () => {
    Habitacion.findByPk.mockResolvedValue(null);

    const res = await request(app).get('/api/habitaciones/999');

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Habitación no encontrada.');
  });
});

// ─── POST /api/habitaciones ───────────────────────────────────────────────────
describe('POST /api/habitaciones', () => {
  it('crea una habitación correctamente', async () => {
    Habitacion.create.mockResolvedValue({ ...habitacionMock, IDHabitacion: 2 });

    const res = await request(app)
      .post('/api/habitaciones')
      .send({
        NombreHabitacion: 'Habitación Bosque',
        Descripcion:      'Rodeada de naturaleza',
        Costo:            180000,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Habitación creada correctamente.');
  });

  it('retorna 400 si faltan campos obligatorios', async () => {
    const res = await request(app)
      .post('/api/habitaciones')
      .send({ NombreHabitacion: 'Solo nombre' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 si el Costo es negativo', async () => {
    const res = await request(app)
      .post('/api/habitaciones')
      .send({ NombreHabitacion: 'Test', Descripcion: 'Desc', Costo: -5000 });

    expect(res.statusCode).toBe(400);
  });

  it('retorna 400 si el NombreHabitacion supera 30 caracteres', async () => {
    const res = await request(app)
      .post('/api/habitaciones')
      .send({ NombreHabitacion: 'A'.repeat(31), Descripcion: 'Desc', Costo: 100000 });

    expect(res.statusCode).toBe(400);
  });
});

// ─── PUT /api/habitaciones/:id ────────────────────────────────────────────────
describe('PUT /api/habitaciones/:id', () => {
  it('actualiza la habitación correctamente', async () => {
    Habitacion.findByPk.mockResolvedValue({
      ...habitacionMock,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .put('/api/habitaciones/1')
      .send({ Costo: 200000 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Habitación actualizada correctamente.');
  });

  it('retorna 400 si el Costo es inválido', async () => {
    const res = await request(app)
      .put('/api/habitaciones/1')
      .send({ Costo: -100 });

    expect(res.statusCode).toBe(400);
  });

  it('retorna 404 si la habitación no existe', async () => {
    Habitacion.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/habitaciones/999')
      .send({ Costo: 200000 });

    expect(res.statusCode).toBe(404);
  });
});

// ─── DELETE /api/habitaciones/:id ────────────────────────────────────────────
describe('DELETE /api/habitaciones/:id', () => {
  it('elimina una habitación sin cabañas activas', async () => {
    Habitacion.findByPk.mockResolvedValue({
      ...habitacionMock,
      cabanas: [],
      destroy: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).delete('/api/habitaciones/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Habitación eliminada correctamente.');
  });

  it('retorna 409 si tiene cabañas activas', async () => {
    Habitacion.findByPk.mockResolvedValue({
      ...habitacionMock,
      cabanas: [cabanaMock],
      destroy: jest.fn(),
    });

    const res = await request(app).delete('/api/habitaciones/1');

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('retorna 404 si la habitación no existe', async () => {
    Habitacion.findByPk.mockResolvedValue(null);

    const res = await request(app).delete('/api/habitaciones/999');

    expect(res.statusCode).toBe(404);
  });
});

// ─── PATCH /api/habitaciones/:id/estado ──────────────────────────────────────
describe('PATCH /api/habitaciones/:id/estado', () => {
  it('cambia el estado a false correctamente', async () => {
    Habitacion.findByPk.mockResolvedValue({
      ...habitacionMock,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .patch('/api/habitaciones/1/estado')
      .send({ Estado: false });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retorna 400 si Estado no es booleano', async () => {
    const res = await request(app)
      .patch('/api/habitaciones/1/estado')
      .send({ Estado: 'activo' });

    expect(res.statusCode).toBe(400);
  });

  it('retorna 400 si Estado no se envía', async () => {
    const res = await request(app)
      .patch('/api/habitaciones/1/estado')
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it('retorna 404 si la habitación no existe', async () => {
    Habitacion.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/habitaciones/999/estado')
      .send({ Estado: false });

    expect(res.statusCode).toBe(404);
  });
});
