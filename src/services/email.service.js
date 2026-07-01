// services/email.service.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

// Si no hay API KEY real configurada, mandamos un aviso y evitamos que falle pero no se enviarán los correos.
const MAIL_CONFIGURED = !!process.env.RESEND_API_KEY;

let transporter;

if (!MAIL_CONFIGURED) {
  console.warn('[Email Service] ⚠ RESEND_API_KEY no configurado. Los correos se simularán (bypass).');
  transporter = {
    sendMail: async (opts) => {
      console.log(`[Email Service] (BYPASS) Simulando envío a ${opts.to} — asunto: ${opts.subject}`);
      return { messageId: 'bypass-' + Date.now() };
    }
  };
} else {
  console.log('[Email Service] ✅ Resend configurado. Listo para enviar correos vía HTTP.');
  transporter = {
    sendMail: async (opts) => {
      // Convertir el payload de nodemailer al formato de Resend
      const { data, error } = await resend.emails.send({
        from: opts.from || defaultFrom,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        reply_to: 'infokcafeancestral@gmail.com'
      });

      if (error) {
        throw new Error(`Resend Error: ${error.message}`);
      }
      return { messageId: data.id };
    }
  };
}

const defaultFrom = `"Kafe Ancestral" <${process.env.MAIL_FROM || 'info@kcafeancestral.com'}>`;

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

  const metodos = {
    'tarjeta': 'Tarjeta de Crédito / Débito',
    'nequi': 'Nequi / Daviplata',
    'pse': 'PSE',
    'efectivo': 'Efectivo en Recepción',
    1: 'Efectivo',
    2: 'Transferencia',
    3: 'Tarjeta de crédito',
    4: 'Nequi'
  };
  const metodoPagoTexto = metodos[metodo_pago] || (metodo_pago ? String(metodo_pago).charAt(0).toUpperCase() + String(metodo_pago).slice(1) : 'No especificado');

  const cabanasMap = { '1': 'El Roble', '2': 'La Ceiba', '3': 'Ancestral' };
  const paquetesMap = { '1': 'Viaje Familiar', '2': 'Experiencia Cafetera', '3': 'Paquete Premium' };
  const serviciosExtraMap = { 'spa': 'Spa', 'fogata': 'Fogata', 'transporte': 'Transporte', 'fotografia': 'Fotografía' };
  
  const cabanaNombre = cabanasMap[String(cabana)] || cabana;
  const paqueteNombre = paquetesMap[String(paquete)] || paquete;

  let htmlServicios = '';
  if (reserva.servicios) {
    let srvs = [];
    try { srvs = typeof reserva.servicios === 'string' ? JSON.parse(reserva.servicios) : reserva.servicios; } catch(e) {}
    if (Array.isArray(srvs) && srvs.length > 0) {
      const lineas = srvs.map(s => {
        if (typeof s === 'string') return s;
        const label = s.label || serviciosExtraMap[s.id] || s.id;
        const cant = s.cantidad || 1;
        return `${label} (x${cant})`;
      });
      if (lineas.length > 0) {
        htmlServicios = `
          <tr>
            <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;vertical-align:top;">Servicios Adicionales</td>
            <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${lineas.join('<br>')}</td>
          </tr>`;
      }
    }
  }

  let htmlPaquetesExtra = '';
  if (reserva.paquetes_extra) {
    let pExtras = [];
    try { pExtras = typeof reserva.paquetes_extra === 'string' ? JSON.parse(reserva.paquetes_extra) : reserva.paquetes_extra; } catch(e) {}
    if (Array.isArray(pExtras) && pExtras.length > 0) {
      const lineas = pExtras.map(p => paquetesMap[String(p)] || p);
      if (lineas.length > 0) {
        htmlPaquetesExtra = `
          <tr>
            <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;vertical-align:top;">Paquetes Extra</td>
            <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${lineas.join('<br>')}</td>
          </tr>`;
      }
    }
  }

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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <!-- Header (Dark) -->
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Factura de Reserva</p>
              </td>
            </tr>

            <!-- Saludo -->
            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Cliente'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Tu reserva ha sido registrada exitosamente. A continuación encontrarás el detalle de los servicios adquiridos.
                </p>
              </td>
            </tr>

            <!-- Detalles (Factura Style) -->
            <tr>
              <td style="padding:10px 40px 30px;">
                <div style="border:1px solid #e8ddd0;border-radius:8px;overflow:hidden;">
                  
                  <!-- Info Header -->
                  <div style="background-color:#faf6f1;padding:15px 20px;border-bottom:1px solid #e8ddd0;">
                    <p style="margin:0;color:#1f140e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                      Detalles de la Reserva
                    </p>
                  </div>

                  <!-- Table de Info -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:15px 20px;">
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;width:40%;border-bottom:1px dashed #e8ddd0;">Check-in</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${fecha_inicio}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Check-out</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${fecha_fin}</td>
                    </tr>
                    ${cabana ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Cabaña</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${cabanaNombre}</td>
                    </tr>` : ''}
                    ${paquete ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Paquete</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${paqueteNombre}</td>
                    </tr>` : ''}
                    ${htmlPaquetesExtra}
                    ${htmlServicios}
                    ${num_personas ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Huéspedes</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${num_personas} Personas</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;">Método de Pago</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;">${metodoPagoTexto}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <!-- Notas (Opcional) -->
            ${notas ? `
            <tr>
              <td style="padding:0 40px 20px;">
                <div style="background-color:#faf6f1;padding:15px;border-left:4px solid #d4a574;border-radius:4px;">
                  <p style="margin:0;color:#555555;font-size:12px;font-weight:700;text-transform:uppercase;">Notas Adicionales</p>
                  <p style="margin:5px 0 0;color:#333333;font-size:14px;line-height:1.5;">${notas}</p>
                </div>
              </td>
            </tr>` : ''}

            <!-- Resumen Financiero -->
            <tr>
              <td style="padding:0 40px 35px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#faf6f1;border-radius:8px;border:1px solid #e8ddd0;">
                  <tr>
                    <td style="padding:20px;">
                      
                      <!-- Desglose -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:15px;">
                        <tr>
                          <td style="padding:6px 0;color:#555555;font-size:14px;">Total</td>
                          <td style="padding:6px 0;color:#1f140e;font-size:14px;text-align:right;">$${Number(monto_total).toLocaleString('es-CO')}</td>
                        </tr>
                        ${reserva.descuento ? `
                        <tr>
                          <td style="padding:6px 0;color:#555555;font-size:14px;">Descuento</td>
                          <td style="padding:6px 0;color:#e74c3c;font-size:14px;text-align:right;">-$${Number(reserva.descuento).toLocaleString('es-CO')}</td>
                        </tr>` : ''}
                        ${reserva.iva ? `
                        <tr>
                          <td style="padding:6px 0;color:#555555;font-size:14px;">Impuestos (IVA)</td>
                          <td style="padding:6px 0;color:#1f140e;font-size:14px;text-align:right;">$${Number(reserva.iva).toLocaleString('es-CO')}</td>
                        </tr>` : ''}
                      </table>

                      <!-- Total Box -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);border-radius:6px;">
                        <tr>
                          <td style="padding:15px 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="color:#d4a574;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Total a Pagar</td>
                                <td align="right" style="color:#f5e6d3;font-size:24px;font-weight:700;">$${Number(monto_total).toLocaleString('es-CO')}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Estado Clean -->
            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <div style="display:inline-block;border:1px solid #d4a574;color:#5c3a1e;padding:8px 25px;border-radius:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background-color:#faf6f1;">
                  Estado: Confirmada
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: `Reserva Confirmada - Kafe Ancestral`,
      html: html
    });
    console.log(`[Email Service] Email de reserva enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de reserva:', err.message);
    return { enviado: false, error: err.message };
  }
};

/**
 * Envía un correo de confirmación de cuenta creada.
 */
const enviarConfirmacionCuenta = async ({ to, nombre, apellido, tipoDocumento, numeroDocumento, pais, telefono }) => {
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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">¡Bienvenido/a!</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 30px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Cliente'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesión y empezar a reservar tus cabañas favoritas para vivir la experiencia cafetera.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;">
                <div style="background-color:#faf6f1;border:1px solid #e8ddd0;border-radius:8px;padding:25px;">
                  <h3 style="margin:0 0 15px;color:#3e2612;font-size:16px;">Tus Datos de Registro</h3>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Nombre Completo</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${nombre || ''} ${apellido || ''}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Correo Electrónico</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${to}</td>
                    </tr>
                    ${tipoDocumento ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Documento</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${tipoDocumento} ${numeroDocumento || ''}</td>
                    </tr>` : ''}
                    ${pais ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">País</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${pais}</td>
                    </tr>` : ''}
                    ${telefono ? `
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">Teléfono</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">${telefono}</td>
                    </tr>` : ''}
                  </table>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: '¡Bienvenido a Kafe Ancestral!',
      html: html
    });
    console.log(`[Email Service] Email de bienvenida enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de bienvenida:', err.message);
    return { enviado: false, error: err.message };
  }
};

/**
 * Envía un correo notificando el cambio de estado de una reserva.
 */
const enviarCambioEstadoReserva = async ({ to, nombre, reserva, nuevoEstado }) => {
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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Actualización de Reserva</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Cliente'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Te informamos que el estado de tu reserva ha cambiado.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <div style="display:inline-block;border:1px solid #d4a574;color:#5c3a1e;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background-color:#faf6f1;">
                  Nuevo Estado: ${nuevoEstado}
                </div>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: `Actualización de Reserva - Kafe Ancestral`,
      html: html
    });
    console.log(`[Email Service] Email de cambio de estado (${nuevoEstado}) enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de cambio de estado:', err.message);
    return { enviado: false, error: err.message };
  }
};

/**
 * Envía un correo con el token para recuperar la contraseña.
 */
const enviarRecuperacionPassword = async ({ to, nombre, token }) => {
  const resetUrl = `${process.env.APP_URL || 'https://kcafeancestral.com'}/index.html?token=${token}`;

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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Recuperación de Contraseña</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Usuario'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Has solicitado recuperar tu contraseña. Por favor, utiliza el siguiente código de seguridad para restablecerla.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 40px 20px;text-align:center;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg, #1f140e 0%, #3e2612 100%);color:#f5e6d3;font-size:15px;font-weight:600;text-decoration:none;padding:15px 35px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">
                  Restablecer contraseña
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <p style="margin:0;color:#555555;font-size:13px;line-height:1.6;">
                  Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: 'Recuperación de Contraseña - Kafe Ancestral',
      html: html
    });
    console.log(`[Email Service] Email de recuperación enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de recuperación:', err.message);
    return { enviado: false, error: err.message };
  }
};

/**
 * Envía un código OTP de verificación de correo.
 * @param {Object} params
 * @param {string} params.to     - Email del cliente
 * @param {string} params.nombre - Nombre del cliente
 * @param {string} params.codigo - Código OTP de 6 dígitos
 */
const enviarCodigoVerificacion = async ({ to, nombre, codigo }) => {
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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Verificación de Correo</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Usuario'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Estás a un paso de crear tu cuenta. Usa el siguiente código para verificar tu correo electrónico.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 20px;text-align:center;">
                <div style="display:inline-block;border:1px solid #e8ddd0;color:#1f140e;padding:15px 30px;border-radius:6px;font-size:24px;font-weight:700;letter-spacing:4px;background-color:#faf6f1;">
                  ${codigo}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <p style="margin:0;color:#555555;font-size:13px;line-height:1.6;">
                  Este código expirará en 10 minutos. Si no solicitaste esto, puedes ignorarlo.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: 'Tu código de verificación - Kafe Ancestral',
      html: html,
    });
    return info;
  } catch (error) {
    console.error('Error enviando email de OTP:', error);
    throw error;
  }
};

/**
 * Envía un correo de invitación para que un nuevo usuario (creado por el admin)
 * establezca su propia contraseña. El enlace tiene validez de 10 minutos.
 * @param {Object} params
 * @param {string} params.to     - Email del nuevo usuario
 * @param {string} params.nombre - Nombre del usuario
 * @param {string} params.token  - Token de restablecimiento
 */
const enviarInvitacionCuenta = async ({ to, nombre, token }) => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:' + (process.env.PORT || 3000)}/index.html?token=${token}`;

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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Bienvenido al Equipo</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Usuario'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Se ha creado una cuenta para ti. Para empezar a usarla y acceder al sistema, necesitas establecer tu contraseña.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 40px 20px;text-align:center;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg, #1f140e 0%, #3e2612 100%);color:#f5e6d3;font-size:15px;font-weight:600;text-decoration:none;padding:15px 35px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">
                  Establecer mi contraseña
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <p style="margin:0;color:#555555;font-size:13px;line-height:1.6;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                  <a href="${resetUrl}" style="color:#d4a574;word-break:break-all;font-size:12px;">${resetUrl}</a><br><br>
                  <strong>Atención:</strong> Este enlace de seguridad expira en 10 minutos.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: 'Establece tu contraseña - Kafe Ancestral',
      html: html,
    });
    console.log(`[Email Service] Email de invitación enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de invitación:', err.message);
    return { enviado: false, error: err.message };
  }
};

/**
 * Envía un correo notificando que se agregaron nuevos servicios a la reserva.
 */
const enviarNotificacionNuevoServicio = async ({ to, nombre, reserva, nuevosServiciosDetalle, totalNuevos, metodoPagoNuevos }) => {
  const metodos = {
    'efectivo': 'Efectivo en Recepción',
    'transferencia': 'Transferencia / Pasarela de Pago',
  };
  const metodoPagoTexto = metodos[metodoPagoNuevos] || (metodoPagoNuevos ? String(metodoPagoNuevos).charAt(0).toUpperCase() + String(metodoPagoNuevos).slice(1) : 'No especificado');

  const htmlServicios = nuevosServiciosDetalle.map(s => `
    <tr>
      <td style="padding:10px 0;color:#555555;font-size:14px;border-bottom:1px dashed #e8ddd0;">${s.label}</td>
      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;border-bottom:1px dashed #e8ddd0;">$${Number(s.precio).toLocaleString('es-CO')}</td>
    </tr>
  `).join('');

  const mensajePago = metodoPagoNuevos === 'efectivo' 
    ? 'El pago de estos servicios se espera al momento de tu llegada a la cabaña.'
    : 'Tu pago por transferencia ha sido registrado temporalmente. Recuerda que pronto implementaremos una pasarela de pago para mayor comodidad.';

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
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #1f140e 0%, #3e2612 100%);padding:45px 40px;text-align:center;">
                <h1 style="margin:0;color:#f5e6d3;font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Kafe Ancestral</h1>
                <p style="margin:10px 0 0;color:#d4a574;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Actualización de Reserva</p>
              </td>
            </tr>

            <tr>
              <td style="padding:35px 40px 20px;">
                <p style="margin:0;color:#1f140e;font-size:18px;font-weight:600;">Hola, ${nombre || 'Cliente'}.</p>
                <p style="margin:10px 0 0;color:#333333;font-size:15px;line-height:1.6;">
                  Te informamos que se han agregado nuevos servicios a tu reserva.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 40px 30px;">
                <div style="border:1px solid #e8ddd0;border-radius:8px;overflow:hidden;">
                  
                  <div style="background-color:#faf6f1;padding:15px 20px;border-bottom:1px solid #e8ddd0;">
                    <p style="margin:0;color:#1f140e;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                      Nuevos Servicios Agregados
                    </p>
                  </div>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:15px 20px;">
                    ${htmlServicios}
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;"><strong>Total Adicional</strong></td>
                      <td style="padding:10px 0;color:#1f140e;font-size:16px;font-weight:700;text-align:right;">$${Number(totalNuevos).toLocaleString('es-CO')}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#555555;font-size:14px;">Método de Pago</td>
                      <td style="padding:10px 0;color:#1f140e;font-size:14px;font-weight:600;text-align:right;">${metodoPagoTexto}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <div style="display:inline-block;border:1px solid #d4a574;color:#5c3a1e;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:500;background-color:#faf6f1;">
                  ${mensajePago}
                </div>
              </td>
            </tr>

            <tr>
              <td style="background-color:#1f140e;padding:30px 40px;text-align:center;">
                <p style="margin:0;color:#d4a574;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Kafe Ancestral</p>
                <p style="margin:8px 0 0;color:#555555;font-size:12px;line-height:1.6;">
                  Tu experiencia, nuestra pasión.<br>
                  Para dudas o soporte, por favor contáctanos.
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
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: 'Actualización de Servicios en tu Reserva - Kafe Ancestral',
      html: html
    });
    console.log(`[Email Service] Email de nuevos servicios enviado a ${to}`);
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('Error al enviar email de nuevos servicios:', err.message);
    return { enviado: false, error: err.message };
  }
};

module.exports = {
  enviarConfirmacionReserva,
  enviarConfirmacionCuenta,
  enviarCodigoVerificacion,
  enviarCambioEstadoReserva,
  enviarRecuperacionPassword,
  enviarInvitacionCuenta,
  enviarNotificacionNuevoServicio,
};
