// services/email.service.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envía un correo de confirmación de reserva al cliente.
 * @param {Object} params
 * @param {string} params.to          - Email del cliente
 * @param {string} params.nombre      - Nombre del cliente
 * @param {Object} params.reserva     - Datos de la reserva normalizada
 */
const enviarConfirmacionReserva = async ({ to, nombre, reserva }) => {
  const {
    id,
    fecha_inicio,
    fecha_fin,
    cabana,
    paquete,
    num_personas,
    monto_total,
    metodo_pago,
    notas,
  } = reserva;

  const metodoPagoTexto = {
    1: 'Efectivo',
    2: 'Transferencia',
    3: 'Tarjeta de crédito',
    4: 'Nequi',
  }[metodo_pago] || 'No especificado';

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background-color:#f4f1ec;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f1ec;padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #2d1b0e 0%, #5c3a1e 100%);padding:40px 40px 30px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:28px;font-weight:700;letter-spacing:1px;">☕ Kafe Ancestral</h1>
                <p style="margin:8px 0 0;color:#d4a574;font-size:14px;letter-spacing:2px;text-transform:uppercase;">Reserva Confirmada</p>
              </td>
            </tr>

            <!-- Saludo -->
            <tr>
              <td style="padding:30px 40px 10px;">
                <p style="margin:0;color:#2d1b0e;font-size:18px;font-weight:600;">¡Hola ${nombre || 'Cliente'}! 👋</p>
                <p style="margin:10px 0 0;color:#5c4a3a;font-size:15px;line-height:1.6;">
                  Tu reserva ha sido registrada exitosamente. A continuación los detalles:
                </p>
              </td>
            </tr>

            <!-- Detalles de la reserva -->
            <tr>
              <td style="padding:20px 40px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#faf6f1;border-radius:12px;border:1px solid #e8ddd0;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 16px;color:#2d1b0e;font-size:16px;font-weight:600;border-bottom:2px solid #d4a574;padding-bottom:10px;">
                        📋 Detalles de tu Reserva #${id}
                      </p>
                      
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;width:40%;">📅 Check-in</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${fecha_inicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">📅 Check-out</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${fecha_fin}</td>
                        </tr>
                        ${cabana ? `
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">🏡 Cabaña</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${cabana}</td>
                        </tr>` : ''}
                        ${paquete ? `
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">📦 Paquete</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${paquete}</td>
                        </tr>` : ''}
                        ${num_personas ? `
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">👥 Personas</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${num_personas}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">💳 Método de pago</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${metodoPagoTexto}</td>
                        </tr>
                        ${notas ? `
                        <tr>
                          <td style="padding:8px 0;color:#8a7568;font-size:14px;">📝 Notas</td>
                          <td style="padding:8px 0;color:#2d1b0e;font-size:14px;font-weight:600;">${notas}</td>
                        </tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Monto total -->
            <tr>
              <td style="padding:0 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #2d1b0e 0%, #5c3a1e 100%);border-radius:12px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color:#d4a574;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Total a pagar</td>
                          <td align="right" style="color:#f5e6d3;font-size:28px;font-weight:700;">$${Number(monto_total).toLocaleString('es-CO')}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Estado -->
            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <span style="display:inline-block;background-color:#fff3cd;color:#856404;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:600;">
                  ⏳ Estado: Pendiente de confirmación
                </span>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#faf6f1;padding:24px 40px;border-top:1px solid #e8ddd0;text-align:center;">
                <p style="margin:0;color:#8a7568;font-size:13px;line-height:1.6;">
                  Si tienes alguna pregunta, no dudes en contactarnos.<br>
                  <strong style="color:#5c3a1e;">☕ Kafe Ancestral</strong> — Tu experiencia, nuestra pasión.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Kafe Ancestral <onboarding@resend.dev>',
      to: [to],
      subject: `☕ Reserva #${id} - Confirmación | Kafe Ancestral`,
      html,
    });

    if (error) {
      console.error('Error al enviar email con Resend:', error);
      return { enviado: false, error: error.message };
    }

    console.log('Email de reserva enviado correctamente:', data);
    return { enviado: true, id: data.id };
  } catch (err) {
    console.error('Error inesperado al enviar email:', err.message);
    return { enviado: false, error: err.message };
  }
};

module.exports = {
  enviarConfirmacionReserva,
};
