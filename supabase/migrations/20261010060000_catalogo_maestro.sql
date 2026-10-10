-- Catálogo ampliado: categorías libres y catálogo maestro de productos conocidos.
--
-- 1) pos.categories: las categorías dejan de ser una lista fija en la tabla de productos.
--    Se cargan las categorías habituales de una distribuidora y el admin puede crear más.
-- 2) pos.product_templates: productos conocidos del mercado (marca, nombre, categoría, ilustración,
--    color de la marca y cuántas unidades trae el paquete). Al crear un producto se elige uno y el
--    formulario se llena solo; la tienda solo pone su código de barras, precio y stock.
--    No son productos de la tienda: no tienen precio, stock ni código, y no aparecen a los vendedores.
--
-- Ejecutar en Supabase → SQL Editor después de las migraciones anteriores. No borra datos.

create table if not exists pos.categories (
  name        text primary key check (char_length(name) between 2 and 40),
  art         text not null default 'caja',
  color       text not null default '#9aa8a3',
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table pos.categories enable row level security;

insert into pos.categories (name, art, color, sort_order) values
  ('Caramelos', 'caramelo', '#ff9ec8', 10),
  ('Chupetines', 'chupetin', '#ff6fa8', 11),
  ('Chicles', 'chicle', '#7ad3f0', 12),
  ('Gomitas y marshmallows', 'gomita', '#ffb8b3', 13),
  ('Golosinas', 'caramelo', '#ff9ec8', 14),
  ('Chocolates', 'chocolate', '#a0522d', 20),
  ('Galletas', 'galleta', '#e8a33b', 30),
  ('Wafers', 'wafer', '#d9a066', 31),
  ('Snacks', 'papitas', '#f5c242', 40),
  ('Frutos secos', 'mani', '#c98b4b', 41),
  ('Gaseosas', 'gaseosa', '#e5484d', 50),
  ('Aguas', 'agua', '#6cb8f0', 51),
  ('Jugos y néctares', 'jugo', '#ffa94d', 52),
  ('Energizantes', 'energizante', '#5b3fc4', 53),
  ('Rehidratantes', 'deportiva', '#2fb7c7', 54),
  ('Bebidas', 'gaseosa', '#6cb8f0', 55),
  ('Lácteos y yogures', 'yogur', '#f4a6c8', 60),
  ('Kekes y panes', 'keke', '#d4935a', 70),
  ('Helados', 'helado', '#98e1c3', 80),
  ('Cervezas', 'cerveza', '#d9a521', 90),
  ('Licores', 'licor', '#7a3b8f', 91),
  ('Otros', 'caja', '#9aa8a3', 99)
on conflict (name) do nothing;

-- Cualquier categoría ya usada por un producto queda registrada.
insert into pos.categories (name)
select distinct category from pos.products
on conflict (name) do nothing;

-- La categoría del producto pasa a validarse contra la tabla (antes era una lista fija).
alter table pos.products drop constraint if exists products_category_check;
alter table pos.products drop constraint if exists products_category_fkey;
alter table pos.products
  add constraint products_category_fkey foreign key (category) references pos.categories(name) on update cascade;

create table if not exists pos.product_templates (
  id              bigint generated always as identity primary key,
  brand           text not null,
  name            text not null,
  category        text not null references pos.categories(name) on update cascade,
  art             text not null,
  color           text not null,
  base_unit_name  text not null default 'unidad',
  pack_factor     integer check (pack_factor is null or pack_factor > 1),
  half_factor     integer check (half_factor is null or half_factor > 1),
  packaging_type  text,
  unique (brand, name)
);
alter table pos.product_templates enable row level security;
create index if not exists product_templates_search_idx on pos.product_templates (lower(name), lower(brand));

insert into pos.product_templates (brand, name, category, art, color, base_unit_name, pack_factor, half_factor, packaging_type) values
  ('Sayón', 'Caramelos Sayón Frutas surtidas', 'Caramelos', 'caramelo', '#e5484d', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Sayón', 'Caramelos Sayón Menta', 'Caramelos', 'caramelo', '#e5484d', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Sayón', 'Caramelos Sayón Leche', 'Caramelos', 'caramelo', '#e5484d', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Sayón', 'Caramelos Sayón Fresa', 'Caramelos', 'caramelo', '#e5484d', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Halls', 'Halls Negro', 'Caramelos', 'caramelo-tira', '#1f2a44', 'barra', 12, 6, 'Display Caja'),
  ('Halls', 'Halls Mentol', 'Caramelos', 'caramelo-tira', '#3aa6e0', 'barra', 12, 6, 'Display Caja'),
  ('Halls', 'Halls Fresa', 'Caramelos', 'caramelo-tira', '#3aa6e0', 'barra', 12, 6, 'Display Caja'),
  ('Halls', 'Halls Cereza', 'Caramelos', 'caramelo-tira', '#3aa6e0', 'barra', 12, 6, 'Display Caja'),
  ('Halls', 'Halls Miel limón', 'Caramelos', 'caramelo-tira', '#3aa6e0', 'barra', 12, 6, 'Display Caja'),
  ('Halls', 'Halls Sandía', 'Caramelos', 'caramelo-tira', '#3aa6e0', 'barra', 12, 6, 'Display Caja'),
  ('Ambrosoli', 'Mentitas Ambrosoli', 'Caramelos', 'caramelo-tira', '#2fb7c7', 'tubo', 24, 12, 'Display Caja'),
  ('Ambrosoli', 'Caramelos Ambrosoli surtidos', 'Caramelos', 'caramelo', '#f08a24', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Arcor', 'Butter Toffees Arcor', 'Caramelos', 'caramelo', '#c9822b', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Arcor', 'Butter Toffees Chocolate Arcor', 'Caramelos', 'caramelo', '#7a4a2a', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Arcor', 'Caramelos Arcor Frutales', 'Caramelos', 'caramelo', '#ff7a59', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Colombina', 'Caramelos Coffee Delight', 'Caramelos', 'caramelo', '#6b4226', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Colombina', 'Caramelos Grissly', 'Caramelos', 'caramelo', '#f2b134', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Fruna', 'Caramelos Fruna', 'Caramelos', 'caramelo', '#e84d8a', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Genérico', 'Caramelos de limón', 'Caramelos', 'caramelo', '#c8d93b', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Genérico', 'Caramelos de anís', 'Caramelos', 'caramelo', '#9b7fd1', 'caramelo', 100, 50, 'Bolsa Sellada'),
  ('Colombina', 'Chupetín Bon Bon Bum Fresa', 'Chupetines', 'chupetin', '#e5484d', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Colombina', 'Chupetín Bon Bon Bum Mora', 'Chupetines', 'chupetin', '#8e44ad', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Colombina', 'Chupetín Bon Bon Bum Sandía', 'Chupetines', 'chupetin', '#8e44ad', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Colombina', 'Chupetín Bon Bon Bum Surtido', 'Chupetines', 'chupetin', '#8e44ad', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Colombina', 'Chupetín Globo Pop', 'Chupetines', 'chupetin', '#ff9ec8', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Chupa Chups', 'Chupa Chups surtido', 'Chupetines', 'chupetin', '#f7c600', 'chupetín', 50, 25, 'Display Caja'),
  ('Arcor', 'Chupetín Mr. Pop', 'Chupetines', 'chupetin', '#1e90ff', 'chupetín', 48, 24, 'Bolsa Sellada'),
  ('Genérico', 'Chupetín corazón', 'Chupetines', 'chupetin', '#e84d8a', 'chupetín', 24, 12, 'Bolsa Sellada'),
  ('Trident', 'Trident Menta', 'Chicles', 'chicle', '#2b8ad6', 'paquete', 12, 6, 'Display Caja'),
  ('Trident', 'Trident Hierbabuena', 'Chicles', 'chicle', '#2b8ad6', 'paquete', 12, 6, 'Display Caja'),
  ('Trident', 'Trident Fresa', 'Chicles', 'chicle', '#2b8ad6', 'paquete', 12, 6, 'Display Caja'),
  ('Trident', 'Trident Sandía', 'Chicles', 'chicle', '#2b8ad6', 'paquete', 12, 6, 'Display Caja'),
  ('Bubbaloo', 'Bubbaloo Fresa', 'Chicles', 'chicle', '#ff6fa8', 'chicle', 60, 30, 'Display Caja'),
  ('Bubbaloo', 'Bubbaloo Tutti Frutti', 'Chicles', 'chicle', '#ffa94d', 'chicle', 60, 30, 'Display Caja'),
  ('Adams', 'Chicle Adams Menta', 'Chicles', 'chicle', '#1aa260', 'paquete', 20, 10, 'Display Caja'),
  ('Clorets', 'Clorets Menta', 'Chicles', 'chicle', '#2fb35f', 'paquete', 12, 6, 'Display Caja'),
  ('Arcor', 'Chicle Topline', 'Chicles', 'chicle', '#3aa6e0', 'paquete', 12, 6, 'Display Caja'),
  ('Arcor', 'Chicle Bazooka', 'Chicles', 'chicle', '#e5484d', 'chicle', 100, 50, 'Display Caja'),
  ('Arcor', 'Gomitas Mogul', 'Gomitas y marshmallows', 'gomita', '#ff6b6b', 'bolsita', 12, 6, 'Display Caja'),
  ('Arcor', 'Gomitas Frugelé', 'Gomitas y marshmallows', 'gomita', '#ffb020', 'bolsita', 12, 6, 'Display Caja'),
  ('Trolli', 'Gomitas Trolli', 'Gomitas y marshmallows', 'gomita', '#5b3fc4', 'bolsita', 12, 6, 'Display Caja'),
  ('Haribo', 'Ositos Haribo', 'Gomitas y marshmallows', 'gomita', '#f7c600', 'bolsita', 12, 6, 'Display Caja'),
  ('Arcor', 'Marshmallows Arcor', 'Gomitas y marshmallows', 'marshmallow', '#ff9ec8', 'bolsa', 12, 6, 'Bolsa Sellada'),
  ('Genérico', 'Marshmallows Chiquitín', 'Gomitas y marshmallows', 'marshmallow', '#f7b7d2', 'bolsa', 12, 6, 'Bolsa Sellada'),
  ('Genérico', 'Gomitas de azúcar surtidas', 'Gomitas y marshmallows', 'gomita', '#98e1c3', 'bolsa', 12, 6, 'Bolsa Sellada'),
  ('Nestlé', 'Chocolate Sublime Clásico', 'Chocolates', 'chocolate', '#5a2d82', 'barra', 24, 12, 'Display Caja'),
  ('Nestlé', 'Chocolate Sublime Blanco', 'Chocolates', 'chocolate', '#d9c2a0', 'barra', 24, 12, 'Display Caja'),
  ('Nestlé', 'Chocolate Sublime Almendras', 'Chocolates', 'chocolate', '#7a4a2a', 'barra', 24, 12, 'Display Caja'),
  ('Nestlé', 'Chocolate Sublime Mini', 'Chocolates', 'chocolate', '#5a2d82', 'barra', 24, 12, 'Display Caja'),
  ('D''Onofrio', 'Chocolate Triángulo D''Onofrio', 'Chocolates', 'chocolate', '#c0392b', 'barra', 24, 12, 'Display Caja'),
  ('D''Onofrio', 'Chocolate Princesa', 'Chocolates', 'chocolate', '#e84d8a', 'barra', 20, 10, 'Display Caja'),
  ('Nestlé', 'Bombón Princesa', 'Chocolates', 'bombon', '#e84d8a', 'bombón', 30, 15, 'Display Caja'),
  ('Nestlé', 'Chocolate Lentejas', 'Chocolates', 'lentejas', '#f7c600', 'bolsita', 24, 12, 'Display Caja'),
  ('Nestlé', 'KitKat', 'Chocolates', 'chocolate', '#d62828', 'barra', 24, 12, 'Display Caja'),
  ('Nestlé', 'Chocolate Doña Pepa', 'Chocolates', 'chocolate', '#e8a33b', 'barra', 24, 12, 'Display Caja'),
  ('Costa', 'Chocolate Chocman', 'Chocolates', 'keke', '#e5484d', 'unidad', 24, 12, 'Display Caja'),
  ('Costa', 'Chocolate Vizzio', 'Chocolates', 'bombon', '#5a2d82', 'caja', 12, 6, 'Display Caja'),
  ('Costa', 'Hony Bar', 'Chocolates', 'chocolate', '#f2b134', 'barra', 24, 12, 'Display Caja'),
  ('Costa', 'Chocolate Costa Rellenitos', 'Chocolates', 'chocolate', '#c0392b', 'barra', 24, 12, 'Display Caja'),
  ('Arcor', 'Bon o Bon', 'Chocolates', 'bombon', '#c8102e', 'bombón', 30, 15, 'Display Caja'),
  ('Arcor', 'Chocolate Cofler', 'Chocolates', 'chocolate', '#3b2a8a', 'barra', 24, 12, 'Display Caja'),
  ('Winter''s', 'Chocolate Winter''s', 'Chocolates', 'chocolate', '#2b6cb0', 'barra', 24, 12, 'Display Caja'),
  ('Winter''s', 'Beso de Moza', 'Chocolates', 'bombon', '#e84d8a', 'unidad', 24, 12, 'Display Caja'),
  ('Mars', 'Snickers', 'Chocolates', 'chocolate', '#6b3e26', 'barra', 24, 12, 'Display Caja'),
  ('Mars', 'M&M Maní', 'Chocolates', 'lentejas', '#f7c600', 'bolsita', 24, 12, 'Display Caja'),
  ('Mars', 'Milky Way', 'Chocolates', 'chocolate', '#2e7d32', 'barra', 24, 12, 'Display Caja'),
  ('Hershey', 'Hershey''s Chocolate con leche', 'Chocolates', 'chocolate', '#4e342e', 'barra', 24, 12, 'Display Caja'),
  ('Helena', 'Chocoteja Helena', 'Chocolates', 'bombon', '#7a4a2a', 'unidad', 20, 10, 'Display Caja'),
  ('Field', 'Galleta Soda Field Clásica', 'Galletas', 'galleta-paquete', '#1f6fb2', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Soda Field Integral', 'Galletas', 'galleta-paquete', '#8d6e63', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Casino Menta', 'Galletas', 'galleta-paquete', '#1aa260', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Casino Fresa', 'Galletas', 'galleta-paquete', '#e84d8a', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Casino Chocolate', 'Galletas', 'galleta-paquete', '#6b3e26', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Casino Coco', 'Galletas', 'galleta-paquete', '#d9c2a0', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Casino Lúcuma', 'Galletas', 'galleta-paquete', '#e8a33b', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Morochas', 'Galletas', 'galleta', '#4e342e', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Vainilla Field', 'Galletas', 'galleta', '#f2c14e', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Margarita', 'Galletas', 'galleta', '#f7b733', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Animalitos', 'Galletas', 'galleta', '#ff9f43', 'bolsa', 12, 6, 'Bolsa Sellada'),
  ('Field', 'Galleta Coronita', 'Galletas', 'galleta', '#8e44ad', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Galleta Tentación', 'Galletas', 'galleta', '#c0392b', 'paquete', 6, 3, 'Tira Colgante'),
  ('San Jorge', 'Galleta Soda San Jorge', 'Galletas', 'galleta-paquete', '#d62828', 'paquete', 6, 3, 'Tira Colgante'),
  ('San Jorge', 'Galleta Rellenita Chocolate', 'Galletas', 'galleta', '#6b3e26', 'paquete', 6, 3, 'Tira Colgante'),
  ('San Jorge', 'Galleta Rellenita Fresa', 'Galletas', 'galleta', '#e84d8a', 'paquete', 6, 3, 'Tira Colgante'),
  ('San Jorge', 'Galleta Glacitas', 'Galletas', 'galleta', '#ff9ec8', 'paquete', 6, 3, 'Tira Colgante'),
  ('Mondelez', 'Galleta Oreo', 'Galletas', 'galleta', '#1d3c8f', 'paquete', 6, 3, 'Tira Colgante'),
  ('Mondelez', 'Galleta Ritz', 'Galletas', 'galleta-paquete', '#d62828', 'paquete', 6, 3, 'Tira Colgante'),
  ('Mondelez', 'Galleta Club Social', 'Galletas', 'galleta-paquete', '#1f6fb2', 'paquete', 6, 3, 'Tira Colgante'),
  ('Mondelez', 'Galleta Chips Ahoy', 'Galletas', 'galleta', '#1f4ea1', 'paquete', 6, 3, 'Tira Colgante'),
  ('Nestlé', 'Galleta Doña Pepa', 'Galletas', 'galleta', '#e8a33b', 'paquete', 6, 3, 'Tira Colgante'),
  ('Costa', 'Galleta Picaras', 'Galletas', 'galleta', '#6b3e26', 'paquete', 6, 3, 'Tira Colgante'),
  ('Costa', 'Galleta Chomp', 'Galletas', 'galleta', '#c0392b', 'paquete', 6, 3, 'Tira Colgante'),
  ('Costa', 'Galleta Mini Chips', 'Galletas', 'galleta', '#f2b134', 'paquete', 6, 3, 'Tira Colgante'),
  ('Genérico', 'Galleta de agua', 'Galletas', 'galleta-paquete', '#c8b089', 'paquete', 6, 3, 'Tira Colgante'),
  ('Nestlé', 'Wafer Cua Cua', 'Wafers', 'wafer', '#f7c600', 'unidad', 18, 9, 'Display Caja'),
  ('Field', 'Wafer Field Chocolate', 'Wafers', 'wafer', '#6b3e26', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Wafer Field Fresa', 'Wafers', 'wafer', '#e84d8a', 'paquete', 6, 3, 'Tira Colgante'),
  ('Field', 'Wafer Field Vainilla', 'Wafers', 'wafer', '#f2c14e', 'paquete', 6, 3, 'Tira Colgante'),
  ('Costa', 'Wafer Nik', 'Wafers', 'wafer', '#e5484d', 'paquete', 6, 3, 'Tira Colgante'),
  ('San Jorge', 'Wafer San Jorge', 'Wafers', 'wafer', '#d62828', 'paquete', 6, 3, 'Tira Colgante'),
  ('Lay''s', 'Papas Lay''s Clásicas', 'Snacks', 'papitas', '#f7c600', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Lay''s', 'Papas Lay''s Onduladas', 'Snacks', 'papitas', '#2b8ad6', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Lay''s', 'Papas Lay''s Picantes', 'Snacks', 'papitas', '#e5484d', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Doritos', 'Doritos Queso', 'Snacks', 'papitas', '#e5484d', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Doritos', 'Doritos Mega Queso', 'Snacks', 'papitas', '#d62828', 'bolsita', 18, 9, 'Tira Colgante'),
  ('Cheetos', 'Cheetos Queso', 'Snacks', 'papitas', '#ff8f1f', 'bolsita', 12, 6, 'Tira Colgante'),
  ('PepsiCo', 'Piqueo Snax', 'Snacks', 'papitas', '#1aa260', 'bolsita', 12, 6, 'Tira Colgante'),
  ('PepsiCo', 'Cuates Picantes', 'Snacks', 'papitas', '#e5484d', 'bolsita', 12, 6, 'Tira Colgante'),
  ('PepsiCo', 'Tor-Tees', 'Snacks', 'papitas', '#f2b134', 'bolsita', 12, 6, 'Tira Colgante'),
  ('PepsiCo', 'Chizitos', 'Snacks', 'papitas', '#ff8f1f', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Karinto', 'Karinto Papitas', 'Snacks', 'papitas', '#2b8ad6', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Karinto', 'Karinto Chifles', 'Snacks', 'papitas', '#1aa260', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Inka Crops', 'Inka Chips', 'Snacks', 'papitas', '#5b3fc4', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Pringles', 'Pringles Original', 'Snacks', 'tubo-papas', '#e5484d', 'tubo', 12, 6, 'Display Caja'),
  ('Genérico', 'Canchita para microondas', 'Snacks', 'canchita', '#f7c600', 'bolsa', 12, 6, 'Display Caja'),
  ('Genérico', 'Canchita dulce', 'Snacks', 'canchita', '#e84d8a', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Genérico', 'Chifles piuranos', 'Snacks', 'papitas', '#8bc34a', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Karinto', 'Karinto Maní salado', 'Frutos secos', 'mani', '#c98b4b', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Karinto', 'Karinto Habas', 'Frutos secos', 'mani', '#8bc34a', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Karinto', 'Karinto Maní japonés', 'Frutos secos', 'mani', '#e5484d', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Genérico', 'Mix de frutos secos', 'Frutos secos', 'mani', '#a1887f', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Genérico', 'Pasas', 'Frutos secos', 'mani', '#6d4c41', 'bolsita', 12, 6, 'Tira Colgante'),
  ('Inca Kola', 'Inca Kola 500 ml', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola 500 ml', 'Gaseosas', 'gaseosa', '#e41e2b', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Inca Kola', 'Inca Kola 1 L', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola 1 L', 'Gaseosas', 'gaseosa', '#e41e2b', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Inca Kola', 'Inca Kola 1.5 L', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola 1.5 L', 'Gaseosas', 'gaseosa', '#e41e2b', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('Inca Kola', 'Inca Kola 3 L', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola 3 L', 'Gaseosas', 'gaseosa', '#e41e2b', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Inca Kola', 'Inca Kola Sin Azúcar 500 ml', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola Sin Azúcar 500 ml', 'Gaseosas', 'gaseosa', '#1f1f1f', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Coca-Cola', 'Coca-Cola lata 355 ml', 'Gaseosas', 'lata', '#e41e2b', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Inca Kola', 'Inca Kola lata 355 ml', 'Gaseosas', 'lata', '#f6c700', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Pepsi', 'Pepsi 500 ml', 'Gaseosas', 'gaseosa', '#1f4e9e', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Pepsi', 'Pepsi 3 L', 'Gaseosas', 'gaseosa', '#1f4e9e', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Seven Up', 'Seven Up 500 ml', 'Gaseosas', 'gaseosa', '#1aa260', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Seven Up', 'Seven Up 3 L', 'Gaseosas', 'gaseosa', '#1aa260', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Sprite', 'Sprite 500 ml', 'Gaseosas', 'gaseosa', '#1b9e4b', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Sprite', 'Sprite 3 L', 'Gaseosas', 'gaseosa', '#1b9e4b', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Fanta', 'Fanta Naranja 500 ml', 'Gaseosas', 'gaseosa', '#f47920', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Fanta', 'Fanta Naranja 3 L', 'Gaseosas', 'gaseosa', '#f47920', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Fanta', 'Fanta Kola Inglesa 500 ml', 'Gaseosas', 'gaseosa', '#c8102e', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Fanta', 'Fanta Kola Inglesa 3 L', 'Gaseosas', 'gaseosa', '#c8102e', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Guaraná', 'Guaraná Backus 500 ml', 'Gaseosas', 'gaseosa', '#1aa260', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Guaraná', 'Guaraná Backus 3 L', 'Gaseosas', 'gaseosa', '#1aa260', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Kola Real', 'Kola Real 500 ml', 'Gaseosas', 'gaseosa', '#e5484d', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Kola Real', 'Kola Real 3 L', 'Gaseosas', 'gaseosa', '#e5484d', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Oro', 'Oro 500 ml', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Oro', 'Oro 3 L', 'Gaseosas', 'gaseosa', '#f6c700', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Big Cola', 'Big Cola 500 ml', 'Gaseosas', 'gaseosa', '#d62828', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Big Cola', 'Big Cola 3 L', 'Gaseosas', 'gaseosa', '#d62828', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Concordia', 'Concordia Piña 500 ml', 'Gaseosas', 'gaseosa', '#f7c600', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Concordia', 'Concordia Piña 3 L', 'Gaseosas', 'gaseosa', '#f7c600', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('Crush', 'Crush Naranja 500 ml', 'Gaseosas', 'gaseosa', '#ff8f1f', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Crush', 'Crush Naranja 3 L', 'Gaseosas', 'gaseosa', '#ff8f1f', 'botella', 4, 2, 'Fardo Termocontraíble'),
  ('San Luis', 'Agua San Luis sin gas 625 ml', 'Aguas', 'agua', '#3a7bd5', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('San Luis', 'Agua San Luis sin gas 2.5 L', 'Aguas', 'agua', '#3a7bd5', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('Cielo', 'Agua Cielo sin gas 625 ml', 'Aguas', 'agua', '#00a3e0', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('Cielo', 'Agua Cielo sin gas 2.5 L', 'Aguas', 'agua', '#00a3e0', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('San Mateo', 'Agua San Mateo sin gas 625 ml', 'Aguas', 'agua', '#1f6fb2', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('San Mateo', 'Agua San Mateo sin gas 2.5 L', 'Aguas', 'agua', '#1f6fb2', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('Vida', 'Agua Vida sin gas 625 ml', 'Aguas', 'agua', '#2fb7c7', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('Vida', 'Agua Vida sin gas 2.5 L', 'Aguas', 'agua', '#2fb7c7', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('Benedictino', 'Agua Benedictino sin gas 625 ml', 'Aguas', 'agua', '#0e6db3', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('Benedictino', 'Agua Benedictino sin gas 2.5 L', 'Aguas', 'agua', '#0e6db3', 'botella', 6, 3, 'Fardo Termocontraíble'),
  ('San Luis', 'Agua San Luis con gas 625 ml', 'Aguas', 'agua', '#1f4e9e', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('San Mateo', 'Agua San Mateo con gas 600 ml', 'Aguas', 'agua', '#1f4e9e', 'botella', 15, 7, 'Fardo Termocontraíble'),
  ('Socosani', 'Agua mineral Socosani', 'Aguas', 'agua', '#2b8ad6', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('San Carlos', 'Agua San Carlos con gas', 'Aguas', 'agua', '#1aa260', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Genérico', 'Bidón de agua 20 L', 'Aguas', 'agua', '#6cb8f0', 'bidón', null, null, null),
  ('Frugos', 'Frugos del Valle Durazno 300 ml', 'Jugos y néctares', 'jugo', '#ffa94d', 'unidad', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Durazno 1 L', 'Jugos y néctares', 'jugo', '#ffa94d', 'caja', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Naranja 300 ml', 'Jugos y néctares', 'jugo', '#f47920', 'unidad', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Naranja 1 L', 'Jugos y néctares', 'jugo', '#f47920', 'caja', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Manzana 300 ml', 'Jugos y néctares', 'jugo', '#e5484d', 'unidad', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Manzana 1 L', 'Jugos y néctares', 'jugo', '#e5484d', 'caja', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Mango 300 ml', 'Jugos y néctares', 'jugo', '#f7b733', 'unidad', 12, 6, 'Display Caja'),
  ('Frugos', 'Frugos del Valle Mango 1 L', 'Jugos y néctares', 'jugo', '#f7b733', 'caja', 12, 6, 'Display Caja'),
  ('Pulp', 'Pulp Durazno', 'Jugos y néctares', 'jugo', '#ffa94d', 'cajita', 24, 12, 'Display Caja'),
  ('Pulp', 'Pulp Manzana', 'Jugos y néctares', 'jugo', '#e5484d', 'cajita', 24, 12, 'Display Caja'),
  ('Gloria', 'Néctar Gloria Durazno', 'Jugos y néctares', 'jugo', '#ffa94d', 'caja', 12, 6, 'Display Caja'),
  ('Watts', 'Néctar Watts Durazno', 'Jugos y néctares', 'jugo', '#f7b733', 'caja', 12, 6, 'Display Caja'),
  ('Cifrut', 'Cifrut Naranja', 'Jugos y néctares', 'gaseosa', '#f47920', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Cifrut', 'Cifrut Citrus Punch', 'Jugos y néctares', 'gaseosa', '#e84d8a', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Tampico', 'Tampico Citrus Punch', 'Jugos y néctares', 'gaseosa', '#f7b733', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Genérico', 'Chicha morada 1 L', 'Jugos y néctares', 'jugo', '#5b2a86', 'botella', 12, 6, 'Display Caja'),
  ('Volt', 'Volt Clásico', 'Energizantes', 'energizante', '#1aa260', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Volt', 'Volt Ginseng', 'Energizantes', 'energizante', '#e5484d', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Volt', 'Volt Maracuyá', 'Energizantes', 'energizante', '#f7b733', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Red Bull', 'Red Bull 250 ml', 'Energizantes', 'energizante', '#1f3a93', 'lata', 24, 12, 'Display Caja'),
  ('Monster', 'Monster Energy 473 ml', 'Energizantes', 'energizante', '#1f1f1f', 'lata', 24, 12, 'Display Caja'),
  ('220V', '220V Energizante', 'Energizantes', 'energizante', '#e5484d', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Maltin', 'Maltin Power', 'Energizantes', 'lata', '#6b3e26', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Gatorade', 'Gatorade Tropical 500 ml', 'Rehidratantes', 'deportiva', '#ff8f1f', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Gatorade', 'Gatorade Naranja 500 ml', 'Rehidratantes', 'deportiva', '#f47920', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Gatorade', 'Gatorade Uva 500 ml', 'Rehidratantes', 'deportiva', '#5b3fc4', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Gatorade', 'Gatorade Limón 500 ml', 'Rehidratantes', 'deportiva', '#c8d93b', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Sporade', 'Sporade Tropical', 'Rehidratantes', 'deportiva', '#2fb7c7', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Sporade', 'Sporade Mandarina', 'Rehidratantes', 'deportiva', '#f47920', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Powerade', 'Powerade Mora', 'Rehidratantes', 'deportiva', '#2b8ad6', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Electrolight', 'Electrolight Maracuyá', 'Rehidratantes', 'deportiva', '#f7b733', 'botella', 12, 6, 'Fardo Termocontraíble'),
  ('Gloria', 'Yogurt Gloria Fresa 1 L', 'Lácteos y yogures', 'yogur', '#e84d8a', 'botella', 12, 6, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Fresa 180 g', 'Lácteos y yogures', 'yogur', '#e84d8a', 'botellita', 24, 12, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Vainilla 1 L', 'Lácteos y yogures', 'yogur', '#f2c14e', 'botella', 12, 6, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Vainilla 180 g', 'Lácteos y yogures', 'yogur', '#f2c14e', 'botellita', 24, 12, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Durazno 1 L', 'Lácteos y yogures', 'yogur', '#ffa94d', 'botella', 12, 6, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Durazno 180 g', 'Lácteos y yogures', 'yogur', '#ffa94d', 'botellita', 24, 12, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Lúcuma 1 L', 'Lácteos y yogures', 'yogur', '#c98b4b', 'botella', 12, 6, 'Display Caja'),
  ('Gloria', 'Yogurt Gloria Lúcuma 180 g', 'Lácteos y yogures', 'yogur', '#c98b4b', 'botellita', 24, 12, 'Display Caja'),
  ('Laive', 'Yogurt Laive Fresa', 'Lácteos y yogures', 'yogur', '#e84d8a', 'botella', 12, 6, 'Display Caja'),
  ('Pura Vida', 'Pura Vida Leche', 'Lácteos y yogures', 'leche', '#1f6fb2', 'lata', 24, 12, 'Display Caja'),
  ('Gloria', 'Leche Gloria Azul lata', 'Lácteos y yogures', 'leche', '#1f4e9e', 'lata', 24, 12, 'Display Caja'),
  ('Gloria', 'Leche chocolatada Gloria', 'Lácteos y yogures', 'jugo', '#6b3e26', 'cajita', 24, 12, 'Display Caja'),
  ('Ideal', 'Leche Ideal Amanecer', 'Lácteos y yogures', 'leche', '#e5484d', 'lata', 24, 12, 'Display Caja'),
  ('Bimbo', 'Pingüinos Marinela', 'Kekes y panes', 'keke', '#1f4e9e', 'unidad', 12, 6, 'Display Caja'),
  ('Bimbo', 'Keke Bimbo Marmoleado', 'Kekes y panes', 'keke', '#c98b4b', 'unidad', 12, 6, 'Display Caja'),
  ('Bimbo', 'Pan Bimbo Blanco', 'Kekes y panes', 'pan', '#1f6fb2', 'bolsa', null, null, 'Bolsa Sellada'),
  ('Bimbo', 'Pan Bimbo Integral', 'Kekes y panes', 'pan', '#8d6e63', 'bolsa', null, null, 'Bolsa Sellada'),
  ('Bimbo', 'Gansito', 'Kekes y panes', 'keke', '#e5484d', 'unidad', 12, 6, 'Display Caja'),
  ('Genérico', 'Alfajor de manjar', 'Kekes y panes', 'galleta', '#d9c2a0', 'unidad', 24, 12, 'Display Caja'),
  ('D''Onofrio', 'Panetón D''Onofrio', 'Kekes y panes', 'keke', '#f6c700', 'caja', 6, 3, 'Display Caja'),
  ('Genérico', 'Brownie', 'Kekes y panes', 'keke', '#4e342e', 'unidad', 12, 6, 'Display Caja'),
  ('D''Onofrio', 'Helado Peziduri', 'Helados', 'helado', '#5a2d82', 'unidad', 24, 12, null),
  ('D''Onofrio', 'Helado Sin Parar', 'Helados', 'helado', '#e5484d', 'unidad', 24, 12, null),
  ('D''Onofrio', 'Helado Bombones', 'Helados', 'helado', '#6b3e26', 'unidad', 24, 12, null),
  ('Genérico', 'Chupete de fruta', 'Helados', 'helado', '#98e1c3', 'unidad', 24, 12, null),
  ('Pilsen Callao', 'Cerveza Pilsen Callao 630 ml', 'Cervezas', 'cerveza', '#1aa260', 'botella', 12, 6, 'Display Caja'),
  ('Pilsen Callao', 'Cerveza Pilsen Callao lata 355 ml', 'Cervezas', 'lata', '#1aa260', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Cristal', 'Cerveza Cristal 630 ml', 'Cervezas', 'cerveza', '#e5484d', 'botella', 12, 6, 'Display Caja'),
  ('Cristal', 'Cerveza Cristal lata 355 ml', 'Cervezas', 'lata', '#e5484d', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Cusqueña', 'Cerveza Cusqueña 630 ml', 'Cervezas', 'cerveza', '#d9a521', 'botella', 12, 6, 'Display Caja'),
  ('Cusqueña', 'Cerveza Cusqueña lata 355 ml', 'Cervezas', 'lata', '#d9a521', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Arequipeña', 'Cerveza Arequipeña 630 ml', 'Cervezas', 'cerveza', '#1f4e9e', 'botella', 12, 6, 'Display Caja'),
  ('Arequipeña', 'Cerveza Arequipeña lata 355 ml', 'Cervezas', 'lata', '#1f4e9e', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Corona', 'Cerveza Corona 630 ml', 'Cervezas', 'cerveza', '#f6c700', 'botella', 12, 6, 'Display Caja'),
  ('Corona', 'Cerveza Corona lata 355 ml', 'Cervezas', 'lata', '#f6c700', 'lata', 24, 12, 'Fardo Termocontraíble'),
  ('Genérico', 'Pisco Quebranta 750 ml', 'Licores', 'licor', '#7a3b8f', 'botella', 6, 3, 'Display Caja'),
  ('Cartavio', 'Ron Cartavio Blanco', 'Licores', 'licor', '#d9a521', 'botella', 6, 3, 'Display Caja'),
  ('Russkaya', 'Vodka Russkaya', 'Licores', 'licor', '#1f6fb2', 'botella', 6, 3, 'Display Caja'),
  ('Tabernero', 'Vino Tabernero Borgoña', 'Licores', 'licor', '#7b1e3a', 'botella', 6, 3, 'Display Caja'),
  ('Santiago Queirolo', 'Vino Santiago Queirolo', 'Licores', 'licor', '#5b1a2e', 'botella', 6, 3, 'Display Caja'),
  ('Genérico', 'Anís Najar', 'Licores', 'licor', '#1aa260', 'botella', 6, 3, 'Display Caja')
on conflict (brand, name) do nothing;

-- Catálogo para la app: incluye la lista de categorías.
create or replace function public.pos_catalog(p_token text, p_include_inactive boolean default false)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token);
  if p_include_inactive and v_user.role <> 'admin' then p_include_inactive := false; end if;
  return jsonb_build_object(
    'serverTime', now(),
    'products', (select coalesce(jsonb_agg(pos._product_json(p) order by p.category, p.name), '[]')
                   from pos.products p where p.is_active or p_include_inactive),
    'promos', (select coalesce(jsonb_agg(pos._promo_json(p) order by p.sort_order, p.created_at desc), '[]')
                 from pos.promos p where p.is_active or p_include_inactive),
    'customers', (select coalesce(jsonb_agg(pos._customer_json(c) order by c.name), '[]')
                    from pos.customers c where c.is_active or p_include_inactive),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'art', c.art, 'color', c.color)
                    order by c.sort_order, c.name), '[]') from pos.categories c where c.is_active),
    'settings', (select jsonb_object_agg(key, value) from pos.settings));
end $$;

-- Crear o editar una categoría (solo admin).
create or replace function public.pos_category_save(p_token text, p_category jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_name text := initcap(trim(p_category->>'name')); v_row pos.categories;
begin
  v_user := pos._auth(p_token, array['admin']);
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 40 then
    perform pos._err('DATOS_INVALIDOS', 'El nombre de la categoría debe tener entre 2 y 40 letras.');
  end if;
  insert into pos.categories (name, art, color, sort_order)
  values (v_name, coalesce(nullif(p_category->>'art', ''), 'caja'), coalesce(nullif(p_category->>'color', ''), '#9aa8a3'),
          coalesce((p_category->>'sortOrder')::int, 100))
  on conflict (name) do update set
    art = coalesce(nullif(excluded.art, ''), pos.categories.art),
    color = coalesce(nullif(excluded.color, ''), pos.categories.color),
    is_active = true
  returning * into v_row;
  perform pos._audit(v_user.id, 'CATEGORIA_GUARDADA', 'category', v_row.name);
  return jsonb_build_object('name', v_row.name, 'art', v_row.art, 'color', v_row.color);
end $$;

-- Buscar en el catálogo maestro (por nombre o marca, sin importar tildes ni mayúsculas).
create or replace function public.pos_product_templates(p_token text, p_query text default null, p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_q text := nullif(lower(trim(coalesce(p_query, ''))), '');
begin
  perform pos._auth(p_token, array['admin']);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'brand', t.brand, 'name', t.name, 'category', t.category, 'art', t.art,
             'color', t.color, 'baseUnitName', t.base_unit_name, 'packFactor', t.pack_factor,
             'halfFactor', t.half_factor, 'packagingType', t.packaging_type)), '[]')
    from (
      select * from pos.product_templates t
       where v_q is null
          or translate(lower(t.name || ' ' || t.brand), 'áéíóúü', 'aeiouu') like '%' || translate(v_q, 'áéíóúü', 'aeiouu') || '%'
       order by t.category, t.name
       limit least(greatest(coalesce(p_limit, 30), 1), 100)
    ) t
  );
end $$;

revoke all on function public.pos_category_save(text, jsonb) from public;
revoke all on function public.pos_product_templates(text, text, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.pos_category_save(text, jsonb) to anon, authenticated;
    grant execute on function public.pos_product_templates(text, text, integer) to anon, authenticated;
  end if;
end $$;
