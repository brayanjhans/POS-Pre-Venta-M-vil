-- ============================================================================
-- BASE DE DATOS LOCAL OFFLINE (SQLITE PARA REACT NATIVE / EXPO SQLITE)
-- ALMACENAMIENTO EN EL DISPOSITIVO ANDROID DEL PREVENTISTA
-- ============================================================================

-- 1. TABLA LOCAL DE PRODUCTOS
CREATE TABLE IF NOT EXISTS local_products (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_unit_name TEXT NOT NULL DEFAULT 'unidad',
    stock_in_base_units INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 24,
    pieces_per_pack INTEGER NOT NULL DEFAULT 24,
    packaging_type TEXT DEFAULT 'Display Caja',
    flavor_note TEXT,
    is_promo INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT
);

-- 2. TABLA LOCAL DE PRESENTACIONES (UNIDAD, MEDIO, PAQUETE)
CREATE TABLE IF NOT EXISTS local_presentations (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    presentation_type TEXT NOT NULL, -- 'unit', 'half', 'pack'
    label TEXT NOT NULL,
    short_label TEXT NOT NULL,
    conversion_factor INTEGER NOT NULL,
    price REAL NOT NULL,
    barcode TEXT,
    FOREIGN KEY (product_id) REFERENCES local_products(id) ON DELETE CASCADE
);

-- 3. TABLA LOCAL DE CLIENTES / BODEGAS EN RUTA
CREATE TABLE IF NOT EXISTS local_customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document_number TEXT,
    route TEXT NOT NULL,
    payment_terms TEXT NOT NULL DEFAULT 'Contado'
);

-- 4. TABLA LOCAL DE PEDIDOS DE PRE-VENTA (COLA OFFLINE)
CREATE TABLE IF NOT EXISTS local_orders (
    id TEXT PRIMARY KEY, -- 'PED-00892'
    created_at TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    customer_name TEXT,
    customer_ruc TEXT,
    payment_term TEXT DEFAULT 'Contado',
    status TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
    total_amount REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_base_units INTEGER NOT NULL,
    qr_payload TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending_sync', -- 'synced', 'pending_sync', 'error'
    synced_at TEXT
);

-- 5. TABLA LOCAL DE ÍTEMS DE PEDIDO
CREATE TABLE IF NOT EXISTS local_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    presentation_type TEXT NOT NULL,
    presentation_label TEXT NOT NULL,
    conversion_factor INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    base_units_deducted INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES local_orders(id) ON DELETE CASCADE
);

-- 6. ÍNDICES DE ALTA VELOCIDAD PARA EL ESCÁNER HID (<1ms)
CREATE INDEX IF NOT EXISTS idx_local_products_barcode ON local_products(barcode);
CREATE INDEX IF NOT EXISTS idx_local_presentations_product ON local_presentations(product_id);
CREATE INDEX IF NOT EXISTS idx_local_orders_sync ON local_orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_local_order_items_order ON local_order_items(order_id);
