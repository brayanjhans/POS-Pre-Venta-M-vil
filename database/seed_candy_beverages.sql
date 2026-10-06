-- ============================================================================
-- DATOS INICIALES (SEED DATA) PARA TIENDA Y DISTRIBUIDORA DE GOLOSINAS Y BEBIDAS
-- ============================================================================

-- Categorías
INSERT INTO categories (id, name, description, icon) VALUES
('cat_bebidas', 'Bebidas', 'Gaseosas, aguas minerales, rehidratantes y jugos', '🥤'),
('cat_chocolates', 'Chocolates', 'Barras, tabletas, bombones y confitados de cacao', '🍫'),
('cat_galletas', 'Galletas', 'Galletas rellenas, saladas, wafer y bañadas', '🍪'),
('cat_golosinas', 'Golosinas', 'Chupetines, caramelos, gomitas y malvaviscos', '🍭'),
('cat_snacks', 'Snacks', 'Papas fritas, chifles, frutos secos y maíz inflado', '🍿')
ON CONFLICT (id) DO NOTHING;

-- Vendedor Preventista Inicial
INSERT INTO sellers (id, code, full_name, dni, phone, assigned_route) VALUES
('vend_001', 'VEND-012', 'Carlos Mendoza', '45892182', '+51 987 654 321', 'Ruta 1 - Cono Norte & Mercado Central')
ON CONFLICT (id) DO NOTHING;

-- Clientes / Bodegas de Prueba
INSERT INTO customers (id, name, business_name, document_type, document_number, route, address, payment_terms) VALUES
('cli_001', 'Bodega San Martín', 'Comercial San Martín E.I.R.L.', 'RUC', '10458921821', 'Ruta 1 - Centro', 'Av. Perú 1420', 'Contado'),
('cli_002', 'Minimarket El Trébol', 'Inversiones El Trébol S.A.C.', 'RUC', '20601234567', 'Ruta 2 - Norte', 'Jr. Los Claveles 380', 'Crédito 7 días'),
('cli_003', 'Kiosko Escolar María', 'María Santos Morales', 'DNI', '42891234', 'Ruta 3 - Colegios', 'Frente a Colegio Alfonso Ugarte', 'Contado'),
('cli_004', 'Licorería & Snacks 24H', 'Distribuciones Nocturnas S.A.C.', 'RUC', '10789123456', 'Ruta 1 - Centro', 'Av. Arequipa 2980', 'Crédito 15 días')
ON CONFLICT (id) DO NOTHING;

-- Producto 1: Inka Kola 500ml Pet
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, min_stock_alert, pieces_per_pack, packaging_type, flavor_note, is_promo)
VALUES ('prod_001', '7750182001011', 'Inka Kola 500ml Pet', 'cat_bebidas', 'botella', 240, 24, 12, 'Fardo Termocontraíble', 'Sabor nacional clásica helada', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price, is_default) VALUES
('pres_001_u', 'prod_001', 'unit', 'Unidad (1 botella)', 'UND', 1, 3.50, TRUE),
('pres_001_h', 'prod_001', 'half', 'Medio fardo (6 botellas)', 'MED (6u)', 6, 19.50, FALSE),
('pres_001_p', 'prod_001', 'pack', 'Fardo cerrado (12 botellas)', 'PAQ (12u)', 12, 38.00, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Producto 2: Chocolate Sublime Clásico 30g
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, min_stock_alert, pieces_per_pack, packaging_type, flavor_note, is_promo)
VALUES ('prod_002', '7750885002012', 'Chocolate Sublime Clásico 30g', 'cat_chocolates', 'barra', 360, 48, 24, 'Display Caja', 'Chocolate con leche y maní tostado', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price, is_default) VALUES
('pres_002_u', 'prod_002', 'unit', 'Unidad (1 barra)', 'UND', 1, 2.50, TRUE),
('pres_002_h', 'prod_002', 'half', 'Medio display (12 barras)', 'MED (12u)', 12, 26.00, FALSE),
('pres_002_p', 'prod_002', 'pack', 'Display completo (24 barras)', 'PAQ (24u)', 24, 50.00, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Producto 3: Galletas Oreo Original 108g
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, min_stock_alert, pieces_per_pack, packaging_type, flavor_note, is_promo)
VALUES ('prod_003', '7622300711019', 'Galletas Oreo Original 108g', 'cat_galletas', 'paquete individual', 180, 24, 12, 'Tira Termosellada', 'Galleta de cacao con crema de vainilla', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price, is_default) VALUES
('pres_003_u', 'prod_003', 'unit', 'Unidad (1 paq 108g)', 'UND', 1, 2.80, TRUE),
('pres_003_h', 'prod_003', 'half', 'Media tira (6 paquetes)', 'MED (6u)', 6, 15.50, FALSE),
('pres_003_p', 'prod_003', 'pack', 'Tira completa (12 paquetes)', 'PAQ (12u)', 12, 29.50, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Producto 4: Chupetín Bon Bon Bum Fresa
INSERT INTO products (id, barcode, name, category_id, base_unit_name, stock_in_base_units, min_stock_alert, pieces_per_pack, packaging_type, flavor_note, is_promo)
VALUES ('prod_004', '7702011030114', 'Chupetín Bon Bon Bum Fresa', 'cat_golosinas', 'chupetín', 480, 48, 24, 'Bolsa Sellada', 'Caramelo sabor fresa con chicle interior', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_presentations (id, product_id, presentation_type, label, short_label, conversion_factor, price, is_default) VALUES
('pres_004_u', 'prod_004', 'unit', 'Unidad (1 chupetín)', 'UND', 1, 0.80, TRUE),
('pres_004_h', 'prod_004', 'half', 'Media bolsa (12 unidades)', 'MED (12u)', 12, 8.50, FALSE),
('pres_004_p', 'prod_004', 'pack', 'Bolsa sellada (24 unidades)', 'PAQ (24u)', 24, 16.00, FALSE)
ON CONFLICT (id) DO NOTHING;
