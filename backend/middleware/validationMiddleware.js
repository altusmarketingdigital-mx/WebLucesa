/**
 * validationMiddleware.js
 * Middleware genérico para validar el req.body usando esquemas de Joi.
 */

export const validateBody = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
    
    if (error) {
        const details = error.details.map(d => ({
            message: d.message,
            path: d.path
        }));
        return res.status(400).json({
            error: 'Datos de entrada inválidos.',
            details
        });
    }
    
    next();
};
