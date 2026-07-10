/**
 * shippingController.js
 * Controlador Express para el módulo de envíos CT CONNECT.
 * Delega la lógica de negocio al servicio y al modelo correspondientes.
 */

import { cotizarEnvio, buildGuiaPayload, consultarGuia } from '../services/ctPaqueteriaService.js';
import {
    createShippingOrder,
    saveGuia,
    getShippingByOrderId,
    getShippingByGuia,
    updateShippingStatus,
    getAllShippingOrders
} from '../models/shippingModel.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shipping/cotizar
// Cotiza el envío según el código postal del cliente y los productos del carrito.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Body esperado:
 * {
 *   "destino":   "83113",
 *   "productos": [
 *     { "producto": "MOULOG1800", "cantidad": "1", "precio": "1708.9", "moneda": "MXN", "almacen": "D2A" }
 *   ]
 * }
 */
export async function cotizar(req, res) {
    try {
        const { destino, productos } = req.body;

        if (!destino) {
            return res.status(400).json({ error: 'El campo "destino" (código postal) es requerido.' });
        }
        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un producto en "productos".' });
        }

        try {
            const cotizaciones = await cotizarEnvio(destino, productos);
            return res.json({ success: true, destino, cotizaciones });
        } catch (apiErr) {
            console.warn('[ShippingController] API Fallback a modo demo:', apiErr.message);
            const mockCotizaciones = [
                { empresa: 'estafeta',      total: 165.49 },
                { empresa: 'paquetexpress', total: 145.58 },
                { empresa: 'dhl',           total: 210.12 }
            ];
            return res.json({ 
                success: true, 
                destino, 
                cotizaciones: mockCotizaciones,
                note: "Modo demo activo." 
            });
        }
    } catch (err) {
        console.error('[ShippingController] Error fatal:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shipping/seleccionar
// Guarda la paquetería elegida en la base de datos (antes de pagar).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Body esperado:
 * {
 *   "order_id":     123,
 *   "paqueteria":   "estafeta",
 *   "costo_envio":  165.49,
 *   "codigo_postal":"83113"
 * }
 */
export async function seleccionarPaqueteria(req, res) {
    try {
        const { order_id, paqueteria, costo_envio, codigo_postal } = req.body;

        if (!order_id)    return res.status(400).json({ error: '"order_id" es requerido.' });
        if (!paqueteria)  return res.status(400).json({ error: '"paqueteria" es requerida.' });
        if (costo_envio == null) return res.status(400).json({ error: '"costo_envio" es requerido.' });

        const shippingOrder = await createShippingOrder({
            order_id,
            paqueteria: paqueteria.toLowerCase().trim(),
            costo_envio: parseFloat(costo_envio),
            codigo_postal
        });

        return res.status(201).json({ success: true, shipping: shippingOrder });

    } catch (err) {
        console.error('[ShippingController] Error al seleccionar paquetería:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shipping/generar-guia
// Llama al payload de guía y lo guarda en DB.
// En producción este endpoint se llamaría al crear el pedido en CT.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Body esperado:
 * {
 *   "shipping_id":  45,
 *   "paqueteria":   "estafeta",
 *   "respuesta_ct": { ...payload completo del pedido CT... }
 * }
 * La propiedad `respuesta_ct` debe ser la respuesta de CT al crear el pedido
 * (incluye numero_guia y otros detalles).
 */
export async function generarGuia(req, res) {
    try {
        const { shipping_id, paqueteria, respuesta_ct } = req.body;

        if (!shipping_id) return res.status(400).json({ error: '"shipping_id" es requerido.' });
        if (!paqueteria)  return res.status(400).json({ error: '"paqueteria" es requerida.' });
        if (!respuesta_ct) return res.status(400).json({ error: '"respuesta_ct" (payload de CT) es requerida.' });

        // Construye el fragmento de guía para adjuntar al pedido CT
        // (útil para logging / auditoría)
        const guiaPayload = buildGuiaPayload(paqueteria);

        // Extrae el número de guía de la respuesta de CT
        const numero_guia =
            respuesta_ct?.guiaConnect?.numeroGuia ||
            respuesta_ct?.numeroGuia ||
            respuesta_ct?.guia ||
            null;

        if (!numero_guia) {
            return res.status(422).json({
                error: 'La respuesta de CT no contiene un número de guía. Verifica el campo guiaConnect.',
                guiaPayload,
                respuesta_ct
            });
        }

        const updated = await saveGuia(shipping_id, numero_guia, { ...respuesta_ct, guiaPayload });

        return res.json({ success: true, numero_guia, shipping: updated });

    } catch (err) {
        console.error('[ShippingController] Error al generar guía:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shipping/guia/:folio
// Consulta el estado de una guía directamente en CT CONNECT.
// ─────────────────────────────────────────────────────────────────────────────
export async function consultarGuiaCtrl(req, res) {
    try {
        const { folio } = req.params;
        if (!folio) return res.status(400).json({ error: 'El parámetro "folio" es requerido.' });

        const detalle = await consultarGuia(folio);

        // Opcionalmente sincroniza el estatus en DB
        const shippingRecord = await getShippingByGuia(folio);

        return res.json({
            success: true,
            folio,
            detalle,
            shipping_order: shippingRecord || null
        });

    } catch (err) {
        console.error('[ShippingController] Error al consultar guía:', err.message);
        const status = err.message.includes('no encontrada') ? 404 : 502;
        return res.status(status).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shipping/orden/:orderId
// Consulta el envío asociado a un pedido (para el panel admin).
// ─────────────────────────────────────────────────────────────────────────────
export async function getShippingByOrder(req, res) {
    try {
        const orderId = parseInt(req.params.orderId, 10);
        if (isNaN(orderId)) return res.status(400).json({ error: 'orderId debe ser un número.' });

        const shipping = await getShippingByOrderId(orderId);
        if (!shipping) return res.status(404).json({ error: `No hay envío registrado para la orden ${orderId}.` });

        return res.json({ success: true, shipping });
    } catch (err) {
        console.error('[ShippingController] Error al obtener envío por orden:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/shipping/estatus/:id
// Actualiza el estatus de un envío (uso del panel de administración).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Body esperado:
 * { "estatus": "en_transito" }
 * Valores válidos: pendiente | generada | en_transito | entregada | cancelada
 */
export async function actualizarEstatus(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: '"id" debe ser un número entero.' });

        const { estatus } = req.body;
        if (!estatus) return res.status(400).json({ error: '"estatus" es requerido en el body.' });

        const updated = await updateShippingStatus(id, estatus);
        return res.json({ success: true, shipping: updated });

    } catch (err) {
        console.error('[ShippingController] Error al actualizar estatus:', err.message);
        const isValidation = err.message.includes('Estatus inválido');
        return res.status(isValidation ? 400 : 500).json({ error: err.message });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shipping
// Lista todos los envíos (uso del panel de administración).
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllShipping(req, res) {
    try {
        const list = await getAllShippingOrders();
        return res.json({ success: true, shippingItems: list });
    } catch (err) {
        console.error('[ShippingController] Error al obtener listado de envíos:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
