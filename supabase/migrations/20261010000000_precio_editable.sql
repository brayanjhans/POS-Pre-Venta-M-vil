-- Precio de venta editable desde la venta.
-- El vendedor puede cobrar un precio distinto al de catálogo (ej. pack a S/ 31 en vez de S/ 30).
-- Cada ítem puede traer "unitPrice"; si no viene, se cobra el precio de catálogo como antes.
-- list_price guarda el precio de catálogo del momento para auditar los cambios:
--   select * from pos.order_items where unit_price <> list_price;
--
-- Ejecutar en Supabase → SQL Editor después de 20261009000000_init.sql.

alter table pos.order_items add column if not exists list_price numeric(12,2);

-- p_order: {id, code, customerId?, paymentTerm, discountPercent, returnedContainers,
--           notes?, clientCreatedAt?, shiftId?, replacesOrderId?,
--           items:[{productId, presentationType, quantity, unitPrice?}]}
create or replace function public.pos_order_create(p_token text, p_order jsonb)
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
  v_price    numeric;
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
                  as x("productId" uuid, "presentationType" text, quantity integer, "unitPrice" numeric) loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 100000 then
      perform pos._err('DATOS_INVALIDOS', 'Cantidad inválida en el pedido.');
    end if;
    select p.name, pp.label, pp.conversion_factor, pp.price, pp.cost into v_pres
      from pos.products p join pos.product_presentations pp on pp.product_id = p.id
     where p.id = v_item."productId" and pp.type = v_item."presentationType";
    if not found then
      perform pos._err('PRODUCTO_INVALIDO', 'Un producto o presentación del pedido ya no existe en el catálogo.');
    end if;
    -- Precio editado por el vendedor en la venta; si no viene, el de catálogo.
    v_price := coalesce(v_item."unitPrice", v_pres.price);
    if v_price <= 0 or v_price > 100000 or v_price <> round(v_price, 2) then
      perform pos._err('PRECIO_INVALIDO', 'Precio de venta inválido en el pedido.');
    end if;
    v_line := v_line + 1;
    insert into pos.order_items(order_id, line_no, product_id, product_name, presentation_type, presentation_label,
                                conversion_factor, quantity, unit_price, list_price, unit_cost, subtotal, base_units)
    values (v_id, v_line, v_item."productId", v_pres.name, v_item."presentationType", v_pres.label,
            v_pres.conversion_factor, v_item.quantity, v_price, v_pres.price, v_pres.cost,
            round(v_price * v_item.quantity, 2), v_pres.conversion_factor * v_item.quantity);
    v_gross := v_gross + round(v_price * v_item.quantity, 2);
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
