-- Optimización de Rendimiento: Índices de Base de Datos
-- Fase 9: Acelerar búsquedas de usuarios, pedidos y detalles

-- Índice para búsquedas rápidas de usuarios (ej. login, registro, duplicados)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Índice para historial de pedidos del usuario (Fase 4 y 6)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Índice para join de detalles del pedido
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Índice para vinculación de envíos con pedidos
CREATE INDEX IF NOT EXISTS idx_shipping_orders_order_id ON shipping_orders(order_id);
