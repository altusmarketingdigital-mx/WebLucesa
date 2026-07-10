/**
 * shippingWebhook.js
 * Controlador para recibir actualizaciones automáticas de estado
 * desde CT CONNECT vía webhook (HTTP POST).
 *
 * Registrar en server.js:
 *   import { ctWebhook } from './controllers/shippingWebhook.js';
 *   app.post('/api/shipping/webhook', ctWebhook);
 */

import { updateShippingStatus, getShippingByGuia } from '../models/shippingModel.js';
import { sendStatusEmail } from '../services/emailService.js';

// Mapeo de los estados de CT a nuestros estados internos
const CT_STATUS_MAP = {
    'en ruta':       'en_transito',
    'en transito':   'en_transito',
    'enviado':       'en_transito',
    'entregado':     'entregada',
    'cancelado':     'cancelada',
    'generado':      'generada',
};

/**
 * POST /api/shipping/webhook
 * CT CONNECT envía un body con el número de guía y el nuevo estado.
 * Ejemplo de payload esperado de CT:
 * {
 *   "guia":    "123456789",
 *   "estatus": "entregado",
 *   "fecha":   "2025-03-12T14:00:00Z"
 * }
 */
export async function ctWebhook(req, res) {
    try {
        const { guia, estatus: ctEstatus } = req.body;

        if (!guia || !ctEstatus) {
            return res.status(400).json({ error: 'Se requieren los campos "guia" y "estatus".' });
        }

        // Buscar el registro en DB por número de guía
        const shippingRecord = await getShippingByGuia(guia);
        if (!shippingRecord) {
            console.warn(`[Webhook CT] Guía ${guia} no encontrada en DB — ignorada.`);
            return res.status(200).json({ ok: true, note: 'Guía no registrada, ignorada.' });
        }

        // Mapear el estado de CT al nuestro
        const nuevoEstatus = CT_STATUS_MAP[ctEstatus.toLowerCase().trim()];
        if (!nuevoEstatus) {
            console.warn(`[Webhook CT] Estatus desconocido: "${ctEstatus}" — ignorado.`);
            return res.status(200).json({ ok: true, note: `Estatus "${ctEstatus}" no reconocido.` });
        }

        // Evitar actualización si ya tiene ese estatus
        if (shippingRecord.estatus === nuevoEstatus) {
            return res.status(200).json({ ok: true, note: 'Estatus sin cambio.' });
        }

        // Actualizar en DB
        const updated = await updateShippingStatus(shippingRecord.id, nuevoEstatus);
        console.log(`✅ [Webhook CT] Guía ${guia}: Status CT "${ctEstatus}" -> Interno "${nuevoEstatus}" (Pedido #${shippingRecord.order_id})`);

        // Notificar por email al admin (y opcionalmente al cliente si tienes su email)
        await sendStatusEmail({
            guia,
            paqueteria: shippingRecord.paqueteria,
            estatus:    nuevoEstatus,
            orderId:    shippingRecord.order_id
        });

        return res.status(200).json({ ok: true, message: `Estatus actualizado a ${nuevoEstatus}` });

    } catch (err) {
        console.error('[Webhook CT] Error:', err.message);
        // Responder 200 igual para que CT no reintente infinitamente
        return res.status(200).json({ ok: false, error: err.message });
    }
}
