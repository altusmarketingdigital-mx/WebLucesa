/**
 * ctPaqueteriaService.js
 * Capa de servicio para consumir la API de paquetería de CT CONNECT.
 * Encapsula toda la comunicación HTTP con CT para mantener
 * controladores y rutas limpios.
 */

import axios from 'axios';

const CT_BASE_URL = process.env.CT_API_BASE || 'http://connect.ctonline.mx:3001';
const CT_TIMEOUT  = parseInt(process.env.CT_TIMEOUT_MS) || 10_000;

// Axios instancia dedicada a CT para poder reutilizar headers y timeout
const ctApi = axios.create({
    baseURL: CT_BASE_URL,
    timeout: CT_TIMEOUT,
    headers: { 'Content-Type': 'application/json' }
});

let dynamicToken = process.env.CT_TOKEN || null;

/**
 * Permite actualizar el token de CT desde fuera del servicio (ej. desde server.js)
 * @param {string} token 
 */
export function setCTToken(token) {
    dynamicToken = token;
}

// Interceptor: adjunta el token JWT de CT si está disponible
ctApi.interceptors.request.use((cfg) => {
    if (dynamicToken) {
        cfg.headers['Authorization'] = `Bearer ${dynamicToken}`;
    }
    return cfg;
});

/**
 * Cotiza el costo de envío a un código postal para una lista de productos.
 *
 * @param {string}   destino     - Código postal del cliente (5 dígitos)
 * @param {Array}    productos   - Array de productos CT:
 *   [{ producto, cantidad, precio, moneda, almacen }]
 * @returns {Promise<Array>}  Lista de cotizaciones:
 *   [{ empresa: string, total: number }]
 * @throws {Error} Si CT responde con error o el formato es inválido
 */
export async function cotizarEnvio(destino, productos) {
    if (!destino || !/^\d{5}$/.test(destino)) {
        throw new Error('Código postal inválido. Debe ser de 5 dígitos numéricos.');
    }
    if (!Array.isArray(productos) || productos.length === 0) {
        throw new Error('Se requiere al menos un producto para cotizar.');
    }

    const payload = { destino, productos };

    try {
        const { data } = await ctApi.post('/paqueteria/cotizacion', payload);

        if (!data?.cotizaciones || !Array.isArray(data.cotizaciones)) {
            throw new Error('Respuesta de CT inválida: no contiene cotizaciones.');
        }

        // Ordenar de menor a mayor costo para mejor UX
        return data.cotizaciones.sort((a, b) => a.total - b.total);

    } catch (err) {
        if (err.response) {
            // Error HTTP de CT
            throw new Error(
                `CT CONNECT error ${err.response.status}: ${JSON.stringify(err.response.data)}`
            );
        }
        throw err; // timeout, red, etc.
    }
}

/**
 * Genera una guía de envío al crear el pedido en CT.
 * Esta función forma parte del payload del pedido a CT;
 * el campo `guiaConnect` se agrega al body de creación de orden.
 *
 * @param {string} paqueteria  - ID de la empresa elegida (ej. 'estafeta')
 * @returns {object}  Fragmento de payload para incluir en la orden CT:
 *   { guiaConnect: { generarGuia: true, paqueteria } }
 */
export function buildGuiaPayload(paqueteria) {
    if (!paqueteria || typeof paqueteria !== 'string') {
        throw new Error('El nombre de la paquetería es requerido.');
    }
    return {
        guiaConnect: {
            generarGuia: true,
            paqueteria: paqueteria.toLowerCase().trim()
        }
    };
}

/**
 * Consulta el detalle y estado de una guía por número de folio.
 *
 * @param {string} folio  - Número de folio / guía emitido por CT
 * @returns {Promise<object>} Detalle devuelto por CT CONNECT
 * @throws {Error} Si la guía no existe o CT falla
 */
export async function consultarGuia(folio) {
    if (!folio || typeof folio !== 'string' || folio.trim() === '') {
        throw new Error('El folio de la guía es requerido.');
    }

    try {
        const { data } = await ctApi.get(`/paqueteria/detalles/guia/${encodeURIComponent(folio.trim())}`);
        return data;
    } catch (err) {
        if (err.response?.status === 404) {
            throw new Error(`Guía '${folio}' no encontrada en CT CONNECT.`);
        }
        if (err.response) {
            throw new Error(
                `CT CONNECT error ${err.response.status}: ${JSON.stringify(err.response.data)}`
            );
        }
        throw err;
    }
}
/**
 * Envía una orden completa a CT CONNECT para su procesamiento y generación de guía.
 *
 * @param {object} orderData    - Datos de la orden (items, totales, etc.)
 * @param {object} shippingInfo - Datos de envío (empresa, costo)
 * @returns {Promise<object>}   Respuesta de la API de CT
 */
export async function crearPedidoCT(orderData, shippingInfo) {
    if (!orderData || !shippingInfo) {
        throw new Error('Datos de orden e información de envío son requeridos.');
    }

    const payload = {
        ...orderData,
        ...buildGuiaPayload(shippingInfo.empresa)
    };

    try {
        console.log('[CTService] Creando pedido en CT con payload:', JSON.stringify(payload));
        const { data } = await ctApi.post('/orden/crear', payload);
        return data;
    } catch (err) {
        if (err.response) {
            throw new Error(`Error CT al crear pedido: ${JSON.stringify(err.response.data)}`);
        }
        throw err;
    }
}
