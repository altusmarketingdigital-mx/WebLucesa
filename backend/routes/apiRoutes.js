import { Router } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import paypal from '@paypal/checkout-server-sdk';
import pool from '../db.js';
import { sendOrderEmail } from '../services/emailService.js';
import { crearPedidoCT } from '../services/ctPaqueteriaService.js';
import { createShippingOrder, saveGuia } from '../models/shippingModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

// ─── Mercado Pago ─────────────────────────────────────────────────────────────
const mpCliente = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ─── PayPal ───────────────────────────────────────────────────────────────────
const paypalEnvironment = new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);

// ─── Catálogo ─────────────────────────────────────────────────────────────────
const CATALOG_FILE = path.join(__dirname, '../ct_catalog.json');
let localCatalog = [];
let catalogMap = new Map();

function updateCatalogMap() {
    catalogMap.clear();
    localCatalog.forEach(p => {
        if (p.clave) catalogMap.set(p.clave.trim(), p);
        if (p.numParte) catalogMap.set(p.numParte.trim(), p);
    });
}

if (fs.existsSync(CATALOG_FILE)) {
    try {
        localCatalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
        updateCatalogMap();
    } catch (e) { console.error("Error catálogo:", e); }
}

function applyMarkup(product) {
    if (!product) return product;
    const p = { ...product };
    if (p.precio != null) p.precio = parseFloat((parseFloat(p.precio) * 1.10).toFixed(2));
    if (p.articulo && p.articulo.precio != null) {
        p.articulo = { ...p.articulo };
        p.articulo.precio = parseFloat((parseFloat(p.articulo.precio) * 1.10).toFixed(2));
    }
    return p;
}

// ─── Endpoints de Productos ──────────────────────────────────────────────────
router.get('/products', (req, res) => {
    let results = localCatalog;
    if (req.query.cat) results = results.filter(p => p.categoria?.toLowerCase().trim() === req.query.cat.toLowerCase().trim());
    if (req.query.search) {
        const tokens = req.query.search.toLowerCase().trim().split(/\s+/);
        results = results.filter(p => {
            const fullText = `${p.nombre} ${p.marca} ${p.categoria} ${p.clave} ${p.numParte}`.toLowerCase();
            return tokens.every(t => fullText.includes(t));
        });
    }
    res.json(results.slice(0, 50).map(applyMarkup));
});

router.get('/products/:sku', async (req, res) => {
    const sku = req.params.sku.trim();
    const local = catalogMap.get(sku);
    if (local) return res.json(applyMarkup(local));
    res.status(404).json({ error: "Product not found locally" });
});

router.post('/products/bulk', (req, res) => {
    const { skus } = req.body;
    if (!skus || !Array.isArray(skus)) return res.status(400).json({ error: "SKUs required" });
    res.json(skus.map(s => applyMarkup(catalogMap.get(s)) || { sku: s, error: "Not found" }));
});

router.get('/categories', (req, res) => {
    const categoriesMap = {};
    localCatalog.forEach(p => {
        if (!p.categoria) return;
        if (!categoriesMap[p.categoria]) categoriesMap[p.categoria] = new Set();
        if (p.subcategoria) categoriesMap[p.categoria].add(p.subcategoria);
    });
    res.json({ categories: Object.keys(categoriesMap).map(name => ({ name, subcategories: Array.from(categoriesMap[name]).sort() })) });
});

// ─── Pagos ────────────────────────────────────────────────────────────────────
router.post('/create_preference', async (req, res) => {
    try {
        const preference = new Preference(mpCliente);
        const result = await preference.create({ body: { items: req.body.items, back_urls: { success: `${req.protocol}://${req.get('host')}` }, auto_return: "approved" } });
        res.json({ id: result.id, init_point: result.init_point });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/orders', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { cliente, total, items, shippingInfo } = req.body;
        await connection.beginTransaction();
        const [orderRes] = await connection.execute(
            `INSERT INTO orders (cliente_nombre, cliente_email, total, costo_envio) VALUES (?, ?, ?, ?)`,
            [cliente?.nombre, cliente?.email, total, shippingInfo?.costo || 0]
        );
        await connection.commit();
        res.json({ success: true, orderId: orderRes.insertId });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally { connection.release(); }
});

export default router;
