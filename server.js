import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import paypal from '@paypal/checkout-server-sdk';
import { sendOrderEmail } from './backend/services/emailService.js';
import shippingRoutes from './backend/routes/shippingRoutes.js';
import { ctWebhook } from './backend/controllers/shippingWebhook.js';
import authRoutes from './backend/routes/authRoutes.js';
import { verifyToken, requireAdmin } from './backend/middleware/auth.js';
import pool from './backend/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Configurar Mercado Pago
const mpCliente = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

// Configurar PayPal (Sandbox)
const paypalEnvironment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);


const app = express();
const PORT = process.env.PORT || 3000;

console.log('--- MASTER SERVER (BACKEND/SERVER.JS) STARTING ---');
console.log('PORT:', PORT);
console.log('DIRNAME:', __dirname);

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend (Vite build)
const distPath = path.resolve(__dirname, './dist');
if (fs.existsSync(distPath)) {
    console.log('✅ Serving frontend from:', distPath);
    app.use(express.static(distPath));
} else {
    console.error('❌ dist directory NOT FOUND at:', distPath);
}



// ─── Autenticación de usuarios ────────────────────────────────────────────────
app.use('/api/auth', (req, res, next) => {
    console.log(`[Auth Request] ${req.method} ${req.url}`);
    next();
}, authRoutes);

// ─── Módulo de Envíos CT CONNECT ─────────────────────────────────────────────
app.use('/api/shipping', shippingRoutes);
app.post('/api/shipping/webhook', ctWebhook);


// In-memory cache for API Tokens, Catalog
// --- 1. Global State / Persistence ---
// Ya no usamos mockSales en memoria, todo va a PostgreSQL.
let ctToken = null;
let tokenExpiry = null;
let localCatalog = [];
let catalogMap = new Map();

// ─── Variables de entorno y cache ──────────────────────────────────────────

const CATALOG_FILE = path.join(__dirname, 'backend', 'ct_catalog.json');

// Helper to update the catalog map
function updateCatalogMap() {
    catalogMap.clear();
    localCatalog.forEach(p => {
        if (p.clave) {
            catalogMap.set(p.clave.trim(), p);
        }
        if (p.numParte) {
            catalogMap.set(p.numParte.trim(), p);
        }
    });
    console.log(`Catalog map updated with ${catalogMap.size} unique SKU/PartNumber entries.`);
}

// Load initial catalog if exists on disk
if (fs.existsSync(CATALOG_FILE)) {
    try {
        localCatalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
        updateCatalogMap();
        console.log(`Loaded ${localCatalog.length} products from disk cache on startup.`);
    } catch (e) {
        console.error("Error reading catalog cache:", e);
    }
}

// CT Online Configurations
const CT_FTP_HOST = process.env.CT_FTP_HOST;
const CT_FTP_USER = process.env.CT_FTP_USER;
const CT_FTP_PASS = process.env.CT_FTP_PASS;
const CT_API_BASE = process.env.CT_API_BASE;

// --- 1. Authenticaton (Token Generation) ---
async function getCTToken() {
    // Return cached token if valid
    if (ctToken && tokenExpiry && Date.now() < tokenExpiry) {
        return ctToken;
    }

    try {
        console.log('Generating new CT Online API Token...');
        const response = await axios.post(`${CT_API_BASE}/cliente/token`, {
            email: process.env.CT_EMAIL,
            cliente: process.env.CT_CLIENTE,
            rfc: process.env.CT_RFC
        });

        if (response.data && response.data.token) {
            ctToken = response.data.token;
            // Notificar al servicio de paquetería el nuevo token
            setCTToken(ctToken);
            // Assuming token is valid for 24h, we cache it for 23h to be safe
            tokenExpiry = Date.now() + (23 * 60 * 60 * 1000); 
            console.log('Token generated successfully.');
            return ctToken;
        } else {
            throw new Error("Invalid response format from Token API");
        }
    } catch (error) {
        console.error('Error getting CT Token:', error.message);
        throw error;
    }
}

// --- 2. FTP Catalog Downloader ---
async function downloadCatalog() {
    const client = new ftp.Client();
    // client.ftp.verbose = true;
    try {
        console.log("Connecting to CT FTP for catalog sync...");
        await client.access({
            host: CT_FTP_HOST,
            user: CT_FTP_USER,
            password: CT_FTP_PASS,
            secure: false
        });
        
        console.log("Downloading JSON catalog from /catalogo_xml...");
        await client.cd('catalogo_xml');
        const list = await client.list();
        const jsonFile = list.find(f => f.name.endsWith('.json'));
        
        if (jsonFile) {
            await client.downloadTo(CATALOG_FILE, jsonFile.name);
            console.log(`Catalog ${jsonFile.name} downloaded successfully!`);
            
            // Reload into memory
            const rawData = fs.readFileSync(CATALOG_FILE, 'utf8');
            localCatalog = JSON.parse(rawData);
            console.log(`Loaded ${localCatalog.length} products into memory.`);
        } else {
            console.error("No JSON file found in /catalogo_xml directory.");
        }

    } catch(err) {
        console.error("FTP Sync failed:", err.message);
    } finally {
        client.close();
    }
}

// Automatically sync catalog on startup, then every 15 minutes
downloadCatalog();
setInterval(downloadCatalog, 15 * 60 * 1000);

// --- 3. Express Endpoints for our Frontend ---

// Helper: apply a 10% markup to product price
function applyMarkup(product) {
    if (!product) return product;
    // Deep clone to avoid mutating the cached catalog
    const p = { ...product };
    if (p.precio != null) {
        p.precio = parseFloat((parseFloat(p.precio) * 1.10).toFixed(2));
    }
    // Also handle nested 'articulo' wrapper from CT API live responses
    if (p.articulo && p.articulo.precio != null) {
        p.articulo = { ...p.articulo };
        p.articulo.precio = parseFloat((parseFloat(p.articulo.precio) * 1.10).toFixed(2));
    }
    return p;
}

// Get all products (served from our local downloaded catalog)
app.get('/api/products', (req, res) => {
    console.log('API Products Request:', req.query);
    let results = localCatalog;
    
    // Filter by category or subcategory
    if (req.query.cat) {
        const cat = req.query.cat.toLowerCase().trim();
        results = results.filter(p => p.categoria && p.categoria.toLowerCase().trim() === cat);
    }
    if (req.query.sub) {
        const sub = req.query.sub.toLowerCase().trim();
        results = results.filter(p => p.subcategoria && p.subcategoria.toLowerCase().trim() === sub);
    }

    // Filter by search query
    if (req.query.search) {
        const q = req.query.search.toLowerCase().trim();
        const useOrLogic = req.query.or === '1';
        // Handle commas and spaces as separators
        const tokens = q.split(/[\s,]+/).filter(t => t.length > 0);
        
        results = results.filter(p => {
            const name = (p.nombre || '').toLowerCase();
            const brand = (p.marca || '').toLowerCase();
            const cat = (p.categoria || '').toLowerCase();
            const sub = (p.subcategoria || '').toLowerCase();
            const sku = (p.clave || '').toLowerCase();
            const part = (p.numParte || '').toLowerCase();
            
            const fullText = `${name} ${brand} ${cat} ${sub} ${sku} ${part}`;
            
            if (useOrLogic) {
                // Product matches if ANY search tokens are found
                return tokens.some(token => fullText.includes(token));
            } else {
                // Product matches if ALL search tokens are found
                return tokens.every(token => fullText.includes(token));
            }
        });
    }

    // Return max limit for performance, with markup applied
    const limit = parseInt(req.query.limit) || 50;
    res.json(results.slice(0, limit).map(applyMarkup));
});

// Get specific product details
// Get specific product details
app.get(/^\/api\/products\/(.+)$/, async (req, res) => {
    const codigo = req.params[0].trim();
    
    // 1. Instant Response from Local Catalog
    const localProduct = catalogMap.get(codigo);
    if (localProduct) {
        // Return local version immediately for "Instant Mode"
        res.json(applyMarkup(localProduct));
        
        // OPTIONAL: Background Refresh (Silent)
        // We could fetch from API here to update our local cache for NEXT time
        // but for now, speed is the priority.
        return;
    }

    // 2. Fallback to Live API only if NOT in local catalog
    try {
        const tokenPromise = getCTToken();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Token API Timeout')), 3000));
        
        const token = await Promise.race([tokenPromise, timeoutPromise]);
        const almacen = req.query.almacen || 'DF'; 
        
        const response = await axios.get(`${CT_API_BASE}/articulos/detalle/${codigo}/${almacen}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 3000 
        });
        
        res.json(applyMarkup(response.data));
    } catch (error) {
        console.error(`Status 500 - Detail API Failure for ${codigo}:`, error.message);
        // Ensure we ALWAYS return JSON to avoid frontend parse errors
        res.status(error.response?.status || 500).json({ 
            error: "Product fetch failed", 
            message: error.message,
            sku: codigo
        });
    }
});

// NEW: Bulk product details for cart optimization
app.post('/api/products/bulk', (req, res) => {
    const { skus } = req.body;
    if (!skus || !Array.isArray(skus)) {
        return res.status(400).json({ error: "SKUs array is required" });
    }

    const results = skus.map(sku => {
        const p = catalogMap.get(sku);
        return p ? applyMarkup(p) : { sku, error: "Not found" };
    });

    res.json(results);
});

// Get dynamic categories from the current local catalog
app.get('/api/categories', (req, res) => {
    const categoriesMap = {};
    
    localCatalog.forEach(p => {
        if (!p.categoria) return;
        
        const catName = p.categoria;
        const subcatName = p.subcategoria;
        
        if (!categoriesMap[catName]) {
            categoriesMap[catName] = new Set();
        }
        if (subcatName) {
            categoriesMap[catName].add(subcatName);
        }
    });

    const result = Object.keys(categoriesMap).map(catName => ({
        name: catName,
        subcategories: Array.from(categoriesMap[catName]).sort()
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ categories: result });
});

const imageCache = new Map();

app.get('/api/image-proxy', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL is required');

    // 1. Check Cache
    if (imageCache.has(imageUrl)) {
        const cached = imageCache.get(imageUrl);
        res.set('Content-Type', cached.contentType);
        res.set('Cache-Control', 'public, max-age=31536000');
        return res.send(cached.data);
    }

    try {
        const response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000
        });

        const contentType = response.headers['content-type'];
        const imageData = Buffer.from(response.data, 'binary');

        // 2. Store in Cache (Limit size to avoid OOM if needed, but for prototype 6k items is ok-ish)
        if (imageCache.size > 500) imageCache.clear(); // Simple eviction
        imageCache.set(imageUrl, { data: imageData, contentType });

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(imageData);
    } catch (error) {
        console.error(`Error proxying image ${imageUrl}:`, error.message);
        res.status(500).send('Error fetching image');
    }
});

// Mercado Pago - Crear Preferencia de Pago
app.post('/api/create_preference', async (req, res) => {
    try {
        // Validación de Token
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token || token === 'TEST-1234567890') {
            return res.status(400).json({ 
                error: "TOKEN_PLACEHOLDER", 
                message: "El servidor tiene un token de prueba de Mercado Pago. Debes configurar tu MP_ACCESS_TOKEN real en el archivo .env" 
            });
        }

        let fullUrl = process.env.APP_URL;
        if (!fullUrl) {
            const host = req.get('host') || 'localhost:3001';
            const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
            fullUrl = `${protocol}://${host}`;
        }
        console.log(`[MercadoPago] Full URL for redirects: ${fullUrl}`);

        const body = {
            items: req.body.items,
            back_urls: {
                success: `${fullUrl}/checkout.html?payment=success`,
                failure: `${fullUrl}/checkout.html?payment=failure`,
                pending: `${fullUrl}/checkout.html?payment=pending`
            },
            statement_descriptor: "LUCESA DISTRIBUCION"
        };
        // Some older API versions or SDK abstractions might use back_url (singular). 
        // Adding it also for safety if back_urls fails.
        // body.back_url = body.back_urls; 

        console.log(`[MercadoPago] Creating preference with body:`, JSON.stringify(body, null, 2));

        const preference = new Preference(mpCliente);
        const result = await preference.create({ body });
        
        res.json({
            id: result.id,
            init_point: result.init_point
        });
    } catch (error) {
        console.error("Error creating Mercado Pago preference:", error);
        res.status(500).json({ error: "Error creating checkout preference", details: error.message });
    }
});

// PayPal - Crear Orden
app.post('/api/paypal/create_order', async (req, res) => {
    try {
        const { finalTotal } = req.body;
        
        // 1. Obtener Access Token de PayPal Sandbox
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        const tokenRes = await axios.post('https://api-m.sandbox.paypal.com/v1/oauth2/token', 'grant_type=client_credentials', {
             headers: {
                 'Authorization': `Basic ${authHeader}`,
                 'Content-Type': 'application/x-www-form-urlencoded'
             }
        });
        
        const accessToken = tokenRes.data.access_token;
        
        // 2. Crear Orden
        const orderRes = await axios.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'MXN',
                    value: finalTotal.toString()
                }
            }],
            application_context: {
                brand_name: "LUCESA DISTRIBUCION",
                landing_page: "NO_PREFERENCE",
                user_action: "PAY_NOW",
                return_url: `${req.protocol}://${req.get('host')}/checkout.html?paypal=success`,
                cancel_url: `${req.protocol}://${req.get('host')}/checkout.html?paypal=cancel`
            }
        }, {
             headers: {
                 'Authorization': `Bearer ${accessToken}`,
                 'Content-Type': 'application/json'
             }
        });

        res.json({ id: orderRes.data.id, links: orderRes.data.links });
    } catch (e) {
        console.error("Error creating PayPal order:", e.response ? e.response.data : e.message);
        res.status(500).json({ error: "Error al crear la orden de PayPal. Intente más tarde." });
    }
});

// Mercado Pago - Crear Pago OXXO
app.post('/api/create_payment_oxxo', async (req, res) => {
    try {
        const { items, email, total } = req.body;
        const payment = new Payment(mpCliente);
        
        const result = await payment.create({
            body: {
                transaction_amount: total,
                description: 'Compra en Lucesa Distribución',
                payment_method_id: 'oxxo',
                payer: {
                    email: email || 'invitado@lucesademexico.com'
                }
            }
        });

        res.json({
            id: result.id,
            ticket_url: result.transaction_details.external_resource_url
        });
    } catch (error) {
        console.error("Error creating OXXO payment:", error);
        res.status(500).json({ error: "Error creating OXXO ticket", details: error.message });
    }
});

// Importar servicio de CT para pedidos
import { crearPedidoCT, setCTToken } from './backend/services/ctPaqueteriaService.js';
import { createShippingOrder, saveGuia } from './backend/models/shippingModel.js';

import { createOrderSchema } from './backend/schemas/orderSchemas.js';
import { validateBody } from './backend/middleware/validationMiddleware.js';

// Registrar una nueva venta (Llamado al final del checkout_exitoso)
app.post('/api/orders', validateBody(createOrderSchema), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { cliente, metodo_pago, total, items, shippingInfo, estatus, userId } = req.body;

        await connection.beginTransaction();

        // 1. Insertar la orden principal
        const [orderRes] = await connection.execute(
            `INSERT INTO orders (user_id, cliente_nombre, cliente_email, cliente_telefono, metodo_pago, total, costo_envio, estatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId || null,
                cliente?.nombre || 'Invitado',
                cliente?.email || '-',
                cliente?.telefono || 'N/A',
                metodo_pago || 'Desconocido',
                total || 0,
                shippingInfo?.costo || 0,
                estatus || 'Pagado'
            ]
        );
        const orderId = orderRes.insertId;

        // 2. Insertar los ítems de la orden
        if (items && items.length > 0) {
            for (const it of items) {
                const subtotal = (it.unit_price || 0) * (it.quantity || 1);
                await connection.execute(
                    `INSERT INTO order_items (order_id, sku, titulo, cantidad, precio_unitario, subtotal)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [orderId, it.sku || it.title, it.title, it.quantity, it.unit_price, subtotal]
                );
            }
        }

        await connection.commit();



        console.log(`[Orders] Orden registrada en DB: ID ${orderId}`);

        const orderFormat = {
            id: orderId,
            fecha: new Date().toISOString(),
            cliente: cliente || { nombre: 'Invitado', email: '-', telefono: '-' },
            metodo_pago: metodo_pago || 'Desconocido',
            total: total || 0,
            items: items || [],
            estatus: estatus || 'Pagado',
            numeroGuia: null
        };

        // ─── Automatización de Guía CT CONNECT ───
        if (shippingInfo && shippingInfo.empresa) {
            try {
                // 1. Crear registro en la tabla de envíos (PostgreSQL)
                const shippingRecord = await createShippingOrder({
                    order_id: orderId,
                    paqueteria: shippingInfo.empresa,
                    costo_envio: shippingInfo.costo,
                    codigo_postal: '83113' // Mock o extraído del cliente
                });

                // 2. Intentar crear el pedido en CT
                const ctItems = items.map(it => ({
                    producto: it.sku || it.title,
                    cantidad: it.quantity,
                    precio: it.unit_price,
                    moneda: 'MXN',
                    almacen: 'D2A'
                }));

                const respuestaCT = await crearPedidoCT({ productos: ctItems, destino: '83113' }, shippingInfo);
                
                // 3. Extraer número de guía y persistir
                const numeroGuia = respuestaCT.guiaConnect?.numeroGuia || respuestaCT.numeroGuia || null;
                if (numeroGuia) {
                    await saveGuia(shippingRecord.id, numeroGuia, respuestaCT);
                    orderFormat.numeroGuia = numeroGuia;
                    console.log(`[Orders] Guía CT generada para Orden #${orderId}: ${numeroGuia}`);
                }
            } catch (shippingErr) {
                console.error('[Orders] Error en automatización de guía CT:', shippingErr.message);
            }
        }
        
        // Enviar email de notificación
        sendOrderEmail({ tipo: 'completado', order: orderFormat });
        
        res.json({ success: true, orderId: orderId, numeroGuia: orderFormat.numeroGuia });
    } catch (err) {
        await connection.rollback();
        console.error('[Orders] Error fatal al procesar orden:', err.message);
        res.status(500).json({ error: "No pudimos procesar tu pedido en este momento. Por favor contacta a soporte si el problema persiste." });
    } finally {
        connection.release();
    }
});

// Notificar pedido NO completado (pago fallido o abandonado)
app.post('/api/orders/abandoned', async (req, res) => {
    const orderData = {
        id: req.body.id || ('PAGO-FALLIDO-' + Date.now()),
        fecha: new Date().toISOString(),
        cliente: req.body.cliente || { nombre: 'Invitado', email: '-', telefono: '-' },
        metodo_pago: req.body.metodo_pago || 'Desconocido',
        total: req.body.total || 0,
        items: req.body.items || [],
        estatus: 'Abandonado / Error'
    };
    
    // Enviar email de notificación de pago fallido
    sendOrderEmail({ tipo: 'abandonado', order: orderData });
    
    res.json({ success: true });
});

// Obtener historial de pedidos del usuario logueado
app.get('/api/orders/user', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        try {
            const [orders] = await pool.execute(`
                SELECT id, fecha_pedido as fecha, total, estatus, metodo_pago, costo_envio
                FROM \`orders\`
                WHERE user_id = ?
                ORDER BY fecha_pedido DESC
            `, [userId]);
            
            return res.json(orders);
        } catch (dbErr) {
            console.warn('[Orders] DB_OFFLINE_BYPASS: Simulando pedido para visualizacion');
            return res.json([
                {
                    id: 9999,
                    fecha: new Date().toISOString(),
                    total: 15499.00,
                    estatus: "completado",
                    metodo_pago: "mercadopago",
                    costo_envio: 0
                }
            ]);
        }

    } catch (err) {
        console.error('[Orders] Error fetching user orders:', err.message);
        res.status(500).json({ error: "Ocurrió un error al obtener tus pedidos." });
    }
});

// Obtener todas las ventas con detalles desde DB (Admin)
app.get('/api/admin/sales', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [salesRows] = await pool.execute(`
            SELECT id, fecha_pedido as fecha, cliente_nombre, cliente_email, cliente_telefono, metodo_pago, total, estatus
            FROM \`orders\`
            ORDER BY fecha_pedido DESC
        `);
        
        const sales = [];
        for (const o of salesRows) {
            // Fetch order items for each order
            const [itemsRows] = await pool.execute(`SELECT * FROM order_items WHERE order_id = ?`, [o.id]);
            
            sales.push({
                id: 'PED-' + o.id,
                rawId: o.id,
                fecha: o.fecha,
                cliente: { nombre: o.cliente_nombre, email: o.cliente_email, telefono: o.cliente_telefono },
                metodo_pago: o.metodo_pago,
                total: parseFloat(o.total),
                estatus: o.estatus,
                items: itemsRows
            });
        }
        res.json(sales);
    } catch (err) {
        console.error('[Admin] Error fetching sales:', err.message);
        // Fallback robusto para prototipo
        return res.json([]);
    }
});

// Eliminar / Cancelar Pedido (Admin)
app.delete('/api/admin/orders/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        // In this simulation, we hard delete. In real SQL we could transaction it.
        await pool.execute('DELETE FROM orders WHERE id = ?', [parseInt(orderId)]);
        res.json({ success: true, message: "Pedido eliminado correctamente." });
    } catch (err) {
        console.error('[Admin] Error deleting order:', err.message);
        res.status(500).json({ error: "Error al eliminar el pedido." });
    }
});

// Obtener estadísticas para las tarjetas del Dashboard desde DB
app.get('/api/admin/dashboard-stats', async (req, res) => {
    try {
        const [statsRows] = await pool.execute(`
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as ingresos_totales,
                COUNT(DISTINCT cliente_email) as clientes_unicos
            FROM \`orders\`
        `);
        
        const [payMethodsRows] = await pool.execute(`
            SELECT metodo_pago, COUNT(*) as cantidad
            FROM \`orders\`
            GROUP BY metodo_pago
        `);

        const paymentMethods = {};
        payMethodsRows.forEach(r => {
            paymentMethods[r.metodo_pago] = parseInt(r.cantidad);
        });

        const row = statsRows[0];
        res.json({
            totalVentas: parseInt(row.total_ventas),
            ingresosTotales: parseFloat(row.ingresos_totales),
            clientesUnicos: parseInt(row.clientes_unicos),
            paymentMethods
        });

    } catch (err) {
        console.error('[Admin] Error dashboard stats:', err.message);
        // Fallback robusto para prototipo
        return res.json({
            totalVentas: 0,
            ingresosTotales: 0,
            clientesUnicos: 0,
            paymentMethods: {}
        });
    }
});

// Obtener lista de clientes consolidados desde DB
app.get('/api/admin/customers', async (req, res) => {
    try {
        const [customersRows] = await pool.execute(`
            SELECT 
                cliente_nombre as nombre,
                cliente_email as email,
                cliente_telefono as telefono,
                SUM(total) as total_gastado,
                COUNT(*) as numero_pedidos,
                MAX(fecha_pedido) as ultimo_pedido
            FROM \`orders\`
            GROUP BY cliente_nombre, cliente_email, cliente_telefono
            ORDER BY total_gastado DESC
        `);
        
        const customers = customersRows.map(c => ({
            nombre: c.nombre,
            email: c.email,
            telefono: c.telefono,
            totalGastado: parseFloat(c.total_gastado),
            numeroPedidos: parseInt(c.numero_pedidos),
            ultimoPedido: c.ultimo_pedido
        }));
        
        res.json(customers);

    } catch (err) {
        console.error('[Admin] Error customers:', err.message);
        return res.json([]);
    }
});

// Obtener Inventario Detallado (Admin)
app.get('/api/admin/inventory', verifyToken, requireAdmin, async (req, res) => {
    try {
        const search = (req.query.search || '').toLowerCase().trim();
        const page = parseInt(req.query.page) || 1;
        const limit = 100; // Mostrar de 100 en 100 para no saturar

        // 1. Obtener piezas vendidas desde DB
        const [soldRows] = await pool.execute(`SELECT sku, SUM(cantidad) AS vendidos FROM order_items GROUP BY sku`);
        const soldMap = {};
        soldRows.forEach(r => { soldMap[r.sku] = r.vendidos; });

        // 2. Filtrar y Procesar catálogo
        let filteredCatalog = localCatalog;
        if (search) {
            filteredCatalog = localCatalog.filter(p => 
                (p.nombre || '').toLowerCase().includes(search) || 
                (p.clave || '').toLowerCase().includes(search) ||
                (p.numParte || '').toLowerCase().includes(search)
            );
        }

        const inventory = filteredCatalog.slice(0, 300).map(p => { // Limitamos a los primeros 300 para el admin
            const providerCost = parseFloat(p.precio || 0);
            const finalPrice = parseFloat((providerCost * 1.10).toFixed(2));
            const sku = (p.clave || p.numParte || '').trim();

            // Calcular stock total sumando todos los almacenes
            let totalStock = 0;
            if (p.existencia && typeof p.existencia === 'object') {
                totalStock = Object.values(p.existencia).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
            } else if (typeof p.existencia === 'number') {
                totalStock = p.existencia;
            }

            return {
                sku: sku,
                nombre: p.nombre,
                marca: p.marca || 'N/A',
                categoria: p.categoria || 'N/A',
                costoCompra: providerCost,
                precio: finalPrice,
                stock: totalStock,
                imagen: p.imagen,
                vendidos: soldMap[sku] || 0
            };
        });

        res.json({
            items: inventory,
            totalCount: filteredCatalog.length
        });
    } catch (err) {
        console.error('[Admin] Error inventory:', err.message);
        // Fallback: intentamos cargar catálogo local sin info de ventas de DB
        const inventory = localCatalog.slice(0, 300).map(p => {
            const providerCost = parseFloat(p.precio || 0);
            const sku = (p.clave || p.numParte || '').trim();
            let totalStock = 0;
            if (p.existencia && typeof p.existencia === 'object') {
                totalStock = Object.values(p.existencia).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
            } else if (typeof p.existencia === 'number') { totalStock = p.existencia; }

            return {
                sku: sku,
                nombre: p.nombre,
                marca: p.marca || 'N/A',
                categoria: p.categoria || 'N/A',
                costoCompra: providerCost,
                precio: parseFloat((providerCost * 1.10).toFixed(2)),
                stock: totalStock,
                vendidos: 0
            };
        });
        return res.json({ items: inventory, totalCount: localCatalog.length });
    }
});

// ─── Fallback del Frontend (SPA) ──────────────────────────────────────────
app.get('*', (req, res) => {
    const indexPath = path.resolve(__dirname, './dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend no encontrado (Ruta: ' + indexPath + ')');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Master Server (backend) running on port ${PORT}`);
});
