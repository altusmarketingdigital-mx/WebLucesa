import Joi from 'joi';

/**
 * Esquemas de validación para autenticación
 */

export const registerSchema = Joi.object({
    nombre: Joi.string().trim().min(2).max(100).required()
        .messages({ 'any.required': 'El nombre es obligatorio.' }),
    apellido: Joi.string().trim().max(100).allow('', null),
    email: Joi.string().email().trim().lowercase().required()
        .messages({ 'string.email': 'Ingresa un correo electrónico válido.' }),
    telefono: Joi.string().trim().pattern(/^\d{7,15}$/).allow('', null)
        .messages({ 'string.pattern.base': 'El teléfono debe tener entre 7 y 15 dígitos.' }),
    password: Joi.string().min(8).required()
        .messages({ 'string.min': 'La contraseña debe tener al menos 8 caracteres.' })
});

export const loginSchema = Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().required()
});

export const updateMeSchema = Joi.object({
    nombre: Joi.string().trim().min(2).max(100),
    apellido: Joi.string().trim().max(100).allow('', null),
    telefono: Joi.string().trim().pattern(/^\d{7,15}$/).allow('', null),
    password: Joi.string().min(8).allow('', null)
}).min(1); // Al menos un campo para actualizar
