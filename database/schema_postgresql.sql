-- ============================================================================
-- BASE DE DATOS CENTRAL (POSTGRESQL / SUPABASE / CLOUD SQL)
-- SISTEMA DE PRE-VENTA Y DISTRIBUCIÓN DE GOLOSINAS Y BEBIDAS
-- ============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE CATEGORÍAS
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(20) DEFAULT '🍬',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA PRINCIPAL DE PRODUCTOS (GOLOSINAS Y BEBIDAS)
-- REGLA DE ORO: El stock SIEMPRE se audita en la UNIDAD BASE MÍNIMA (botella, unidad, barra, sobre)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    base_unit_name VARCHAR(50) NOT NULL DEFAULT 'unidad', -- 'botella', 'barra', 'sobre', 'bolsa'
    stock_in_base_units INTEGER NOT NULL DEFAULT 0 CHECK (stock_in_base_units >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 24,
    pieces_per_pack INTEGER NOT NULL DEFAULT 24,
    packaging_type VARCHAR(100) DEFAULT 'Display Caja',
    flavor_note VARCHAR(150),
    is_promo BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE PRESENTACIONES Y PRECIOS INDEPENDIENTES
-- Permite tener Unidad, Medio Paquete y Paquete Completo con precios no-lineales
CREATE TABLE IF NOT EXISTS product_presentations (
    id VARCHAR(60) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presentation_type VARCHAR(20) NOT NULL CHECK (presentation_type IN ('unit', 'half', 'pack')),
    label VARCHAR(150) NOT NULL,
    short_label VARCHAR(30) NOT NULL,
    conversion_factor INTEGER NOT NULL CHECK (conversion_factor >= 1),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    cost NUMERIC(10, 2) DEFAULT 0 CHECK (cost >= 0),
    barcode VARCHAR(64), -- Código de barras propio del fardo o display si existe
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, presentation_type)
);

-- 5. TABLA DE CLIENTES (BODEGAS, MINIMARKETS, KIOSKOS)
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    business_name VARCHAR(200),
    document_type VARCHAR(10) NOT NULL DEFAULT 'RUC' CHECK (document_type IN ('DNI', 'RUC', 'OTRO')),
    document_number VARCHAR(20) NOT NULL,
    route VARCHAR(100) NOT NULL DEFAULT 'Ruta General',
    address TEXT,
    phone VARCHAR(30),
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'Contado' CHECK (payment_terms IN ('Contado', 'Crédito 7 días', 'Crédito 15 días', 'Crédito 30 días')),
    credit_limit NUMERIC(10, 2) DEFAULT 0.00,
    current_debt NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE VENDEDORES (PREVENTISTAS)
CREATE TABLE IF NOT EXISTS sellers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    dni VARCHAR(15) NOT NULL UNIQUE,
    phone VARCHAR(30),
    assigned_route VARCHAR(100),
    commission_percentage NUMERIC(5, 2) DEFAULT 2.50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA DE PEDIDOS DE PRE-VENTA
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY, -- Ej: 'PED-00892'
    seller_id VARCHAR(50) NOT NULL REFERENCES sellers(id),
    customer_id VARCHAR(50) REFERENCES customers(id),
    customer_name VARCHAR(200),
    customer_document VARCHAR(20),
    payment_term VARCHAR(50) NOT NULL DEFAULT 'Contado',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_PAGO' CHECK (status IN ('PENDIENTE_PAGO', 'PAGADO', 'CANCELADO', 'ANULADO')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_base_units INTEGER NOT NULL CHECK (total_base_units >= 0),
    qr_payload VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50), -- 'Efectivo', 'Yape', 'Plin', 'Tarjeta'
    cashier_user_id VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA DE LÍNEAS DE PEDIDO
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(60) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id),
    presentation_type VARCHAR(20) NOT NULL,
    presentation_label VARCHAR(150) NOT NULL,
    conversion_factor INTEGER NOT NULL CHECK (conversion_factor >= 1),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    base_units_deducted INTEGER NOT NULL CHECK (base_units_deducted > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. ÍNDICES DE RENDIMIENTO (Búsqueda ultra rápida en menos de 2 milisegundos)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_presentations_product ON product_presentations(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_qr ON orders(qr_payload);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 10. FUNCIÓN Y TRIGGER PARA DESCONTAR STOCK AL PAGAR EN CAJA
CREATE OR REPLACE FUNCTION fn_deduct_inventory_on_order_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el estado cambia de PENDIENTE_PAGO a PAGADO:
    IF OLD.status = 'PENDIENTE_PAGO' AND NEW.status = 'PAGADO' THEN
        -- Descontar el inventario de cada producto según sus unidades base
        UPDATE products p
        SET stock_in_base_units = p.stock_in_base_units - oi.base_units_deducted,
            updated_at = CURRENT_TIMESTAMP
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
        
        -- Validar que ningún stock quede negativo
        IF EXISTS (
            SELECT 1 FROM products p
            JOIN order_items oi ON oi.product_id = p.id
            WHERE oi.order_id = NEW.id AND p.stock_in_base_units < 0
        ) THEN
            RAISE EXCEPTION 'Error de Almacén: Stock insuficiente para procesar el despacho del pedido %', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_payment ON orders;
CREATE TRIGGER trg_deduct_inventory_on_order_payment
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_deduct_inventory_on_order_payment();

-- 11. VISTA CONVENIENTE: INVENTARIO DESGLOSADO EN PAQUETES Y UNIDADES SUELTAS
CREATE OR REPLACE VIEW view_inventory_balance AS
SELECT 
    p.id,
    p.barcode,
    p.name,
    c.name AS category,
    p.stock_in_base_units,
    p.pieces_per_pack,
    -- Cantidad de paquetes cerrados disponibles
    FLOOR(p.stock_in_base_units / NULLIF(p.pieces_per_pack, 0))::INTEGER AS packs_available,
    -- Unidades sueltas restantes
    (p.stock_in_base_units % NULLIF(p.pieces_per_pack, 0))::INTEGER AS loose_units_available,
    pres_unit.price AS unit_price,
    pres_pack.price AS pack_price,
    CASE 
        WHEN p.stock_in_base_units <= p.min_stock_alert THEN 'CRÍTICO'
        WHEN p.stock_in_base_units <= (p.min_stock_alert * 2) THEN 'BAJO'
        ELSE 'NORMAL'
    END AS stock_status
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN product_presentations pres_unit ON pres_unit.product_id = p.id AND pres_unit.presentation_type = 'unit'
LEFT JOIN product_presentations pres_pack ON pres_pack.product_id = p.id AND pres_pack.presentation_type = 'pack'
WHERE p.is_active = TRUE;
