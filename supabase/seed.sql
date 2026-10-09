-- =====================================================================
-- Datos iniciales: administrador, configuración y catálogo de ejemplo.
-- Ejecutar UNA vez después de la migración (SQL Editor → Run).
-- =====================================================================

-- Administrador inicial. Usuario: admin · PIN temporal: 2580
-- La app obliga a cambiar el PIN en el primer ingreso.
insert into pos.users (username, full_name, role, pin_hash, must_change_pin)
values ('admin', 'Administrador', 'admin', extensions.crypt('2580', extensions.gen_salt('bf', 8)), true)
on conflict (username) do nothing;

-- Clientes de ejemplo
insert into pos.customers (name, doc_type, doc_number, route) values
  ('Bodega San Martín', 'RUC', '10458921821', 'Ruta 1 - Centro'),
  ('Minimarket El Trébol', 'RUC', '20601234567', 'Ruta 2 - Norte'),
  ('Kiosko Escolar María', 'NINGUNO', null, 'Ruta 3 - Colegios'),
  ('Licorería & Snacks 24H', 'RUC', '10789123456', 'Ruta 1 - Centro')
on conflict do nothing;

-- Productos
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182005001', 'Yogurt Gloria Fresa Botellita 190g', 'Bebidas', 'botellita', 120, 24, '2026-10-10', true, 'NUEVO LOTE', 'Display Caja', 'Sabor Fresa (Bebible)', '#db2777', 'from-pink-500/20 to-rose-600/10', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botellita)', 'UND', 1, 1.5, null, null, true from pos.products where barcode = '7750182005001'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'quarter', 'Cuarto de caja (6 unid)', 'CTO (6u)', 6, 8.5, null, null, false from pos.products where barcode = '7750182005001'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media caja (12 unid)', 'MED (12u)', 12, 16, null, null, false from pos.products where barcode = '7750182005001'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Caja Completa (24 unid)', 'CAJA (24u)', 24, 30, null, null, false from pos.products where barcode = '7750182005001'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182001011', 'Inka Kola 500ml Pet', 'Bebidas', 'botella', 240, 24, '2026-10-25', true, 'MÁS VENDIDO', 'Botella Pet', 'Sabor Dorado Original • Bien Helada', '#16a34a', 'from-amber-400/20 to-yellow-500/10', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 2.5, null, null, true from pos.products where barcode = '7750182001011'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio paquete (6 botellas)', 'MED (6b)', 6, 13.5, null, null, false from pos.products where barcode = '7750182001011'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (12 botellas)', 'PAQ (12b)', 12, 25, null, null, false from pos.products where barcode = '7750182001011'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182001028', 'Coca Cola 500ml Pet Sabor Original', 'Bebidas', 'botella', 300, 36, '2027-05-15', true, 'TOP VENTAS', 'Botella Pet', 'Fórmula Original Refrescante', '#dc2626', 'from-red-600/20 to-stone-900/10', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 2.8, null, null, true from pos.products where barcode = '7750182001028'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio paquete (6 botellas)', 'MED (6b)', 6, 15, null, null, false from pos.products where barcode = '7750182001028'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (12 botellas)', 'PAQ (12b)', 12, 28.5, null, null, false from pos.products where barcode = '7750182001028'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182002346', 'Agua San Luis 625ml Sin Gas', 'Bebidas', 'botella', 225, 30, null, false, null, 'Fardo Termocontraíble', 'Agua de Mesa Pura Mineralizada', '#0284c7', 'from-sky-500/20 to-blue-600/10', 15)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 1.8, null, null, true from pos.products where barcode = '7750182002346'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio fardo (7 botellas)', 'MED (7b)', 7, 11.5, null, null, false from pos.products where barcode = '7750182002346'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (15 botellas)', 'PAQ (15b)', 15, 22, null, null, false from pos.products where barcode = '7750182002346'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182003411', 'Fanta Naranja 500ml Pet', 'Bebidas', 'botella', 180, 24, null, false, null, 'Botella Pet', 'Sabor Cítrico Intenso con Gas', '#ea580c', 'from-orange-500/20 to-amber-600/10', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 2.3, null, null, true from pos.products where barcode = '7750182003411'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio paquete (6 botellas)', 'MED (6b)', 6, 12.5, null, null, false from pos.products where barcode = '7750182003411'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (12 botellas)', 'PAQ (12b)', 12, 23.5, null, null, false from pos.products where barcode = '7750182003411'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182004522', 'Sprite Lima-Limón 500ml Pet', 'Bebidas', 'botella', 156, 24, null, false, null, 'Botella Pet', 'Transparente y Refrescante', '#16a34a', 'from-emerald-500/20 to-green-600/10', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 2.3, null, null, true from pos.products where barcode = '7750182004522'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio paquete (6 botellas)', 'MED (6b)', 6, 12.5, null, null, false from pos.products where barcode = '7750182004522'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (12 botellas)', 'PAQ (12b)', 12, 23.5, null, null, false from pos.products where barcode = '7750182004522'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182005633', 'Monster Energy Verde 473ml Lata', 'Bebidas', 'lata', 96, 12, null, true, 'PREMIUM', 'Lata', 'Energizante con Taurina y Ginseng', '#84cc16', 'from-lime-500/20 to-emerald-950/20', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 lata)', 'UND (1l)', 1, 7.5, null, null, true from pos.products where barcode = '7750182005633'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media plancha (6 latas)', 'MED (6l)', 6, 42, null, null, false from pos.products where barcode = '7750182005633'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Plancha cerrada (12 latas)', 'PAQ (12l)', 12, 80, null, null, false from pos.products where barcode = '7750182005633'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750182006744', 'Sporade Mora 500ml Pet', 'Bebidas', 'botella', 144, 24, null, false, null, 'Botella Pet', 'Bebida Rehidratante con Electrolitos', '#9333ea', 'from-purple-500/20 to-indigo-600/10', 12)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 botella)', 'UND (1b)', 1, 2.2, null, null, true from pos.products where barcode = '7750182006744'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio paquete (6 botellas)', 'MED (6b)', 6, 12, null, null, false from pos.products where barcode = '7750182006744'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Fardo completo (12 botellas)', 'PAQ (12b)', 12, 22.5, null, null, false from pos.products where barcode = '7750182006744'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885002012', 'Chocolate Sublime Clásico 30g', 'Chocolates', 'barra', 360, 48, null, true, 'OFERTA MAYORISTA', 'Display Caja', 'Chocolate con Leche y Maní Crocante', '#d97706', 'from-amber-600/20 to-stone-900/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 barra)', 'UND (1u)', 1, 2, null, null, true from pos.products where barcode = '7750885002012'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 barras)', 'MED (12u)', 12, 22, null, null, false from pos.products where barcode = '7750885002012'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (24 barras)', 'PAQ (24u)', 24, 41, null, null, false from pos.products where barcode = '7750885002012'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885003125', 'Chocolate Triángulo D’Onofrio 30g', 'Chocolates', 'barra', 288, 36, null, false, null, 'Display Caja', 'Puro Chocolate con Leche y Forma Icónica', '#b45309', 'from-amber-700/20 to-orange-950/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 barra)', 'UND (1u)', 1, 2.2, null, null, true from pos.products where barcode = '7750885003125'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 barras)', 'MED (12u)', 12, 24, null, null, false from pos.products where barcode = '7750885003125'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (24 barras)', 'PAQ (24u)', 24, 45, null, null, false from pos.products where barcode = '7750885003125'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885004238', 'Bombón Princesa 30g Crema de Maní', 'Chocolates', 'bombón', 240, 30, null, false, null, 'Display Caja', 'Relleno de Suave Crema de Maní', '#e11d48', 'from-rose-600/20 to-pink-950/20', 20)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 bombón)', 'UND (1u)', 1, 2.5, null, null, true from pos.products where barcode = '7750885004238'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (10 bombones)', 'MED (10u)', 10, 23, null, null, false from pos.products where barcode = '7750885004238'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (20 bombones)', 'PAQ (20u)', 20, 44, null, null, false from pos.products where barcode = '7750885004238'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885005341', 'Wafer Cua Cua 18g Chocolate y Vainilla', 'Chocolates', 'paquetito', 432, 48, null, false, null, 'Display Caja', 'Galleta Wafer Bañada en Chocolate', '#f59e0b', 'from-yellow-500/20 to-amber-950/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 wafer)', 'UND (1u)', 1, 1, null, null, true from pos.products where barcode = '7750885005341'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 wafers)', 'MED (12u)', 12, 11, null, null, false from pos.products where barcode = '7750885005341'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (24 wafers)', 'PAQ (24u)', 24, 21, null, null, false from pos.products where barcode = '7750885005341'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622210874512', 'Galletas Oreo Original (Paquetito 36g)', 'Galletas', 'paquetito', 192, 24, null, true, 'CLÁSICO', 'Display Caja', 'Cacao Dark y Crema Vainilla Suave', '#0284c7', 'from-blue-600/20 to-slate-900/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 paquetito)', 'UND (1p)', 1, 1.2, null, null, true from pos.products where barcode = '7622210874512'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 paquetitos)', 'MED (12p)', 12, 13, null, null, false from pos.products where barcode = '7622210874512'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display cerrado (24 paquetitos)', 'PAQ (24p)', 24, 24, null, null, false from pos.products where barcode = '7622210874512'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622210875623', 'Galletas Casino Menta 43g', 'Galletas', 'paquetito', 288, 36, null, false, null, 'Display Caja', 'Galleta de Chocolate Rellena de Crema Menta', '#059669', 'from-emerald-600/20 to-teal-950/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 paquetito)', 'UND (1p)', 1, 1, null, null, true from pos.products where barcode = '7622210875623'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 paquetitos)', 'MED (12p)', 12, 10.5, null, null, false from pos.products where barcode = '7622210875623'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (24 paquetitos)', 'PAQ (24p)', 24, 20, null, null, false from pos.products where barcode = '7622210875623'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622210876734', 'Galletas Doña Pepa 23g con Grageas', 'Galletas', 'paquetito', 384, 48, null, false, null, 'Display Caja', 'Galleta con Cobertura y Dulces Chispas de Colores', '#ec4899', 'from-pink-500/20 to-fuchsia-950/20', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 paquetito)', 'UND (1p)', 1, 1.2, null, null, true from pos.products where barcode = '7622210876734'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (12 paquetitos)', 'MED (12p)', 12, 13, null, null, false from pos.products where barcode = '7622210876734'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (24 paquetitos)', 'PAQ (24p)', 24, 24.5, null, null, false from pos.products where barcode = '7622210876734'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622210877845', 'Galletas Morochas 36g Bañadas en Chocolate', 'Galletas', 'paquetito', 240, 24, null, false, null, 'Display Caja', 'Deliciosa Cobertura de Chocolate Peruano', '#78350f', 'from-amber-900/20 to-stone-900/20', 20)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 paquetito)', 'UND (1p)', 1, 1.3, null, null, true from pos.products where barcode = '7622210877845'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (10 paquetitos)', 'MED (10p)', 10, 12, null, null, false from pos.products where barcode = '7622210877845'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (20 paquetitos)', 'PAQ (20p)', 20, 23, null, null, false from pos.products where barcode = '7622210877845'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7702007011030', 'Chupetín Bon Bon Bum Fresa Intensa', 'Golosinas', 'chupetín', 480, 48, null, true, 'SÚPER PEDIDO', 'Bolsa Sellada', 'Caramelo Cristal Fresa con Centro de Chicle', '#f43f5e', 'from-rose-500/20 to-pink-900/10', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad suelta (1 chupetín)', 'UND (1u)', 1, 0.7, null, null, true from pos.products where barcode = '7702007011030'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media bolsa (12 chupetines)', 'MED (12u)', 12, 7.5, null, null, false from pos.products where barcode = '7702007011030'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Bolsa sellada (24 chupetines)', 'PAQ (24u)', 24, 13.5, null, null, false from pos.products where barcode = '7702007011030'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7702007012141', 'Chupetín Bon Bon Bum Maracuyá Frutas', 'Golosinas', 'chupetín', 360, 36, null, false, null, 'Bolsa Sellada', 'Ácido Maracuyá Refrescante con Chicle', '#f59e0b', 'from-amber-500/20 to-yellow-600/10', 24)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad suelta (1 chupetín)', 'UND (1u)', 1, 0.7, null, null, true from pos.products where barcode = '7702007012141'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media bolsa (12 chupetines)', 'MED (12u)', 12, 7.5, null, null, false from pos.products where barcode = '7702007012141'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Bolsa sellada (24 chupetines)', 'PAQ (24u)', 24, 13.5, null, null, false from pos.products where barcode = '7702007012141'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622300450912', 'Chicle Trident Menta Glacial 5s', 'Golosinas', 'cajita', 216, 36, null, false, null, 'Display Caja', 'Sin Azúcar • Menta Glacial Duradera', '#10b981', 'from-emerald-500/20 to-teal-900/10', 18)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 cajita 5 strips)', 'UND (1c)', 1, 1.5, null, null, true from pos.products where barcode = '7622300450912'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (9 cajitas)', 'MED (9c)', 9, 12.5, null, null, false from pos.products where barcode = '7622300450912'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display sellado (18 cajitas)', 'PAQ (18c)', 18, 23.5, null, null, false from pos.products where barcode = '7622300450912'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622300451023', 'Caramelos Halls Extra Fuerte Negro', 'Golosinas', 'tubito', 240, 24, null, false, null, 'Display Caja', 'Eucalipto y Mentol Extra Fuerte', '#1e293b', 'from-slate-700/20 to-slate-900/20', 20)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 tubito 9 caramelos)', 'UND (1t)', 1, 1.8, null, null, true from pos.products where barcode = '7622300451023'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (10 tubitos)', 'MED (10t)', 10, 17, null, null, false from pos.products where barcode = '7622300451023'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (20 tubitos)', 'PAQ (20t)', 20, 32, null, null, false from pos.products where barcode = '7622300451023'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7622300452134', 'Gomitas Sparkies Frutas Ácidas 40g', 'Golosinas', 'bolsita', 300, 30, null, false, null, 'Display Caja', 'Masticables Frutales con Polvo Ácido', '#f59e0b', 'from-yellow-400/20 to-lime-900/10', 20)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 bolsita)', 'UND (1b)', 1, 1.5, null, null, true from pos.products where barcode = '7622300452134'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Medio display (10 bolsitas)', 'MED (10b)', 10, 14, null, null, false from pos.products where barcode = '7622300452134'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Display caja (20 bolsitas)', 'PAQ (20b)', 20, 26.5, null, null, false from pos.products where barcode = '7622300452134'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885006452', 'Papas Lays Clásicas 40g', 'Snacks', 'bolsa', 180, 24, null, true, 'POPULAR', 'Tira Colgante', 'Papas Nativas Saladas y Crujientes', '#eab308', 'from-yellow-500/20 to-amber-950/20', 18)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 bolsa)', 'UND (1b)', 1, 2, null, null, true from pos.products where barcode = '7750885006452'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media tira (9 bolsas)', 'MED (9b)', 9, 17, null, null, false from pos.products where barcode = '7750885006452'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Tira completa (18 bolsas)', 'PAQ (18b)', 18, 32, null, null, false from pos.products where barcode = '7750885006452'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885007563', 'Chizitos Queso Fiesta 42g', 'Snacks', 'bolsa', 216, 24, null, false, null, 'Tira Colgante', 'Extruido de Maíz Horneado con Queso', '#f97316', 'from-orange-500/20 to-amber-950/20', 18)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 bolsa)', 'UND (1b)', 1, 1.8, null, null, true from pos.products where barcode = '7750885007563'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media tira (9 bolsas)', 'MED (9b)', 9, 15, null, null, false from pos.products where barcode = '7750885007563'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Tira completa (18 bolsas)', 'PAQ (18b)', 18, 28.5, null, null, false from pos.products where barcode = '7750885007563'
on conflict do nothing;
insert into pos.products (barcode, name, category, base_unit_name, stock_base_units, min_stock_alert, expiration_date, is_promo, promo_tag, packaging_type, flavor_note, accent_color, gradient_bg, pieces_per_pack)
values ('7750885008674', 'Doritos Mega Queso 45g', 'Snacks', 'bolsa', 180, 24, null, false, null, 'Tira Colgante', 'Totopos de Maíz Triangulares con Queso Picante', '#dc2626', 'from-red-500/20 to-orange-950/20', 18)
on conflict (barcode) do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'unit', 'Unidad (1 bolsa)', 'UND (1b)', 1, 2.2, null, null, true from pos.products where barcode = '7750885008674'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'half', 'Media tira (9 bolsas)', 'MED (9b)', 9, 18.5, null, null, false from pos.products where barcode = '7750885008674'
on conflict do nothing;
insert into pos.product_presentations (product_id, type, label, short_label, conversion_factor, price, cost, barcode, is_default)
select id, 'pack', 'Tira completa (18 bolsas)', 'PAQ (18b)', 18, 35, null, null, false from pos.products where barcode = '7750885008674'
on conflict do nothing;
insert into pos.stock_movements (product_id, delta, reason)
select id, stock_base_units, 'INICIAL' from pos.products p
 where stock_base_units <> 0 and not exists (select 1 from pos.stock_movements m where m.product_id = p.id);

-- Promociones
insert into pos.promos (badge_text, tag, discount_badge, title, subtitle, original_price, offer_price, saving_text, associated_barcodes)
select 'PROMOCIÓN DESTACADA', 'MAYORISTA', '-15% OFF', 'COMBO INKA KOLA 500ML (12U) + SUBLIME (24U)', '12x Botellas retornables/pet heladas + 1 display completo de chocolate con maní para alta rotación.', 73, 62, 'Ahorras S/ 11', array['7750182001011', '7750885002012']::text[]
where not exists (select 1 from pos.promos where title = 'COMBO INKA KOLA 500ML (12U) + SUBLIME (24U)');
insert into pos.promos (badge_text, tag, discount_badge, title, subtitle, original_price, offer_price, saving_text, associated_barcodes)
select 'OFERTA EXPRESS', 'BODEGAS', '-10% OFF', 'PACK MIXTO GALLETAS (MOROCHAS + OREO)', 'Lleva 1 display de Morochas y 1 display de Oreo a un precio especial para reponer stock.', 22, 19.8, 'Ahorras S/ 2.20', array['7622210877845', '7622210874512']::text[]
where not exists (select 1 from pos.promos where title = 'PACK MIXTO GALLETAS (MOROCHAS + OREO)');
