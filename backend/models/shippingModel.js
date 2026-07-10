/**
 * shippingModel.js
 * Operaciones de base de datos (MySQL) para la tabla shipping_orders.
 * Usa el pool de conexión compartido de la aplicación.
 */

import pool from '../db.js';

/**
 * Crea un nuevo registro de envío vinculado a un pedido.
 * @param {object} datos
 */
export async function createShippingOrder({ order_id, paqueteria, costo_envio, codigo_postal }) {
    const query = `
        INSERT INTO shipping_orders (order_id, paqueteria, costo_envio, codigo_postal, estatus)
        VALUES (?, ?, ?, ?, 'pendiente')
    `;
    const [result] = await pool.execute(query, [order_id, paqueteria, costo_envio, codigo_postal]);
    
    const [rows] = await pool.execute('SELECT * FROM shipping_orders WHERE id = ?', [result.insertId]);
    return rows[0];
}

/**
 * Guarda el número de guía y la respuesta completa de CT en el registro.
 */
export async function saveGuia(shippingId, numero_guia, datos_guia) {
    const query = `
        UPDATE shipping_orders
        SET numero_guia = ?,
            datos_guia  = ?,
            estatus     = 'generada'
        WHERE id = ?
    `;
    await pool.execute(query, [numero_guia, JSON.stringify(datos_guia), shippingId]);
    
    const [rows] = await pool.execute('SELECT * FROM shipping_orders WHERE id = ?', [shippingId]);
    if (!rows.length) throw new Error(`Shipping order ${shippingId} no encontrada`);
    return rows[0];
}

/**
 * Obtiene el registro de envío por order_id.
 */
export async function getShippingByOrderId(orderId) {
    const [rows] = await pool.execute(
        'SELECT * FROM shipping_orders WHERE order_id = ? ORDER BY fecha_creacion DESC LIMIT 1',
        [orderId]
    );
    return rows[0] || null;
}

/**
 * Obtiene el registro de envío por número de guía.
 */
export async function getShippingByGuia(guia) {
    const [rows] = await pool.execute(
        'SELECT * FROM shipping_orders WHERE numero_guia = ?',
        [guia]
    );
    return rows[0] || null;
}

/**
 * Actualiza el estatus de un envío.
 */
export async function updateShippingStatus(shippingId, estatus) {
    const VALID_STATUSES = ['pendiente', 'generada', 'en_transito', 'entregada', 'cancelada'];
    if (!VALID_STATUSES.includes(estatus)) {
        throw new Error(`Estatus inválido: ${estatus}. Válidos: ${VALID_STATUSES.join(', ')}`);
    }
    await pool.execute(
        'UPDATE shipping_orders SET estatus = ? WHERE id = ?',
        [estatus, shippingId]
    );
    
    const [rows] = await pool.execute('SELECT * FROM shipping_orders WHERE id = ?', [shippingId]);
    if (!rows.length) throw new Error(`Shipping order ${shippingId} no encontrada`);
    return rows[0];
}

/**
 * Obtiene todos los registros de envío.
 */
export async function getAllShippingOrders() {
    const [rows] = await pool.execute(
        'SELECT * FROM shipping_orders ORDER BY fecha_creacion DESC'
    );
    return rows;
}
