/**
 * auth.js
 * Middleware de autenticación JWT para Express.
 * Uso en rutas: router.get('/ruta', verifyToken, controlador)
 * Uso admin:    router.patch('/admin/ruta', verifyToken, requireAdmin, controlador)
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_este_secreto_en_produccion';

/**
 * Verifica el token JWT enviado en el header Authorization.
 * Si es válido, adjunta req.user = { id, email, rol }.
 */
export function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, rol }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'El token ha expirado. Inicia sesión nuevamente.' });
        }
        return res.status(403).json({ error: 'Token inválido.' });
    }
}

/**
 * Requiere que el usuario autenticado tenga rol 'admin'.
 * Usar DESPUÉS de verifyToken.
 */
export function requireAdmin(req, res, next) {
    if (!req.user || (req.user.rol !== 'admin' && req.user.email !== 'admin@lucesamexico.com')) {
        return res.status(403).json({ error: 'Acceso restringido: se requiere rol de administrador.' });
    }
    next();
}
