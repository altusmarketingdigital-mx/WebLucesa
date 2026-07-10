/**
 * authController.js
 * Register, Login y Perfil de usuario con JWT + bcrypt.
 * Persistencia real en PostgreSQL.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET  = process.env.JWT_SECRET || 'cambia_este_secreto_en_produccion';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const generateToken = (user) =>
    jwt.sign({ 
        id: user.id, 
        email: user.email, 
        nombre: user.nombre,
        rol: user.es_admin ? 'admin' : 'user'
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export async function register(req, res) {
    try {
        const { nombre, apellido, email, telefono, password } = req.body;

        // Validaciones
        if (!nombre || !email || !password)
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ error: 'Email inválido.' });
        if (password.length < 8)
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

        const emailLower = email.toLowerCase().trim();

        // Verificar si existe el usuario en DB
        const [existRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [emailLower]);
        if (existRows.length > 0) {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
        }


        // Hash de contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // Insertar en DB
        const [insertRes] = await pool.execute(
            `INSERT INTO users (nombre, apellido, email, telefono, password_hash)
             VALUES (?, ?, ?, ?, ?)`,
            [nombre.trim(), (apellido || '').trim(), emailLower, (telefono || '').trim(), passwordHash]
        );

        const newUserId = insertRes.insertId;
        const [userRows] = await pool.execute(
            'SELECT id, nombre, apellido, email, telefono FROM users WHERE id = ?',
            [newUserId]
        );
        const newUser = userRows[0];

        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            token,
            user: { ...newUser, rol: 'user' }
        });
    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

        const emailLower = email.toLowerCase().trim();

        // DEV PROTOTYPE BYPASS: Allow admin login without DB connection
        if (emailLower === 'admin@lucesamexico.com' && password === 'admin123') {
            const mockUser = {
                id: 1,
                nombre: 'Admin Lucesa',
                apellido: '',
                email: 'admin@lucesamexico.com',
                telefono: '5555555555',
                es_admin: true,
                rol: 'admin'
            };
            const token = generateToken(mockUser);
            return res.json({
                success: true,
                token,
                user: mockUser
            });
        }

        const [userRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [emailLower]);
        const user = userRows[0];


        if (!user)
            return res.status(401).json({ error: 'Credenciales incorrectas.' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Credenciales incorrectas.' });

        const token = generateToken(user);

        return res.json({
            success: true,
            token,
            user: {
                id:       user.id,
                nombre:   user.nombre,
                apellido: user.apellido,
                email:    user.email,
                telefono: user.telefono,
                es_admin: user.es_admin,
                rol:      user.es_admin ? 'admin' : 'user'
            }
        });
    } catch (err) {
        console.error('❌ [Auth] Login Error Detail:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

// ─── GET /api/auth/me (protegido) ─────────────────────────────────────────────
export async function getMe(req, res) {
    try {
        // DEV PROTOTYPE BYPASS
        if (req.user && req.user.email === 'admin@lucesamexico.com') {
            return res.json({
                success: true,
                user: {
                    id: 1,
                    nombre: 'Admin Lucesa',
                    apellido: '',
                    email: 'admin@lucesamexico.com',
                    telefono: '5555555555',
                    fecha_registro: '2026-03-24T17:14:54.195Z',
                    es_admin: true
                }
            });
        }

        // req.user viene del middleware verifyToken
        const [userRows] = await pool.execute(
            'SELECT id, nombre, apellido, email, telefono, fecha_registro, es_admin FROM users WHERE id = ?',
            [req.user.id]
        );
        const user = userRows[0];


        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

        return res.json({
            success: true,
            user
        });
    } catch (err) {
        console.error('[Auth] getMe error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

// ─── PATCH /api/auth/me (protegido) ──────────────────────────────────────────
export async function updateMe(req, res) {
    try {
        const userId = req.user.id;
        const { nombre, apellido, telefono, password } = req.body;

        // Construcción de query dinámica o simple
        let query = 'UPDATE users SET ';
        const params = [];
        let count = 1;

        if (nombre) {
            query += `nombre = ?, `;
            params.push(nombre.trim());
        }
        if (apellido) {
            query += `apellido = ?, `;
            params.push(apellido.trim());
        }
        if (telefono) {
            query += `telefono = ?, `;
            params.push(telefono.trim());
        }

        if (password) {
            if (password.length < 8)
                return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
            const passwordHash = await bcrypt.hash(password, 12);
            query += `password_hash = ?, `;
            params.push(passwordHash);
        }


        // Eliminar última coma y espacio
        query = query.slice(0, -2);
        query += ` WHERE id = ?`;
        params.push(userId);

        await pool.execute(query, params);
        
        const [userRows] = await pool.execute(
            'SELECT id, nombre, apellido, email, telefono FROM users WHERE id = ?',
            [userId]
        );
        const u = userRows[0];


        if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

        return res.json({
            success: true,
            user: u
        });
    } catch (err) {
        console.error('[Auth] updateMe error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

