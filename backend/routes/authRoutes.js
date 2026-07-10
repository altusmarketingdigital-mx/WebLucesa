/**
 * authRoutes.js
 * Rutas de autenticación de usuarios.
 */

import { Router } from 'express';
import { register, login, getMe, updateMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { registerSchema, loginSchema, updateMeSchema } from '../schemas/authSchemas.js';

const router = Router();

/** POST /api/auth/register — Crear cuenta */
router.post('/register', validateBody(registerSchema), register);

/** POST /api/auth/login — Iniciar sesión */
router.post('/login', validateBody(loginSchema), login);

/** GET /api/auth/me — Obtener datos del usuario logueado */
router.get('/me', verifyToken, getMe);

/** PATCH /api/auth/me — Actualizar datos del perfil */
router.patch('/me', verifyToken, validateBody(updateMeSchema), updateMe);

export default router;
