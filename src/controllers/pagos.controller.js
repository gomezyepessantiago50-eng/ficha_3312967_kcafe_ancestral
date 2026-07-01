const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummyKeyToPreventCrashIfMissing');
const reservaService = require('../services/reserva.service');
const Reserva = require('../models/reserva.model');
const Usuario = require('../models/usuario.model');
const emailService = require('../services/email.service');

// Endpoint para crear la sesión de Checkout de Stripe
const crearCheckoutSession = async (req, res) => {
  try {
    const { idReserva, source, montoExtra, descripcionExtra } = req.body;
    
    if (!idReserva) {
      return res.status(400).json({ ok: false, mensaje: 'ID de reserva es requerido' });
    }

    // Obtener la reserva de la base de datos
    const reserva = await reservaService.obtenerReserva(idReserva);
    
    if (!reserva) {
      return res.status(404).json({ ok: false, mensaje: 'Reserva no encontrada' });
    }

    // Crear un arreglo de line_items para Stripe (Monto en centavos para COP no aplica, en COP 1 unidad = 1 peso, pero Stripe requiere enteros)
    const line_items = [
      {
        price_data: {
          currency: 'cop',
          product_data: {
            name: montoExtra ? (descripcionExtra || `Servicios/Paquetes Extra - Reserva ${idReserva}`) : `Reserva en Kafe Ancestral - Cabaña ${reserva.cabana || ''}`,
            description: montoExtra ? 'Cobro adicional por edición de reserva' : `Check-in: ${reserva.fecha_inicio} | Check-out: ${reserva.fecha_fin}`,
          },
          unit_amount: montoExtra ? Math.round(montoExtra * 100) : Math.round(reserva.monto_total * 100), // Stripe exige el valor en centavos para COP
        },
        quantity: 1,
      },
    ];

    // La URL a donde regresará el usuario al terminar el pago o cancelarlo
    const domain = req.headers.origin || 'http://localhost:3000'; // Puedes ajustar según tu entorno
    
    const sourceParam = source === 'admin' ? '&source=admin' : '';
    const cancelUrl = source === 'admin' ? `${domain}/admin.html?cancelado=true` : `${domain}/cliente.html?cancelado=true`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Agrega más métodos si Stripe los soporta en tu cuenta (ej. pse)
      line_items,
      mode: 'payment',
      success_url: `${domain}/api/pagos/stripe/success?session_id={CHECKOUT_SESSION_ID}&reserva_id=${idReserva}${sourceParam}`,
      cancel_url: cancelUrl,
      metadata: {
        idReserva: idReserva.toString(),
      },
    });

    res.status(200).json({ ok: true, url: session.url });
  } catch (error) {
    console.error('Error creando checkout session:', error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

// Endpoint para el Webhook de Stripe
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Si no tienes webhook secret configurado, ignora la validación (NO RECOMENDADO EN PRODUCCIÓN)
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Para pruebas locales sin validación estricta de firma si falla
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento de pago completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const idReserva = session.metadata.idReserva;

    try {
      console.log(`Pago completado exitosamente para la reserva ID: ${idReserva}`);
      
      const montoPagadoAhora = (session.amount_total || 0) / 100;
      
      // Leer la reserva actual para acumular
      const reservaActual = await Reserva.findByPk(idReserva);
      const montoAcumulado = (reservaActual?.monto_pagado || 0) + montoPagadoAhora;
      
      let historial = [];
      try {
        historial = reservaActual?.pagos_historial ? JSON.parse(typeof reservaActual.pagos_historial === 'string' ? reservaActual.pagos_historial : JSON.stringify(reservaActual.pagos_historial)) : [];
      } catch(e) { historial = []; }
      if (!Array.isArray(historial)) historial = [];
      
      const descripcion = historial.length === 0 
        ? 'Pago inicial de la reserva' 
        : (session.metadata?.descripcion || 'Pago por servicios extras añadidos');
      
      historial.push({
        fecha: new Date().toISOString(),
        monto: montoPagadoAhora,
        descripcion: descripcion,
        stripe_session: session.id,
      });

      // Actualizar la reserva a estado 2 (Confirmada) con monto acumulado
      await Reserva.update(
        { 
          IdEstadoReserva: 2,
          comprobante_pago: session.payment_intent || session.id,
          monto_pagado: montoAcumulado,
          pagos_historial: JSON.stringify(historial),
        },
        { where: { IdReserva: idReserva } }
      );
      
      // Enviar correo de confirmación
      const reservaParaCorreo = await reservaService.obtenerReserva(idReserva);
      const reservaRaw = await Reserva.findByPk(idReserva);
      const usuario = reservaRaw ? await Usuario.findByPk(reservaRaw.UsuarioIdusuario) : null;
      if (reservaParaCorreo && usuario && usuario.Email) {
        emailService.enviarConfirmacionReserva({
          to: usuario.Email,
          nombre: usuario.NombreUsuario || 'Cliente',
          reserva: reservaParaCorreo,
        }).catch(err => console.error('Error enviando email tras webhook Stripe:', err.message));
      }
    } catch (dbError) {
      console.error('Error actualizando la reserva:', dbError);
    }
  }

  // Retornar un 200 a Stripe para confirmar recepción
  res.status(200).send({ received: true });
};

// Endpoint para retorno exitoso de Stripe
const stripeSuccess = async (req, res) => {
  const { session_id, reserva_id, source } = req.query;

  try {
    if (session_id && reserva_id) {
      // Obtener datos de la sesión para ver cuánto pagó
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      if (session && session.payment_status === 'paid') {
        const montoPagadoAhora = session.amount_total / 100;
        
        // Leer la reserva actual para acumular el monto_pagado
        const reservaActual = await Reserva.findByPk(reserva_id);
        const montoAcumulado = (reservaActual?.monto_pagado || 0) + montoPagadoAhora;
        
        // Construir historial de pagos
        let historial = [];
        try {
          historial = reservaActual?.pagos_historial ? JSON.parse(typeof reservaActual.pagos_historial === 'string' ? reservaActual.pagos_historial : JSON.stringify(reservaActual.pagos_historial)) : [];
        } catch(e) { historial = []; }
        if (!Array.isArray(historial)) historial = [];
        
        const descripcion = historial.length === 0 
          ? 'Pago inicial de la reserva' 
          : (session.metadata?.descripcion || 'Pago por servicios extras añadidos');
        
        historial.push({
          fecha: new Date().toISOString(),
          monto: montoPagadoAhora,
          descripcion: descripcion,
          stripe_session: session.id,
        });

        // Actualizar reserva a Confirmada con monto acumulado
        await Reserva.update(
          { 
            IdEstadoReserva: 2,
            comprobante_pago: session.payment_intent || session.id,
            monto_pagado: montoAcumulado,
            pagos_historial: JSON.stringify(historial),
          },
          { where: { IdReserva: reserva_id } }
        );

        // Enviar correo de confirmación
        const reservaParaCorreo = await reservaService.obtenerReserva(reserva_id);
        const reservaRaw2 = await Reserva.findByPk(reserva_id);
        const usuario2 = reservaRaw2 ? await Usuario.findByPk(reservaRaw2.UsuarioIdusuario) : null;
        if (reservaParaCorreo && usuario2 && usuario2.Email) {
          emailService.enviarConfirmacionReserva({
            to: usuario2.Email,
            nombre: usuario2.NombreUsuario || 'Cliente',
            reserva: reservaParaCorreo,
          }).catch(err => console.error('Error enviando email tras success Stripe:', err.message));
        }
      }
    }
  } catch (error) {
    console.error('Error en return success:', error);
  }
  
  const sourceParam = source === 'admin' ? `&source=admin` : '';
  // Redirigir siempre a la pantalla de éxito
  res.redirect(`/pago-exitoso.html?session_id=${session_id}&reserva_id=${reserva_id}${sourceParam}`);
};

module.exports = {
  crearCheckoutSession,
  stripeWebhook,
  stripeSuccess,
};
