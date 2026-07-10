import Joi from 'joi';

/**
 * Esquemas de validación para pedidos
 */

const itemSchema = Joi.object({
    sku: Joi.string().required(),
    title: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    unit_price: Joi.number().min(0).required(),
    currency_id: Joi.string().valid('MXN', 'USD').default('MXN')
});

const shippingInfoSchema = Joi.object({
    empresa: Joi.string().required(),
    costo: Joi.number().min(0).required(),
    codigo_postal: Joi.string().pattern(/^\d{5}$/).allow('', null)
});

export const createOrderSchema = Joi.object({
    cliente: Joi.object({
        nombre: Joi.string().required(),
        email: Joi.string().email().required(),
        telefono: Joi.string().allow('', null)
    }).required(),
    metodo_pago: Joi.string().required(),
    total: Joi.number().min(0).required(),
    items: Joi.array().items(itemSchema).min(1).required(),
    shippingInfo: shippingInfoSchema.allow(null),
    estatus: Joi.string().valid('Pendiente', 'Pagado', 'Cancelado', 'Enviado').default('Pendiente'),
    userId: Joi.number().integer().allow(null)
});
