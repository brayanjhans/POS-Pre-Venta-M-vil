-- =====================================================================
-- POS Pre-Venta · Esquema inicial para Supabase (PostgreSQL)
-- ---------------------------------------------------------------------
-- Cómo aplicarlo: Supabase Dashboard → SQL Editor → pegar este archivo
-- completo → Run. Luego ejecutar supabase/seed.sql (admin + catálogo).
--
-- Diseño de seguridad:
--   * Las TABLAS viven en el esquema "pos", que NO está expuesto por la
--     API de Supabase. La app (con la anon key pública) no puede leer ni
--     escribir tablas directamente.
--   * La app solo puede llamar a las FUNCIONES public.pos_* (RPC). Cada
--     una valida el token de sesión y el rol antes de tocar datos, y
--     aplica las reglas de negocio (stock, fiado, límites) dentro de una
--     transacción. Así las reglas no dependen del celular.
--   * Los PIN se guardan con bcrypt; los tokens de sesión con SHA-256.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists pos;
revoke all on schema pos from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema pos from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------

create table pos.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table pos.users (
  id               uuid primary key default gen_random_uuid(),
  username         text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  full_name        text not null check (char_length(full_name) between 2 and 80),
  role             text not null check (role in ('admin', 'vendedor', 'cajero')),
  pin_hash         text not null,
  seller_code      text unique check (seller_code ~ '^[A-Z0-9]{2,6}$'),
  is_active        boolean not null default true,
  must_change_pin  boolean not null default false,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_by       uuid references pos.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table pos.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references pos.users(id) on delete cascade,
  token_hash    bytea not null unique,
  device_info   text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);
create index sessions_user_idx on pos.sessions(user_id);

create table pos.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  doc_type      text not null default 'NINGUNO' check (doc_type in ('DNI', 'RUC', 'OTRO', 'NINGUNO')),
  doc_number    text,
  route         text,
  phone         text,
  address       text,
  credit_limit  numeric(12,2) check (credit_limit is null or credit_limit >= 0), -- null = usar límite por defecto
  is_active     boolean not null default true,
  created_by    uuid references pos.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index customers_doc_uidx on pos.customers(doc_type, doc_number) where doc_number is not null;
create index customers_name_idx on pos.customers(lower(name));

create table pos.products (
  id                uuid primary key default gen_random_uuid(),
  barcode           text not null unique,
  name              text not null check (char_length(name) between 2 and 150),
  category          text not null check (category in ('Golosinas', 'Bebidas', 'Chocolates', 'Snacks', 'Galletas', 'Licores')),
  base_unit_name    text not null default 'unidad',
  stock_base_units  integer not null default 0, -- puede ser negativo: venta sin stock pendiente de regularizar
  min_stock_alert   integer not null default 0 check (min_stock_alert >= 0),
  expiration_date   date,
  image_url         text,
  is_active         boolean not null default true,
  is_promo          boolean not null default false,
  promo_tag         text,
  packaging_type    text,
  flavor_note       text,
  accent_color      text,
  gradient_bg       text,
  pieces_per_pack   integer check (pieces_per_pack is null or pieces_per_pack > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table pos.product_presentations (
  product_id         uuid not null references pos.products(id) on delete cascade,
  type               text not null check (type in ('unit', 'quarter', 'half', 'pack')),
  label              text not null,
  short_label        text not null,
  conversion_factor  integer not null check (conversion_factor >= 1),
  price              numeric(12,2) not null check (price >= 0),
  cost               numeric(12,2) check (cost is null or cost >= 0),
  barcode            text unique,
  is_default         boolean not null default false,
  primary key (product_id, type),
  check (type <> 'unit' or conversion_factor = 1)
);

create table pos.promos (
  id                   uuid primary key default gen_random_uuid(),
  badge_text           text not null default 'PROMOCIÓN',
  tag                  text not null default '',
  discount_badge       text not null default '',
  title                text not null check (char_length(title) between 2 and 150),
  subtitle             text not null default '',
  original_price       numeric(12,2) not null default 0 check (original_price >= 0),
  offer_price          numeric(12,2) not null default 0 check (offer_price >= 0),
  saving_text          text not null default '',
  associated_barcodes  text[] not null default '{}',
  is_active            boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table pos.shifts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references pos.users(id),
  opened_at      timestamptz not null default now(),
  opening_cash   numeric(12,2) not null default 0 check (opening_cash >= 0),
  closed_at      timestamptz,
  expected_cash  numeric(12,2),
  counted_cash   numeric(12,2) check (counted_cash is null or counted_cash >= 0),
  difference     numeric(12,2),
  notes          text
);
create unique index shifts_one_open_per_user on pos.shifts(user_id) where closed_at is null;

create table pos.orders (
  id                   uuid primary key,                 -- generado en el celular (idempotencia offline)
  code                 text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'), -- lo que va en el QR / ticket
  seller_id            uuid not null references pos.users(id),
  shift_id             uuid references pos.shifts(id),
  customer_id          uuid references pos.customers(id),
  customer_name        text,                             -- copia histórica
  customer_doc         text,
  payment_term         text not null check (payment_term in ('Contado', 'Fiado (Libreta)', 'Crédito 7 días', 'Crédito 15 días')),
  status               text not null check (status in ('PENDIENTE_PAGO', 'PAGADO', 'FIADO', 'CANCELADO')),
  gross_amount         numeric(12,2) not null default 0 check (gross_amount >= 0),
  discount_percent     numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount      numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount         numeric(12,2) not null default 0 check (total_amount >= 0),
  total_base_units     integer not null default 0 check (total_base_units >= 0),
  paid_amount          numeric(12,2) not null default 0 check (paid_amount >= 0),
  debt_amount          numeric(12,2) not null default 0 check (debt_amount >= 0),
  returned_containers  integer not null default 0 check (returned_containers >= 0),
  notes                text,
  client_created_at    timestamptz,
  created_at           timestamptz not null default now(),
  settled_at           timestamptz,
  settled_by           uuid references pos.users(id),
  cancelled_at         timestamptz,
  cancelled_by         uuid references pos.users(id),
  cancel_reason        text,
  replaces_order_id    uuid references pos.orders(id)
);
create index orders_status_idx on pos.orders(status, created_at desc);
create index orders_customer_idx on pos.orders(customer_id) where customer_id is not null;
create index orders_seller_idx on pos.orders(seller_id, created_at desc);

create table pos.order_items (
  id                  bigint generated always as identity primary key,
  order_id            uuid not null references pos.orders(id) on delete cascade,
  line_no             integer not null,
  product_id          uuid not null references pos.products(id),
  product_name        text not null,
  presentation_type   text not null,
  presentation_label  text not null,
  conversion_factor   integer not null check (conversion_factor >= 1),
  quantity            integer not null check (quantity > 0),
  unit_price          numeric(12,2) not null check (unit_price >= 0),
  unit_cost           numeric(12,2),
  subtotal            numeric(12,2) not null check (subtotal >= 0),
  base_units          integer not null check (base_units > 0),
  unique (order_id, line_no)
);
create index order_items_product_idx on pos.order_items(product_id);

-- Todo movimiento de dinero: cobro de venta, abono a deuda o devolución por anulación.
create table pos.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references pos.orders(id),
  customer_id  uuid references pos.customers(id),
  kind         text not null check (kind in ('VENTA', 'ABONO', 'DEVOLUCION')),
  method       text not null check (method in ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia')),
  amount       numeric(12,2) not null check (amount <> 0),
  group_id     uuid,          -- un abono repartido en varias boletas comparte group_id
  shift_id     uuid references pos.shifts(id),
  received_by  uuid not null references pos.users(id),
  notes        text,
  created_at   timestamptz not null default now()
);
create index payments_order_idx on pos.payments(order_id);
create index payments_customer_idx on pos.payments(customer_id, created_at desc);
create index payments_shift_idx on pos.payments(shift_id);

create table pos.stock_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references pos.products(id) on delete cascade,
  delta       integer not null,
  reason      text not null check (reason in ('INICIAL', 'VENTA', 'ANULACION', 'REPOSICION', 'AJUSTE', 'COMPRA_EXTERNA')),
  order_id    uuid references pos.orders(id),
  user_id     uuid references pos.users(id),
  unit_cost   numeric(12,2),
  notes       text,
  created_at  timestamptz not null default now()
);
create index stock_movements_product_idx on pos.stock_movements(product_id, created_at desc);

create table pos.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references pos.users(id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  data       jsonb,
  created_at timestamptz not null default now()
);

-- Defensa extra: RLS activado y sin políticas = nadie entra por la API.
alter table pos.settings              enable row level security;
alter table pos.users                 enable row level security;
alter table pos.sessions              enable row level security;
alter table pos.customers             enable row level security;
alter table pos.products              enable row level security;
alter table pos.product_presentations enable row level security;
alter table pos.promos                enable row level security;
alter table pos.shifts                enable row level security;
alter table pos.orders                enable row level security;
alter table pos.order_items           enable row level security;
alter table pos.payments              enable row level security;
alter table pos.stock_movements       enable row level security;
alter table pos.audit_log             enable row level security;

insert into pos.settings(key, value) values
  ('store_name',           '"DISTRIBUIDORA GOLOSINAS"'),
  ('store_ruc',            '""'),
  ('store_address',        '"Av. Los Próceres 840 - Almacén Central"'),
  ('default_credit_limit', '500'),
  ('max_discount_percent', '10'),
  ('session_hours',        '12'),
  ('timezone',             '"America/Lima"');

-- ---------------------------------------------------------------------
-- HELPERS INTERNOS (esquema pos, no invocables desde la API)
-- ---------------------------------------------------------------------

-- Lanza un error de negocio. "hint" lleva el código que la app interpreta.
create function pos._err(p_code text, p_msg text) returns void
language plpgsql as $$
begin
  raise exception using message = p_msg, hint = p_code, errcode = 'P0001';
end $$;

create function pos._setting_num(p_key text, p_default numeric) returns numeric
language sql stable as $$
  select coalesce((select (value #>> '{}')::numeric from pos.settings where key = p_key), p_default)
$$;

create function pos._setting_text(p_key text, p_default text) returns text
language sql stable as $$
  select coalesce((select value #>> '{}' from pos.settings where key = p_key), p_default)
$$;

create function pos._today_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone pos._setting_text('timezone', 'America/Lima')))
         at time zone pos._setting_text('timezone', 'America/Lima')
$$;

create function pos._validate_pin(p_pin text) returns void
language plpgsql as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    perform pos._err('PIN_INVALIDO', 'El PIN debe tener entre 4 y 6 dígitos numéricos.');
  end if;
  if p_pin ~ '^(.)\1+$' or p_pin in ('1234', '12345', '123456', '4321', '654321') then
    perform pos._err('PIN_DEBIL', 'El PIN es demasiado fácil de adivinar. Elija otro.');
  end if;
end $$;

-- Valida el token de sesión y (opcional) el rol. Devuelve el usuario.
create function pos._auth(p_token text, p_roles text[] default null, p_allow_pin_change boolean default false)
returns pos.users
language plpgsql as $$
declare
  v_session pos.sessions;
  v_user    pos.users;
begin
  if p_token is null or length(p_token) < 32 then
    perform pos._err('SESION_INVALIDA', 'Sesión inválida. Inicie sesión nuevamente.');
  end if;

  select * into v_session from pos.sessions
   where token_hash = extensions.digest(p_token, 'sha256')
     and revoked_at is null
     and expires_at > now();
  if not found then
    perform pos._err('SESION_INVALIDA', 'Su sesión expiró. Inicie sesión nuevamente.');
  end if;

  select * into v_user from pos.users where id = v_session.user_id;
  if not v_user.is_active then
    update pos.sessions set revoked_at = now() where id = v_session.id;
    perform pos._err('SESION_INVALIDA', 'Usuario desactivado.');
  end if;
  if v_user.must_change_pin and not p_allow_pin_change then
    perform pos._err('CAMBIO_PIN_REQUERIDO', 'Debe cambiar su PIN antes de continuar.');
  end if;
  if p_roles is not null and not (v_user.role = any(p_roles)) then
    perform pos._err('PERMISO_DENEGADO', 'Su rol no tiene permiso para esta acción.');
  end if;

  if v_session.last_seen_at < now() - interval '1 minute' then
    update pos.sessions set last_seen_at = now() where id = v_session.id;
  end if;
  return v_user;
end $$;

create function pos._audit(p_user uuid, p_action text, p_entity text, p_entity_id text, p_data jsonb default null)
returns void language sql as $$
  insert into pos.audit_log(user_id, action, entity, entity_id, data)
  values (p_user, p_action, p_entity, p_entity_id, p_data)
$$;

create function pos._open_shift_id(p_user uuid) returns uuid
language sql stable as $$
  select id from pos.shifts where user_id = p_user and closed_at is null
$$;

-- Deuda comprometida de un cliente: fiados con saldo + créditos aún no cobrados.
create function pos._customer_exposure(p_customer uuid, p_exclude_order uuid default null)
returns numeric language sql stable as $$
  select coalesce(sum(case
            when status = 'FIADO' then debt_amount
            when status = 'PENDIENTE_PAGO' and payment_term <> 'Contado' then total_amount
            else 0 end), 0)
    from pos.orders
   where customer_id = p_customer
     and id is distinct from p_exclude_order
$$;

create function pos._customer_limit(p_customer uuid) returns numeric
language sql stable as $$
  select coalesce((select credit_limit from pos.customers where id = p_customer),
                  pos._setting_num('default_credit_limit', 500))
$$;

create function pos._check_credit(p_customer uuid, p_new_debt numeric, p_exclude_order uuid) returns void
language plpgsql as $$
declare
  v_current numeric := pos._customer_exposure(p_customer, p_exclude_order);
  v_limit   numeric := pos._customer_limit(p_customer);
begin
  if v_current + p_new_debt > v_limit then
    perform pos._err('LIMITE_CREDITO', format(
      'Límite de crédito superado: el cliente debe S/ %s y con esta operación (S/ %s) llegaría a S/ %s. Tope: S/ %s.',
      to_char(v_current, 'FM999999990.00'), to_char(p_new_debt, 'FM999999990.00'),
      to_char(v_current + p_new_debt, 'FM999999990.00'), to_char(v_limit, 'FM999999990.00')));
  end if;
end $$;

-- p_sign = -1 descuenta (venta), +1 devuelve (anulación).
create function pos._apply_order_stock(p_order uuid, p_sign integer, p_reason text, p_user uuid) returns void
language plpgsql as $$
declare r record;
begin
  for r in select product_id, sum(base_units)::int as units from pos.order_items
            where order_id = p_order group by product_id loop
    update pos.products set stock_base_units = stock_base_units + p_sign * r.units, updated_at = now()
     where id = r.product_id;
    insert into pos.stock_movements(product_id, delta, reason, order_id, user_id)
    values (r.product_id, p_sign * r.units, p_reason, p_order, p_user);
  end loop;
end $$;

create function pos._user_json(u pos.users) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', u.id, 'username', u.username, 'fullName', u.full_name, 'role', u.role,
    'sellerCode', u.seller_code, 'isActive', u.is_active, 'mustChangePin', u.must_change_pin,
    'lastLoginAt', u.last_login_at, 'createdAt', u.created_at,
    'lockedUntil', case when u.locked_until > now() then u.locked_until end)
$$;

create function pos._customer_json(c pos.customers) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'docType', c.doc_type, 'docNumber', c.doc_number,
    'route', c.route, 'phone', c.phone, 'address', c.address,
    'creditLimit', pos._customer_limit(c.id), 'customCreditLimit', c.credit_limit,
    'isActive', c.is_active,
    'debt', pos._customer_exposure(c.id))
$$;

create function pos._product_json(p pos.products) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'barcode', p.barcode, 'name', p.name, 'category', p.category,
    'baseUnitName', p.base_unit_name, 'stockInBaseUnits', p.stock_base_units,
    'minStockAlert', p.min_stock_alert, 'expirationDate', p.expiration_date,
    'imageUrl', p.image_url, 'isActive', p.is_active, 'isPromo', p.is_promo,
    'promoTag', p.promo_tag, 'packagingType', p.packaging_type, 'flavorNote', p.flavor_note,
    'accentColor', coalesce(p.accent_color, '#16a34a'),
    'gradientBg', coalesce(p.gradient_bg, 'from-emerald-500/10 to-transparent'),
    'piecesPerPack', coalesce(p.pieces_per_pack, 1),
    'presentations', (
      select coalesce(jsonb_object_agg(pp.type, jsonb_build_object(
               'id', p.id || '_' || pp.type, 'productId', p.id, 'type', pp.type,
               'label', pp.label, 'shortLabel', pp.short_label,
               'conversionFactor', pp.conversion_factor, 'price', pp.price,
               'cost', pp.cost, 'barcode', pp.barcode, 'isDefault', pp.is_default)), '{}'::jsonb)
        from pos.product_presentations pp where pp.product_id = p.id))
$$;

create function pos._promo_json(p pos.promos) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'badgeText', p.badge_text, 'tag', p.tag, 'discountBadge', p.discount_badge,
    'title', p.title, 'subtitle', p.subtitle, 'originalPrice', p.original_price,
    'offerPrice', p.offer_price, 'savingText', p.saving_text,
    'associatedBarcodes', to_jsonb(p.associated_barcodes), 'isActive', p.is_active)
$$;

create function pos._order_json(p_order uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'qrPayload', o.code,
    'createdAt', o.created_at, 'clientCreatedAt', o.client_created_at,
    'sellerId', o.seller_id, 'sellerName', s.full_name, 'shiftId', o.shift_id,
    'customerId', o.customer_id, 'customerName', o.customer_name, 'customerRuc', o.customer_doc,
    'paymentTerm', o.payment_term, 'status', o.status,
    'grossAmount', o.gross_amount, 'discountPercent', o.discount_percent,
    'discountAmount', o.discount_amount, 'totalAmount', o.total_amount,
    'totalBaseUnits', o.total_base_units, 'paidAmount', o.paid_amount,
    'debtAmount', o.debt_amount, 'returnedContainers', o.returned_containers,
    'notes', o.notes, 'paidAt', o.settled_at, 'settledByName', st.full_name,
    'cancelledAt', o.cancelled_at, 'cancelReason', o.cancel_reason,
    'replacesOrderId', o.replaces_order_id,
    'paymentMethod', (select string_agg(distinct pm.method, ' + ') from pos.payments pm
                       where pm.order_id = o.id and pm.kind = 'VENTA'),
    'syncStatus', 'synced',
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'productId', i.product_id, 'productName', i.product_name,
                'presentationType', i.presentation_type, 'presentationLabel', i.presentation_label,
                'conversionFactor', i.conversion_factor, 'quantity', i.quantity,
                'unitPrice', i.unit_price, 'subtotal', i.subtotal,
                'baseUnitsDeducted', i.base_units) order by i.line_no), '[]'::jsonb)
                from pos.order_items i where i.order_id = o.id))
  from pos.orders o
  join pos.users s on s.id = o.seller_id
  left join pos.users st on st.id = o.settled_by
  where o.id = p_order
$$;

create function pos._shift_summary(p_shift uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', s.id, 'userId', s.user_id, 'userName', u.full_name, 'openedAt', s.opened_at,
    'openingCash', s.opening_cash, 'closedAt', s.closed_at, 'expectedCash', s.expected_cash,
    'countedCash', s.counted_cash, 'difference', s.difference, 'notes', s.notes,
    'byMethod', (select coalesce(jsonb_object_agg(method, total), '{}') from (
                   select method, sum(amount) as total from pos.payments where shift_id = s.id group by method) m),
    'byKind', (select coalesce(jsonb_object_agg(kind, total), '{}') from (
                 select kind, sum(amount) as total from pos.payments where shift_id = s.id group by kind) k),
    'ordersCreated', (select count(*) from pos.orders where shift_id = s.id and status <> 'CANCELADO'),
    'expectedCashNow', s.opening_cash + coalesce((select sum(amount) from pos.payments
                                                   where shift_id = s.id and method = 'Efectivo'), 0))
  from pos.shifts s join pos.users u on u.id = s.user_id
  where s.id = p_shift
$$;

-- ---------------------------------------------------------------------
-- API PÚBLICA (RPC) · AUTENTICACIÓN
-- ---------------------------------------------------------------------

-- Lista de usuarios activos para la pantalla de login (sin datos sensibles).
create function public.pos_login_users()
returns jsonb language sql stable security definer set search_path = pos, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('username', username, 'fullName', full_name, 'role', role)
                            order by case role when 'admin' then 0 when 'cajero' then 1 else 2 end, full_name), '[]')
    from pos.users where is_active
$$;

-- Devuelve {ok:true, token, user} o {ok:false, error, message}.
-- No lanza excepción en PIN incorrecto para que el contador de intentos se guarde.
create function public.pos_login(p_username text, p_pin text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user  pos.users;
  v_token text;
  v_fails integer;
begin
  select * into v_user from pos.users where username = lower(trim(p_username)) for update;
  if not found or not v_user.is_active then
    return jsonb_build_object('ok', false, 'error', 'CREDENCIALES', 'message', 'Usuario o PIN incorrecto.');
  end if;

  if v_user.locked_until is not null and v_user.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'BLOQUEADO', 'message',
      format('Usuario bloqueado por intentos fallidos. Intente en %s min.',
             ceil(extract(epoch from v_user.locked_until - now()) / 60)::int));
  end if;

  if p_pin is null or v_user.pin_hash <> extensions.crypt(p_pin, v_user.pin_hash) then
    v_fails := v_user.failed_attempts + 1;
    update pos.users
       set failed_attempts = v_fails,
           locked_until = case when v_fails % 5 = 0 then now() + interval '5 minutes' else locked_until end
     where id = v_user.id;
    if v_fails % 5 = 0 then
      perform pos._audit(v_user.id, 'LOGIN_BLOQUEADO', 'user', v_user.id::text, jsonb_build_object('device', p_device));
      return jsonb_build_object('ok', false, 'error', 'BLOQUEADO', 'message',
        'Demasiados intentos fallidos. Usuario bloqueado por 5 minutos.');
    end if;
    return jsonb_build_object('ok', false, 'error', 'CREDENCIALES', 'message',
      format('Usuario o PIN incorrecto. Le quedan %s intentos.', 5 - v_fails % 5));
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into pos.sessions(user_id, token_hash, device_info, expires_at)
  values (v_user.id, extensions.digest(v_token, 'sha256'), left(p_device, 200),
          now() + make_interval(hours => pos._setting_num('session_hours', 12)::int));

  update pos.users set failed_attempts = 0, locked_until = null, last_login_at = now()
   where id = v_user.id returning * into v_user;

  -- limpieza de sesiones viejas
  delete from pos.sessions where expires_at < now() - interval '7 days';

  return jsonb_build_object('ok', true, 'token', v_token, 'user', pos._user_json(v_user),
                            'openShift', pos._shift_summary(pos._open_shift_id(v_user.id)));
end $$;

create function public.pos_logout(p_token text)
returns void language sql security definer set search_path = pos, pg_temp as $$
  update pos.sessions set revoked_at = now()
   where token_hash = extensions.digest(p_token, 'sha256') and revoked_at is null
$$;

create function public.pos_me(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token, null, true);
  return jsonb_build_object('user', pos._user_json(v_user),
                            'openShift', pos._shift_summary(pos._open_shift_id(v_user.id)));
end $$;

create function public.pos_change_pin(p_token text, p_current_pin text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token, null, true);
  if v_user.pin_hash <> extensions.crypt(coalesce(p_current_pin, ''), v_user.pin_hash) then
    perform pos._err('CREDENCIALES', 'El PIN actual es incorrecto.');
  end if;
  perform pos._validate_pin(p_new_pin);
  if p_new_pin = p_current_pin then
    perform pos._err('PIN_DEBIL', 'El nuevo PIN debe ser distinto al actual.');
  end if;
  update pos.users set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 8)),
                       must_change_pin = false, updated_at = now()
   where id = v_user.id returning * into v_user;
  perform pos._audit(v_user.id, 'CAMBIO_PIN', 'user', v_user.id::text);
  return pos._user_json(v_user);
end $$;

-- ---------------------------------------------------------------------
-- API · USUARIOS (solo admin)
-- ---------------------------------------------------------------------

create function public.pos_users_list(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
begin
  perform pos._auth(p_token, array['admin']);
  return (select coalesce(jsonb_agg(pos._user_json(u) order by u.is_active desc, u.role, u.full_name), '[]')
            from pos.users u);
end $$;

-- p_user: {username, fullName, role, pin, sellerCode?}
create function public.pos_user_create(p_token text, p_user jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_admin pos.users;
  v_new   pos.users;
  v_pin   text := p_user->>'pin';
begin
  v_admin := pos._auth(p_token, array['admin']);
  perform pos._validate_pin(v_pin);
  begin
    insert into pos.users(username, full_name, role, pin_hash, seller_code, must_change_pin, created_by)
    values (lower(trim(p_user->>'username')), trim(p_user->>'fullName'), p_user->>'role',
            extensions.crypt(v_pin, extensions.gen_salt('bf', 8)),
            nullif(upper(trim(p_user->>'sellerCode')), ''),
            coalesce((p_user->>'mustChangePin')::boolean, true), v_admin.id)
    returning * into v_new;
  exception
    when unique_violation then
      perform pos._err('DUPLICADO', 'Ya existe un usuario con ese nombre de usuario o código de vendedor.');
    when check_violation then
      perform pos._err('DATOS_INVALIDOS',
        'Datos inválidos: usuario de 3-30 caracteres (a-z, 0-9, . _ -), rol admin/vendedor/cajero y código de vendedor de 2-6 letras/números.');
  end;
  perform pos._audit(v_admin.id, 'USUARIO_CREADO', 'user', v_new.id::text,
                     jsonb_build_object('username', v_new.username, 'role', v_new.role));
  return pos._user_json(v_new);
end $$;

-- p_patch: {fullName?, role?, isActive?, sellerCode?, pin?}  (pin = restablecer)
create function public.pos_user_update(p_token text, p_user_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_admin pos.users;
  v_user  pos.users;
  v_role  text;
  v_active boolean;
begin
  v_admin := pos._auth(p_token, array['admin']);
  select * into v_user from pos.users where id = p_user_id for update;
  if not found then perform pos._err('NO_ENCONTRADO', 'Usuario no encontrado.'); end if;

  v_role   := coalesce(p_patch->>'role', v_user.role);
  v_active := coalesce((p_patch->>'isActive')::boolean, v_user.is_active);

  if v_user.id = v_admin.id and (v_role <> 'admin' or not v_active) then
    perform pos._err('PERMISO_DENEGADO', 'No puede quitarse el rol de admin ni desactivarse a sí mismo.');
  end if;
  if v_user.role = 'admin' and (v_role <> 'admin' or not v_active)
     and (select count(*) from pos.users where role = 'admin' and is_active and id <> v_user.id) = 0 then
    perform pos._err('PERMISO_DENEGADO', 'Debe existir al menos un administrador activo.');
  end if;

  if p_patch ? 'pin' then
    perform pos._validate_pin(p_patch->>'pin');
  end if;

  begin
    update pos.users set
      full_name   = coalesce(nullif(trim(p_patch->>'fullName'), ''), full_name),
      role        = v_role,
      is_active   = v_active,
      seller_code = case when p_patch ? 'sellerCode' then nullif(upper(trim(p_patch->>'sellerCode')), '') else seller_code end,
      pin_hash    = case when p_patch ? 'pin' then extensions.crypt(p_patch->>'pin', extensions.gen_salt('bf', 8)) else pin_hash end,
      must_change_pin = case when p_patch ? 'pin' then true else must_change_pin end,
      failed_attempts = case when p_patch ? 'pin' then 0 else failed_attempts end,
      locked_until    = case when p_patch ? 'pin' or coalesce((p_patch->>'unlock')::boolean, false) then null else locked_until end,
      updated_at  = now()
    where id = p_user_id
    returning * into v_user;
  exception
    when unique_violation then perform pos._err('DUPLICADO', 'Ese código de vendedor ya está en uso.');
    when check_violation then perform pos._err('DATOS_INVALIDOS', 'Datos de usuario inválidos.');
  end;

  -- Si se desactiva, cambia de rol o se restablece el PIN: cerrar sus sesiones abiertas.
  if not v_active or p_patch ? 'pin' or p_patch ? 'role' then
    update pos.sessions set revoked_at = now() where user_id = p_user_id and revoked_at is null
       and user_id <> v_admin.id;
  end if;

  perform pos._audit(v_admin.id, 'USUARIO_MODIFICADO', 'user', p_user_id::text, p_patch - 'pin');
  return pos._user_json(v_user);
end $$;

-- ---------------------------------------------------------------------
-- API · CATÁLOGO
-- ---------------------------------------------------------------------

-- Todo lo que la app necesita cachear: productos, promos, clientes y configuración.
create function public.pos_catalog(p_token text, p_include_inactive boolean default false)
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
    'settings', (select jsonb_object_agg(key, value) from pos.settings));
end $$;

-- p_product: objeto con la misma forma que devuelve el catálogo. Sin "id" = crear.
create function public.pos_product_save(p_token text, p_product jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user pos.users;
  v_id   uuid := nullif(p_product->>'id', '')::uuid;
  v_prod pos.products;
  v_initial integer := greatest(coalesce((p_product->>'stockInBaseUnits')::int, 0), 0);
  v_pres jsonb;
  v_type text;
begin
  v_user := pos._auth(p_token, array['admin']);
  if p_product->'presentations'->'unit' is null then
    perform pos._err('DATOS_INVALIDOS', 'El producto debe tener la presentación "Unidad".');
  end if;

  begin
    if v_id is null or not exists (select 1 from pos.products where id = v_id) then
      insert into pos.products(id, barcode, name, category, base_unit_name, stock_base_units, min_stock_alert,
                               expiration_date, image_url, is_active, is_promo, promo_tag, packaging_type,
                               flavor_note, accent_color, gradient_bg, pieces_per_pack)
      values (coalesce(v_id, gen_random_uuid()), trim(p_product->>'barcode'), trim(p_product->>'name'),
              p_product->>'category', coalesce(nullif(trim(p_product->>'baseUnitName'), ''), 'unidad'),
              v_initial, coalesce((p_product->>'minStockAlert')::int, 0),
              nullif(p_product->>'expirationDate', '')::date, p_product->>'imageUrl',
              coalesce((p_product->>'isActive')::boolean, true), coalesce((p_product->>'isPromo')::boolean, false),
              p_product->>'promoTag', p_product->>'packagingType', p_product->>'flavorNote',
              p_product->>'accentColor', p_product->>'gradientBg', (p_product->>'piecesPerPack')::int)
      returning * into v_prod;
      if v_initial <> 0 then
        insert into pos.stock_movements(product_id, delta, reason, user_id)
        values (v_prod.id, v_initial, 'INICIAL', v_user.id);
      end if;
    else
      -- El stock NO se edita aquí: solo por reposición, ventas o regularización.
      update pos.products set
        barcode = trim(p_product->>'barcode'), name = trim(p_product->>'name'),
        category = p_product->>'category',
        base_unit_name = coalesce(nullif(trim(p_product->>'baseUnitName'), ''), base_unit_name),
        min_stock_alert = coalesce((p_product->>'minStockAlert')::int, min_stock_alert),
        expiration_date = nullif(p_product->>'expirationDate', '')::date,
        image_url = p_product->>'imageUrl',
        is_active = coalesce((p_product->>'isActive')::boolean, is_active),
        is_promo = coalesce((p_product->>'isPromo')::boolean, is_promo),
        promo_tag = p_product->>'promoTag', packaging_type = p_product->>'packagingType',
        flavor_note = p_product->>'flavorNote',
        accent_color = coalesce(p_product->>'accentColor', accent_color),
        gradient_bg = coalesce(p_product->>'gradientBg', gradient_bg),
        pieces_per_pack = coalesce((p_product->>'piecesPerPack')::int, pieces_per_pack),
        updated_at = now()
      where id = v_id returning * into v_prod;
    end if;

    delete from pos.product_presentations
     where product_id = v_prod.id
       and type not in (select jsonb_object_keys(p_product->'presentations'));
    for v_type, v_pres in select * from jsonb_each(p_product->'presentations') loop
      insert into pos.product_presentations(product_id, type, label, short_label, conversion_factor,
                                            price, cost, barcode, is_default)
      values (v_prod.id, v_type, coalesce(v_pres->>'label', v_type), coalesce(v_pres->>'shortLabel', upper(v_type)),
              case when v_type = 'unit' then 1 else (v_pres->>'conversionFactor')::int end,
              (v_pres->>'price')::numeric, nullif(v_pres->>'cost', '')::numeric,
              nullif(trim(v_pres->>'barcode'), ''), v_type = 'unit')
      on conflict (product_id, type) do update set
        label = excluded.label, short_label = excluded.short_label,
        conversion_factor = excluded.conversion_factor, price = excluded.price,
        cost = excluded.cost, barcode = excluded.barcode, is_default = excluded.is_default;
    end loop;
  exception
    when unique_violation then
      perform pos._err('DUPLICADO', 'Ya existe un producto con ese código de barras.');
    when check_violation or not_null_violation or invalid_text_representation then
      perform pos._err('DATOS_INVALIDOS', 'Datos del producto inválidos (revise nombre, categoría, precios y factores).');
  end;

  perform pos._audit(v_user.id, case when v_id is null then 'PRODUCTO_CREADO' else 'PRODUCTO_MODIFICADO' end,
                     'product', v_prod.id::text);
  return pos._product_json(v_prod);
end $$;

-- Elimina si nunca se vendió; si tiene ventas, solo lo desactiva (para no romper el historial).
create function public.pos_product_delete(p_token text, p_product_id uuid)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token, array['admin']);
  if exists (select 1 from pos.order_items where product_id = p_product_id) then
    update pos.products set is_active = false, updated_at = now() where id = p_product_id;
    perform pos._audit(v_user.id, 'PRODUCTO_DESACTIVADO', 'product', p_product_id::text);
    return jsonb_build_object('deleted', false, 'deactivated', true);
  end if;
  delete from pos.products where id = p_product_id;
  perform pos._audit(v_user.id, 'PRODUCTO_ELIMINADO', 'product', p_product_id::text);
  return jsonb_build_object('deleted', true, 'deactivated', false);
end $$;

create function public.pos_product_set_active(p_token text, p_product_id uuid, p_active boolean)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_prod pos.products;
begin
  v_user := pos._auth(p_token, array['admin']);
  update pos.products set is_active = p_active, updated_at = now() where id = p_product_id returning * into v_prod;
  if not found then perform pos._err('NO_ENCONTRADO', 'Producto no encontrado.'); end if;
  return pos._product_json(v_prod);
end $$;

create function public.pos_product_restock(
  p_token text, p_product_id uuid, p_presentation text, p_quantity integer,
  p_unit_cost numeric default null, p_expiration date default null, p_unit_price numeric default null)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user pos.users;
  v_factor integer;
  v_units integer;
  v_prod pos.products;
begin
  v_user := pos._auth(p_token, array['admin']);
  if p_quantity is null or p_quantity <= 0 then
    perform pos._err('DATOS_INVALIDOS', 'La cantidad a reponer debe ser mayor a 0.');
  end if;
  select conversion_factor into v_factor from pos.product_presentations
   where product_id = p_product_id and type = coalesce(p_presentation, 'unit');
  if not found then perform pos._err('NO_ENCONTRADO', 'Presentación no encontrada.'); end if;
  v_units := p_quantity * v_factor;

  update pos.products set stock_base_units = stock_base_units + v_units,
         expiration_date = coalesce(p_expiration, expiration_date), updated_at = now()
   where id = p_product_id returning * into v_prod;
  if p_unit_price is not null and p_unit_price >= 0 then
    update pos.product_presentations set price = p_unit_price where product_id = p_product_id and type = 'unit';
  end if;
  insert into pos.stock_movements(product_id, delta, reason, user_id, unit_cost)
  values (p_product_id, v_units, 'REPOSICION', v_user.id, p_unit_cost);
  return pos._product_json(v_prod);
end $$;

-- Regulariza stock negativo (se vendió sin stock y se compró afuera): lo deja en 0.
create function public.pos_stock_regularize(p_token text, p_product_id uuid, p_external_cost numeric)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_prod pos.products; v_missing integer;
begin
  v_user := pos._auth(p_token, array['admin']);
  select * into v_prod from pos.products where id = p_product_id for update;
  if not found then perform pos._err('NO_ENCONTRADO', 'Producto no encontrado.'); end if;
  if v_prod.stock_base_units >= 0 then
    perform pos._err('DATOS_INVALIDOS', 'El producto no tiene stock negativo.');
  end if;
  v_missing := -v_prod.stock_base_units;
  update pos.products set stock_base_units = 0, updated_at = now() where id = p_product_id returning * into v_prod;
  insert into pos.stock_movements(product_id, delta, reason, user_id, unit_cost, notes)
  values (p_product_id, v_missing, 'COMPRA_EXTERNA', v_user.id,
          case when coalesce(p_external_cost, 0) > 0 then round(p_external_cost / v_missing, 2) end,
          format('Compra externa total S/ %s', coalesce(p_external_cost, 0)));
  return pos._product_json(v_prod);
end $$;

create function public.pos_promo_save(p_token text, p_promo jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_id uuid := nullif(p_promo->>'id', '')::uuid; v_promo pos.promos;
begin
  v_user := pos._auth(p_token, array['admin']);
  insert into pos.promos(id, badge_text, tag, discount_badge, title, subtitle, original_price, offer_price,
                         saving_text, associated_barcodes, is_active)
  values (coalesce(v_id, gen_random_uuid()), coalesce(p_promo->>'badgeText', 'PROMOCIÓN'),
          coalesce(p_promo->>'tag', ''), coalesce(p_promo->>'discountBadge', ''), trim(p_promo->>'title'),
          coalesce(p_promo->>'subtitle', ''), coalesce((p_promo->>'originalPrice')::numeric, 0),
          coalesce((p_promo->>'offerPrice')::numeric, 0), coalesce(p_promo->>'savingText', ''),
          coalesce(array(select jsonb_array_elements_text(p_promo->'associatedBarcodes')), '{}'),
          coalesce((p_promo->>'isActive')::boolean, true))
  on conflict (id) do update set
    badge_text = excluded.badge_text, tag = excluded.tag, discount_badge = excluded.discount_badge,
    title = excluded.title, subtitle = excluded.subtitle, original_price = excluded.original_price,
    offer_price = excluded.offer_price, saving_text = excluded.saving_text,
    associated_barcodes = excluded.associated_barcodes, is_active = excluded.is_active, updated_at = now()
  returning * into v_promo;
  return pos._promo_json(v_promo);
end $$;

create function public.pos_promo_delete(p_token text, p_promo_id uuid)
returns void language plpgsql security definer set search_path = pos, pg_temp as $$
begin
  perform pos._auth(p_token, array['admin']);
  delete from pos.promos where id = p_promo_id;
end $$;

-- ---------------------------------------------------------------------
-- API · CLIENTES Y DEUDAS
-- ---------------------------------------------------------------------

-- Cualquier rol puede registrar un cliente nuevo; solo admin edita existentes o fija límite.
create function public.pos_customer_save(p_token text, p_customer jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user pos.users;
  v_id   uuid := nullif(p_customer->>'id', '')::uuid;
  v_c    pos.customers;
  v_doc_type text := coalesce(nullif(p_customer->>'docType', ''), 'NINGUNO');
  v_doc  text := nullif(trim(p_customer->>'docNumber'), '');
begin
  v_user := pos._auth(p_token);
  if v_doc_type = 'DNI' and (v_doc is null or v_doc !~ '^[0-9]{8}$') then
    perform pos._err('DATOS_INVALIDOS', 'El DNI debe tener 8 dígitos.');
  elsif v_doc_type = 'RUC' and (v_doc is null or v_doc !~ '^(10|15|17|20)[0-9]{9}$') then
    perform pos._err('DATOS_INVALIDOS', 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.');
  elsif v_doc_type = 'NINGUNO' then
    v_doc := null;
  end if;

  begin
    if v_id is not null and exists (select 1 from pos.customers where id = v_id) then
      if v_user.role <> 'admin' then
        perform pos._err('PERMISO_DENEGADO', 'Solo el administrador puede editar clientes.');
      end if;
      update pos.customers set
        name = trim(p_customer->>'name'), doc_type = v_doc_type, doc_number = v_doc,
        route = p_customer->>'route', phone = p_customer->>'phone', address = p_customer->>'address',
        credit_limit = nullif(p_customer->>'customCreditLimit', '')::numeric,
        is_active = coalesce((p_customer->>'isActive')::boolean, is_active), updated_at = now()
      where id = v_id returning * into v_c;
    else
      insert into pos.customers(id, name, doc_type, doc_number, route, phone, address, credit_limit, created_by)
      values (coalesce(v_id, gen_random_uuid()), trim(p_customer->>'name'), v_doc_type, v_doc,
              p_customer->>'route', p_customer->>'phone', p_customer->>'address',
              case when v_user.role = 'admin' then nullif(p_customer->>'customCreditLimit', '')::numeric end,
              v_user.id)
      returning * into v_c;
    end if;
  exception
    when unique_violation then perform pos._err('DUPLICADO', 'Ya existe un cliente con ese documento.');
    when check_violation or not_null_violation then perform pos._err('DATOS_INVALIDOS', 'Datos del cliente inválidos.');
  end;
  return pos._customer_json(v_c);
end $$;

-- Clientes con deuda pendiente (fiados con saldo).
create function public.pos_debts_list(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
begin
  perform pos._auth(p_token, array['admin', 'cajero']);
  return (
    select coalesce(jsonb_agg(x order by (x->>'debt')::numeric desc), '[]')
    from (
      select pos._customer_json(c) || jsonb_build_object(
               'fiadoDebt', sum(o.debt_amount),
               'openOrders', count(*),
               'oldestDebtAt', min(o.created_at)) as x
        from pos.customers c
        join pos.orders o on o.customer_id = c.id and o.status = 'FIADO' and o.debt_amount > 0
       group by c.id
    ) t);
end $$;

-- Estado de cuenta: boletas fiadas/pagadas a crédito + historial de abonos.
create function public.pos_customer_statement(p_token text, p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_c pos.customers;
begin
  perform pos._auth(p_token, array['admin', 'cajero']);
  select * into v_c from pos.customers where id = p_customer_id;
  if not found then perform pos._err('NO_ENCONTRADO', 'Cliente no encontrado.'); end if;
  return jsonb_build_object(
    'customer', pos._customer_json(v_c),
    'orders', (select coalesce(jsonb_agg(pos._order_json(o.id) order by o.created_at desc), '[]')
                 from (select id, created_at from pos.orders
                        where customer_id = p_customer_id and payment_term <> 'Contado' and status <> 'CANCELADO'
                        order by created_at desc limit 100) o),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'orderId', p.order_id, 'orderCode', o.code, 'kind', p.kind,
                    'method', p.method, 'amount', p.amount, 'groupId', p.group_id,
                    'receivedBy', u.full_name, 'notes', p.notes, 'createdAt', p.created_at)
                    order by p.created_at desc), '[]')
                   from pos.payments p join pos.orders o on o.id = p.order_id
                   join pos.users u on u.id = p.received_by
                  where p.customer_id = p_customer_id));
end $$;

-- Registra un abono. Sin p_order_id se reparte de la deuda más antigua a la más nueva.
create function public.pos_abono_register(
  p_token text, p_customer_id uuid, p_amount numeric, p_method text,
  p_order_id uuid default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user   pos.users;
  v_shift  uuid;
  v_left   numeric := round(coalesce(p_amount, 0), 2);
  v_total  numeric;
  v_apply  numeric;
  v_group  uuid := gen_random_uuid();
  r        pos.orders;
  v_applied jsonb := '[]';
begin
  v_user := pos._auth(p_token, array['admin', 'cajero']);
  v_shift := pos._open_shift_id(v_user.id);
  if v_user.role = 'cajero' and v_shift is null then
    perform pos._err('TURNO_CERRADO', 'Abra su turno de caja antes de recibir dinero.');
  end if;
  if v_left <= 0 then perform pos._err('DATOS_INVALIDOS', 'El monto del abono debe ser mayor a 0.'); end if;
  if p_method not in ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') then
    perform pos._err('DATOS_INVALIDOS', 'Método de pago inválido.');
  end if;

  select coalesce(sum(debt_amount), 0) into v_total from pos.orders
   where customer_id = p_customer_id and status = 'FIADO'
     and (p_order_id is null or id = p_order_id);
  if v_total = 0 then perform pos._err('SIN_DEUDA', 'El cliente no tiene deuda pendiente.'); end if;
  if v_left > v_total then
    perform pos._err('MONTO_EXCEDE_DEUDA', format('El abono (S/ %s) supera la deuda pendiente (S/ %s).',
      to_char(v_left, 'FM999999990.00'), to_char(v_total, 'FM999999990.00')));
  end if;

  for r in select * from pos.orders
            where customer_id = p_customer_id and status = 'FIADO' and debt_amount > 0
              and (p_order_id is null or id = p_order_id)
            order by created_at
            for update loop
    exit when v_left <= 0;
    v_apply := least(v_left, r.debt_amount);
    insert into pos.payments(order_id, customer_id, kind, method, amount, group_id, shift_id, received_by, notes)
    values (r.id, p_customer_id, 'ABONO', p_method, v_apply, v_group, v_shift, v_user.id, p_notes);
    update pos.orders set
      paid_amount = paid_amount + v_apply,
      debt_amount = debt_amount - v_apply,
      status      = case when debt_amount - v_apply = 0 then 'PAGADO' else 'FIADO' end,
      settled_at  = case when debt_amount - v_apply = 0 then now() else settled_at end
    where id = r.id;
    v_applied := v_applied || jsonb_build_object('orderId', r.id, 'orderCode', r.code, 'amount', v_apply,
                                                 'remaining', r.debt_amount - v_apply);
    v_left := v_left - v_apply;
  end loop;

  perform pos._audit(v_user.id, 'ABONO', 'customer', p_customer_id::text,
                     jsonb_build_object('amount', p_amount, 'method', p_method, 'groupId', v_group));
  return jsonb_build_object('groupId', v_group, 'applied', v_applied,
                            'remainingDebt', v_total - round(p_amount, 2));
end $$;

-- ---------------------------------------------------------------------
-- API · TURNOS DE CAJA
-- ---------------------------------------------------------------------


create function public.pos_shift_current(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_shift uuid;
begin
  v_user := pos._auth(p_token);
  v_shift := pos._open_shift_id(v_user.id);
  return case when v_shift is null then null else pos._shift_summary(v_shift) end;
end $$;

create function public.pos_shift_open(p_token text, p_opening_cash numeric default 0)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_shift uuid;
begin
  v_user := pos._auth(p_token);
  v_shift := pos._open_shift_id(v_user.id);
  if v_shift is null then
    if coalesce(p_opening_cash, 0) < 0 then perform pos._err('DATOS_INVALIDOS', 'El fondo de caja no puede ser negativo.'); end if;
    insert into pos.shifts(user_id, opening_cash) values (v_user.id, round(coalesce(p_opening_cash, 0), 2))
    returning id into v_shift;
  end if;
  return pos._shift_summary(v_shift);
end $$;

create function public.pos_shift_close(p_token text, p_counted_cash numeric, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_shift uuid; v_expected numeric;
begin
  v_user := pos._auth(p_token);
  v_shift := pos._open_shift_id(v_user.id);
  if v_shift is null then perform pos._err('TURNO_CERRADO', 'No tiene un turno abierto.'); end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    perform pos._err('DATOS_INVALIDOS', 'Ingrese el efectivo contado.');
  end if;
  v_expected := (pos._shift_summary(v_shift)->>'expectedCashNow')::numeric;
  update pos.shifts set closed_at = now(), expected_cash = v_expected, counted_cash = round(p_counted_cash, 2),
         difference = round(p_counted_cash, 2) - v_expected, notes = p_notes
   where id = v_shift;
  return pos._shift_summary(v_shift);
end $$;

-- ---------------------------------------------------------------------
-- API · PEDIDOS / BOLETAS
-- ---------------------------------------------------------------------

-- Crea un pedido. Idempotente por "id" (el celular puede reintentar sin duplicar).
-- Los precios se toman del servidor, no del celular.
-- p_order: {id, code, customerId?, paymentTerm, discountPercent, returnedContainers,
--           notes?, clientCreatedAt?, shiftId?, replacesOrderId?, items:[{productId, presentationType, quantity}]}
create function public.pos_order_create(p_token text, p_order jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user     pos.users;
  v_id       uuid := (p_order->>'id')::uuid;
  v_existing pos.orders;
  v_term     text := coalesce(p_order->>'paymentTerm', 'Contado');
  v_pct      numeric := coalesce((p_order->>'discountPercent')::numeric, 0);
  v_customer pos.customers;
  v_shift    uuid;
  v_replaces uuid := nullif(p_order->>'replacesOrderId', '')::uuid;
  v_gross    numeric := 0;
  v_units    integer := 0;
  v_disc     numeric;
  v_total    numeric;
  v_status   text;
  v_line     integer := 0;
  v_item     record;
  v_pres     record;
begin
  v_user := pos._auth(p_token, array['vendedor', 'admin']);
  if v_id is null then perform pos._err('DATOS_INVALIDOS', 'Falta el identificador del pedido.'); end if;

  select * into v_existing from pos.orders where id = v_id;
  if found then
    if v_existing.seller_id <> v_user.id then
      perform pos._err('PERMISO_DENEGADO', 'El pedido pertenece a otro vendedor.');
    end if;
    return pos._order_json(v_id);
  end if;

  if v_term not in ('Contado', 'Fiado (Libreta)', 'Crédito 7 días', 'Crédito 15 días') then
    perform pos._err('DATOS_INVALIDOS', 'Condición de pago inválida.');
  end if;
  if v_pct < 0 or v_pct > pos._setting_num('max_discount_percent', 10) then
    perform pos._err('DESCUENTO_INVALIDO', format('El descuento máximo permitido es %s%%.',
                     pos._setting_num('max_discount_percent', 10)));
  end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0 then
    perform pos._err('DATOS_INVALIDOS', 'El pedido no tiene productos.');
  end if;
  if jsonb_array_length(p_order->'items') > 300 then
    perform pos._err('DATOS_INVALIDOS', 'El pedido tiene demasiadas líneas.');
  end if;

  if nullif(p_order->>'customerId', '') is not null then
    select * into v_customer from pos.customers where id = (p_order->>'customerId')::uuid;
    if not found then perform pos._err('NO_ENCONTRADO', 'Cliente no encontrado.'); end if;
  elsif v_term <> 'Contado' then
    perform pos._err('CLIENTE_REQUERIDO', 'Para fiar o dar crédito debe seleccionar un cliente registrado.');
  end if;

  if v_replaces is not null and not exists (
      select 1 from pos.orders where id = v_replaces and status = 'CANCELADO'
         and (seller_id = v_user.id or v_user.role = 'admin')) then
    perform pos._err('DATOS_INVALIDOS', 'El ticket a reemplazar no existe o no fue anulado.');
  end if;

  v_shift := coalesce(
    (select id from pos.shifts where id = nullif(p_order->>'shiftId', '')::uuid and user_id = v_user.id),
    pos._open_shift_id(v_user.id));

  begin
    insert into pos.orders(id, code, seller_id, shift_id, customer_id, customer_name, customer_doc, payment_term,
                           status, discount_percent, returned_containers, notes, client_created_at, replaces_order_id)
    values (v_id, upper(trim(p_order->>'code')), v_user.id, v_shift, v_customer.id,
            coalesce(v_customer.name, nullif(trim(p_order->>'customerName'), '')), v_customer.doc_number,
            v_term, 'PENDIENTE_PAGO', v_pct, greatest(coalesce((p_order->>'returnedContainers')::int, 0), 0),
            p_order->>'notes', nullif(p_order->>'clientCreatedAt', '')::timestamptz, v_replaces);
  exception
    when unique_violation then
      perform pos._err('CODIGO_DUPLICADO', 'El código de ticket ya existe. Reintente.');
    when check_violation then
      perform pos._err('DATOS_INVALIDOS', 'Código de ticket inválido.');
  end;

  for v_item in select * from jsonb_to_recordset(p_order->'items')
                  as x("productId" uuid, "presentationType" text, quantity integer) loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 100000 then
      perform pos._err('DATOS_INVALIDOS', 'Cantidad inválida en el pedido.');
    end if;
    select p.name, pp.label, pp.conversion_factor, pp.price, pp.cost into v_pres
      from pos.products p join pos.product_presentations pp on pp.product_id = p.id
     where p.id = v_item."productId" and pp.type = v_item."presentationType";
    if not found then
      perform pos._err('PRODUCTO_INVALIDO', 'Un producto o presentación del pedido ya no existe en el catálogo.');
    end if;
    v_line := v_line + 1;
    insert into pos.order_items(order_id, line_no, product_id, product_name, presentation_type, presentation_label,
                                conversion_factor, quantity, unit_price, unit_cost, subtotal, base_units)
    values (v_id, v_line, v_item."productId", v_pres.name, v_item."presentationType", v_pres.label,
            v_pres.conversion_factor, v_item.quantity, v_pres.price, v_pres.cost,
            round(v_pres.price * v_item.quantity, 2), v_pres.conversion_factor * v_item.quantity);
    v_gross := v_gross + round(v_pres.price * v_item.quantity, 2);
    v_units := v_units + v_pres.conversion_factor * v_item.quantity;
  end loop;

  v_disc  := round(v_gross * v_pct / 100, 2);
  v_total := v_gross - v_disc;

  if v_term <> 'Contado' then
    perform pos._check_credit(v_customer.id, v_total, v_id);
  end if;

  v_status := case v_term when 'Contado' then 'PAGADO' when 'Fiado (Libreta)' then 'FIADO' else 'PENDIENTE_PAGO' end;

  update pos.orders set
    gross_amount = v_gross, discount_amount = v_disc, total_amount = v_total, total_base_units = v_units,
    status = v_status,
    paid_amount = case when v_status = 'PAGADO' then v_total else 0 end,
    debt_amount = case when v_status = 'FIADO' then v_total else 0 end,
    settled_at = case when v_status in ('PAGADO', 'FIADO') then now() end,
    settled_by = case when v_status in ('PAGADO', 'FIADO') then v_user.id end
  where id = v_id;

  -- Contado: el vendedor cobró en el acto. Fiado: se entrega la mercadería a cuenta.
  if v_status = 'PAGADO' and v_total > 0 then
    insert into pos.payments(order_id, customer_id, kind, method, amount, shift_id, received_by)
    values (v_id, v_customer.id, 'VENTA', 'Efectivo', v_total, v_shift, v_user.id);
  end if;
  if v_status in ('PAGADO', 'FIADO') then
    perform pos._apply_order_stock(v_id, -1, 'VENTA', v_user.id);
  end if;

  return pos._order_json(v_id);
end $$;

-- Buscar por código (QR) o id.
create function public.pos_order_get(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_id uuid;
begin
  v_user := pos._auth(p_token);
  select id into v_id from pos.orders
   where code = upper(trim(p_code)) or id::text = lower(trim(p_code));
  if v_id is null then perform pos._err('NO_ENCONTRADO', format('No existe el pedido %s.', p_code)); end if;
  if v_user.role = 'vendedor' and not exists (select 1 from pos.orders where id = v_id and seller_id = v_user.id) then
    perform pos._err('PERMISO_DENEGADO', 'El pedido pertenece a otro vendedor.');
  end if;
  return pos._order_json(v_id);
end $$;

-- Listado de pedidos. El vendedor solo ve los suyos.
create function public.pos_orders_list(
  p_token text, p_statuses text[] default null, p_since timestamptz default null, p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token);
  return (select coalesce(jsonb_agg(pos._order_json(o.id) order by o.created_at desc), '[]')
            from (select id, created_at from pos.orders
                   where (p_statuses is null or status = any(p_statuses))
                     and (p_since is null or created_at >= p_since)
                     and (v_user.role <> 'vendedor' or seller_id = v_user.id)
                   order by created_at desc
                   limit least(greatest(coalesce(p_limit, 200), 1), 1000)) o);
end $$;

-- Cobro en caja. p_payments: [{method, amount}] = dinero recibido (el vuelto se calcula).
-- Si no alcanza y p_as_fiado = true, el saldo queda como deuda del cliente.
create function public.pos_order_checkout(p_token text, p_order_id uuid, p_payments jsonb, p_as_fiado boolean default false)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user     pos.users;
  v_shift    uuid;
  v_order    pos.orders;
  v_received numeric := 0;
  v_cash     numeric := 0;
  v_change   numeric;
  v_applied  numeric;
  v_debt     numeric := 0;
  v_status   text;
  r          record;
begin
  v_user := pos._auth(p_token, array['cajero', 'admin']);
  v_shift := pos._open_shift_id(v_user.id);
  if v_user.role = 'cajero' and v_shift is null then
    perform pos._err('TURNO_CERRADO', 'Abra su turno de caja antes de cobrar.');
  end if;

  select * into v_order from pos.orders where id = p_order_id for update;
  if not found then perform pos._err('NO_ENCONTRADO', 'Pedido no encontrado.'); end if;
  if v_order.status <> 'PENDIENTE_PAGO' then
    perform pos._err('ESTADO_INVALIDO', case v_order.status
      when 'PAGADO' then 'Este pedido ya fue pagado.'
      when 'FIADO' then 'Este pedido ya está registrado como fiado. Use "Abonar deuda".'
      when 'CANCELADO' then 'Este pedido fue ANULADO y no se puede cobrar.'
      else 'El pedido no está pendiente de pago.' end);
  end if;

  for r in select * from jsonb_to_recordset(coalesce(p_payments, '[]')) as x(method text, amount numeric) loop
    if r.method not in ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') then
      perform pos._err('DATOS_INVALIDOS', 'Método de pago inválido.');
    end if;
    if r.amount is null or r.amount < 0 then perform pos._err('DATOS_INVALIDOS', 'Monto de pago inválido.'); end if;
    v_received := v_received + round(r.amount, 2);
    if r.method = 'Efectivo' then v_cash := v_cash + round(r.amount, 2); end if;
  end loop;

  v_change := greatest(v_received - v_order.total_amount, 0);
  if v_change > v_cash then
    perform pos._err('VUELTO_INVALIDO', 'Los pagos con Yape/Tarjeta no pueden superar el total: el vuelto solo se da en efectivo.');
  end if;
  v_applied := v_received - v_change;

  if v_applied < v_order.total_amount then
    if not p_as_fiado then
      perform pos._err('MONTO_INSUFICIENTE', 'El monto recibido es menor al total. Active "Fiar saldo" para dejar deuda.');
    end if;
    if v_order.customer_id is null then
      perform pos._err('CLIENTE_REQUERIDO', 'Para fiar, el pedido debe tener un cliente registrado.');
    end if;
    v_debt := v_order.total_amount - v_applied;
    perform pos._check_credit(v_order.customer_id, v_debt, v_order.id);
    v_status := 'FIADO';
  else
    v_status := 'PAGADO';
  end if;

  -- Registrar lo cobrado por método (el vuelto se descuenta del efectivo).
  for r in select method, sum(round(amount, 2)) as amount from jsonb_to_recordset(coalesce(p_payments, '[]'))
             as x(method text, amount numeric) group by method loop
    if r.method = 'Efectivo' then r.amount := r.amount - v_change; end if;
    if r.amount > 0 then
      insert into pos.payments(order_id, customer_id, kind, method, amount, shift_id, received_by)
      values (v_order.id, v_order.customer_id, 'VENTA', r.method, r.amount, v_shift, v_user.id);
    end if;
  end loop;

  update pos.orders set status = v_status, paid_amount = v_applied, debt_amount = v_debt,
         settled_at = now(), settled_by = v_user.id
   where id = v_order.id;
  perform pos._apply_order_stock(v_order.id, -1, 'VENTA', v_user.id);

  return pos._order_json(v_order.id) || jsonb_build_object('change', v_change);
end $$;

-- Anula un pedido: devuelve stock y registra devolución de dinero si ya se cobró.
-- Vendedor: solo sus pedidos de las últimas 24 h que no haya cobrado la caja.
-- Cajero: solo pedidos pendientes. Admin: cualquiera. Nunca si ya tiene abonos.
create function public.pos_order_cancel(p_token text, p_order_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user  pos.users;
  v_order pos.orders;
  v_shift uuid;
  r       record;
begin
  v_user := pos._auth(p_token);
  select * into v_order from pos.orders where id = p_order_id for update;
  if not found then perform pos._err('NO_ENCONTRADO', 'Pedido no encontrado.'); end if;
  if v_order.status = 'CANCELADO' then return pos._order_json(p_order_id); end if;

  if v_user.role = 'vendedor' and not (
       v_order.seller_id = v_user.id
       and v_order.created_at > now() - interval '24 hours'
       and (v_order.status = 'PENDIENTE_PAGO' or v_order.settled_by = v_user.id)) then
    perform pos._err('PERMISO_DENEGADO', 'Solo puede anular sus propios tickets de las últimas 24 horas que no hayan pasado por caja.');
  end if;
  if v_user.role = 'cajero' and v_order.status <> 'PENDIENTE_PAGO' then
    perform pos._err('PERMISO_DENEGADO', 'La caja solo puede anular pedidos pendientes. Consulte al administrador.');
  end if;
  if exists (select 1 from pos.payments where order_id = p_order_id and kind = 'ABONO') then
    perform pos._err('TIENE_ABONOS', 'El pedido tiene abonos registrados; no se puede anular.');
  end if;

  if v_order.status in ('PAGADO', 'FIADO') then
    perform pos._apply_order_stock(p_order_id, 1, 'ANULACION', v_user.id);
    v_shift := pos._open_shift_id(v_user.id);
    for r in select method, sum(amount) as amount from pos.payments
              where order_id = p_order_id and kind = 'VENTA' group by method having sum(amount) > 0 loop
      insert into pos.payments(order_id, customer_id, kind, method, amount, shift_id, received_by, notes)
      values (p_order_id, v_order.customer_id, 'DEVOLUCION', r.method, -r.amount, v_shift, v_user.id, p_reason);
    end loop;
  end if;

  update pos.orders set status = 'CANCELADO', debt_amount = 0, cancelled_at = now(),
         cancelled_by = v_user.id, cancel_reason = left(p_reason, 300)
   where id = p_order_id;
  perform pos._audit(v_user.id, 'PEDIDO_ANULADO', 'order', p_order_id::text,
                     jsonb_build_object('code', v_order.code, 'prevStatus', v_order.status, 'reason', p_reason));
  return pos._order_json(p_order_id);
end $$;

-- ---------------------------------------------------------------------
-- API · DASHBOARD Y CONFIGURACIÓN
-- ---------------------------------------------------------------------

create function public.pos_dashboard(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_today timestamptz;
  v_month timestamptz;
begin
  perform pos._auth(p_token, array['admin']);
  v_today := pos._today_start();
  v_month := (date_trunc('month', now() at time zone pos._setting_text('timezone', 'America/Lima')))
             at time zone pos._setting_text('timezone', 'America/Lima');
  return jsonb_build_object(
    'salesToday', (select coalesce(sum(total_amount), 0) from pos.orders
                    where status in ('PAGADO', 'FIADO') and created_at >= v_today),
    'ordersToday', (select count(*) from pos.orders where status in ('PAGADO', 'FIADO') and created_at >= v_today),
    'collectedToday', (select coalesce(sum(amount), 0) from pos.payments where created_at >= v_today),
    'salesYesterday', (select coalesce(sum(total_amount), 0) from pos.orders
                        where status in ('PAGADO', 'FIADO')
                          and created_at >= v_today - interval '1 day' and created_at < v_today),
    'salesMonth', (select coalesce(sum(total_amount), 0) from pos.orders
                    where status in ('PAGADO', 'FIADO') and created_at >= v_month),
    -- Ganancia estimada = venta neta (con descuento) - costo, solo de líneas con costo registrado.
    -- null si ningún producto vendido tiene costo cargado.
    'profitMonth', (select round(sum(i.subtotal * (1 - o.discount_percent / 100) - i.unit_cost * i.quantity), 2)
                      from pos.order_items i join pos.orders o on o.id = i.order_id
                     where o.status in ('PAGADO', 'FIADO') and o.created_at >= v_month and i.unit_cost is not null),
    'pendingOrders', (select count(*) from pos.orders where status = 'PENDIENTE_PAGO'),
    'totalDebt', (select coalesce(sum(debt_amount), 0) from pos.orders where status = 'FIADO'),
    'debtors', (select count(distinct customer_id) from pos.orders where status = 'FIADO' and debt_amount > 0),
    'openShifts', (select coalesce(jsonb_agg(pos._shift_summary(id)), '[]') from pos.shifts where closed_at is null));
end $$;

create function public.pos_settings_save(p_token text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_key text; v_val jsonb;
begin
  v_user := pos._auth(p_token, array['admin']);
  for v_key, v_val in select * from jsonb_each(p_settings) loop
    if v_key not in ('store_name', 'store_ruc', 'store_address', 'default_credit_limit',
                     'max_discount_percent', 'session_hours') then
      perform pos._err('DATOS_INVALIDOS', format('Configuración desconocida: %s', v_key));
    end if;
    insert into pos.settings(key, value, updated_at) values (v_key, v_val, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end loop;
  perform pos._audit(v_user.id, 'CONFIG_MODIFICADA', 'settings', null, p_settings);
  return (select jsonb_object_agg(key, value) from pos.settings);
end $$;

-- ---------------------------------------------------------------------
-- PERMISOS: la anon key solo puede ejecutar las funciones pos_*.
-- ---------------------------------------------------------------------
revoke all on all functions in schema pos from public;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'pos\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    end if;
  end loop;
end $$;
