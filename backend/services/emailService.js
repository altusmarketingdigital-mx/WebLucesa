/**
 * emailService.js
 * Servicio centralizado de envío de emails (Nodemailer + Gmail).
 * Maneja notificaciones de pedidos Y cambios de estatus de envío.
 */

import nodemailer from 'nodemailer';

const mailer = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER || 'lucesamexico@gmail.com',
        pass: process.env.GMAIL_APP_PASS
    }
});

const ADMIN_EMAIL  = process.env.NOTIFY_EMAIL || 'lucesamexico@gmail.com';
const BRAND_NAME   = 'LUCESA Distribución';

const formatMXN = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

// ─── Etiquetas de estatus ────────────────────────────────────────────────────
const ESTATUS_LABELS = {
    pendiente:   { emoji: '🕐', label: 'Pendiente de despacho',  color: '#d97706' },
    generada:    { emoji: '📋', label: 'Guía generada',          color: '#2563eb' },
    en_transito: { emoji: '🚚', label: 'En tránsito',            color: '#7c3aed' },
    entregada:   { emoji: '✅', label: 'Entregado',              color: '#059669' },
    cancelada:   { emoji: '❌', label: 'Cancelado',              color: '#dc2626' },
};

// ─── Plantilla HTML base ─────────────────────────────────────────────────────
function baseTemplate(color, titulo, contenido) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:${color};color:white;padding:20px 24px;">
        <h2 style="margin:0;font-size:20px;">${titulo}</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:.85;">${BRAND_NAME}</p>
      </div>
      <div style="padding:24px;">${contenido}</div>
      <div style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#6b7280;text-align:center;">
        Este correo es generado automáticamente. No responder.
      </div>
    </div>`;
}

// ─── 1. Email de cambio de estatus de envío ──────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.guia
 * @param {string} opts.paqueteria
 * @param {string} opts.estatus     - clave interna (en_transito, entregada, etc.)
 * @param {number} opts.orderId
 * @param {string} [opts.clienteEmail]
 */
export async function sendStatusEmail({ guia, paqueteria, estatus, orderId, clienteEmail }) {
    const info = ESTATUS_LABELS[estatus] || { emoji: '📦', label: estatus, color: '#374151' };

    const contenido = `
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;width:140px;padding:6px 0;">Orden:</td><td><strong>#${orderId}</strong></td></tr>
          <tr><td style="color:#6b7280;padding:6px 0;">Guía:</td><td><strong>${guia}</strong></td></tr>
          <tr><td style="color:#6b7280;padding:6px 0;">Paquetería:</td><td>${paqueteria?.toUpperCase()}</td></tr>
          <tr><td style="color:#6b7280;padding:6px 0;">Estatus:</td>
            <td><span style="background:${info.color};color:white;padding:3px 10px;border-radius:12px;font-size:13px;">
              ${info.emoji} ${info.label}
            </span></td>
          </tr>
        </table>`;

    const recipients = [ADMIN_EMAIL];
    if (clienteEmail && clienteEmail !== ADMIN_EMAIL) recipients.push(clienteEmail);

    try {
        await mailer.sendMail({
            from:    `"${BRAND_NAME}" <${ADMIN_EMAIL}>`,
            to:      recipients.join(', '),
            subject: `${info.emoji} Envío ${guia} — ${info.label}`,
            html:    baseTemplate(info.color, `Actualización de Envío ${info.emoji}`, contenido)
        });
        console.log(`✉️  Status email enviado: Orden #${orderId} → ${estatus}`);
    } catch (e) {
        console.error('❌ Error enviando status email:', e.message);
    }
}

// ─── 2. Email de pedido completado / abandonado ──────────────────────────────
/**
 * @param {'completado'|'abandonado'} tipo
 * @param {object} order  - Objeto del pedido con id, metodo_pago, total, items, cliente, estatus
 */
export async function sendOrderEmail({ tipo, order }) {
    const fecha    = new Date(order.fecha || Date.now()).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const esExito  = tipo === 'completado';
    const color    = esExito ? '#1a5c2c' : '#7b1a1a';
    const titulo   = esExito ? '✅ Nuevo Pedido Recibido' : '⚠️ Pago No Completado';
    const asunto   = esExito
        ? `✅ Nuevo Pedido ${order.id} — ${order.metodo_pago}`
        : `⚠️ Pago Fallido / Abandonado — ${order.metodo_pago}`;

    const itemsHtml = (order.items || []).map(i =>
        `<tr>
          <td style="padding:6px 12px;">${i.quantity || 1}x ${i.title || 'Producto'}</td>
          <td style="padding:6px 12px;text-align:right;">${formatMXN((i.unit_price || 0) * (i.quantity || 1))}</td>
        </tr>`
    ).join('');

    const contenido = `
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="color:#6b7280;width:130px;">Folio:</td><td><strong>${order.id || 'N/A'}</strong></td></tr>
          <tr><td style="color:#6b7280;">Método:</td><td>${order.metodo_pago}</td></tr>
          <tr><td style="color:#6b7280;">Cliente:</td><td>${order.cliente?.nombre} (${order.cliente?.email})</td></tr>
          <tr><td style="color:#6b7280;">Fecha:</td><td>${fecha}</td></tr>
          ${order.numeroGuia ? `<tr><td style="color:#6b7280;">Guía CT:</td><td style="font-family:monospace;font-weight:bold;">${order.numeroGuia}</td></tr>` : ''}
        </table>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;">
          <thead><tr style="background:#e5e7eb;">
            <th style="padding:8px 12px;text-align:left;">Artículo</th>
            <th style="padding:8px 12px;text-align:right;">Subtotal</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="text-align:right;font-size:1.2rem;font-weight:bold;margin-top:16px;">
          Total: ${formatMXN(order.total)}
        </div>`;

    try {
        await mailer.sendMail({
            from:    `"${BRAND_NAME}" <${ADMIN_EMAIL}>`,
            to:      ADMIN_EMAIL,
            subject: asunto,
            html:    baseTemplate(color, titulo, contenido)
        });
        console.log(`✉️  Order email [${tipo}] enviado: ${order.id}`);
    } catch (e) {
        console.error('❌ Error enviando order email:', e.message);
    }
}
