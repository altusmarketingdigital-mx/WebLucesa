/**
 * shippingRoutes.js
 * Define y exporta las rutas REST para el módulo de envíos.
 * Se monta en app.js como: app.use('/api/shipping', shippingRoutes)
 */

import { Router } from 'express';
import {
    cotizar,
    seleccionarPaqueteria,
    generarGuia,
    consultarGuiaCtrl,
    getShippingByOrder,
    actualizarEstatus,
    getAllShipping
} from '../controllers/shippingController.js';

// Middleware de autenticación JWT — ajusta la ruta a tu implementación
// import { verifyToken } from '../middleware/auth.js';

const router = Router();

/**
 * @route   POST /api/shipping/cotizar
 * @desc    Obtiene cotizaciones de envío para un código postal y lista de productos
 * @access  Público (el cliente llama desde checkout antes de pagar)
 */
router.post('/cotizar', cotizar);

/**
 * @route   POST /api/shipping/seleccionar
 * @desc    Registra la paquetería elegida por el cliente (pre-confirmación)
 * @access  Protegido — usuario autenticado
 */
router.post('/seleccionar', /* verifyToken, */ seleccionarPaqueteria);

/**
 * @route   POST /api/shipping/generar-guia
 * @desc    Registra la guía generada por CT CONNECT tras crear el pedido
 * @access  Protegido — sólo backend interno / webhook CT
 */
router.post('/generar-guia', /* verifyToken, */ generarGuia);

/**
 * @route   GET /api/shipping/guia/:folio
 * @desc    Consulta en tiempo real el estado de una guía en CT CONNECT
 * @access  Protegido — admin o dueño del pedido
 */
router.get('/guia/:folio', /* verifyToken, */ consultarGuiaCtrl);

/**
 * @route   GET /api/shipping/orden/:orderId
 * @desc    Devuelve el registro de envío vinculado a un pedido
 * @access  Protegido
 */
router.get('/orden/:orderId', /* verifyToken, */ getShippingByOrder);

/**
 * @route   PATCH /api/shipping/estatus/:id
 * @desc    Actualiza el estatus del envío (panel admin)
 * @access  Protegido — sólo admin
 * @body    { "estatus": "en_transito" }
 * Valores válidos: pendiente | generada | en_transito | entregada | cancelada
 */
router.patch('/estatus/:id', /* verifyToken, */ actualizarEstatus);

/**
 * @route   GET /api/shipping
 * @desc    Lista todos los envíos (panel admin)
 * @access  Protegido — sólo admin
 */
router.get('/', /* verifyToken, */ getAllShipping);

export default router;
