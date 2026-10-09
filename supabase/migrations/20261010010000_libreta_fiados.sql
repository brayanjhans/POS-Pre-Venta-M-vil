-- Libreta de fiados: celular del cliente, número de boleta en deudores e historial de fiados pagados.
-- Ejecutar en Supabase → SQL Editor después de 20261010000000_precio_editable.sql. No borra datos.

-- Cliente: valida y normaliza el celular (9 dígitos, empieza con 9).
create or replace function public.pos_customer_save(p_token text, p_customer jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_user pos.users;
  v_id   uuid := nullif(p_customer->>'id', '')::uuid;
  v_c    pos.customers;
  v_doc_type text := coalesce(nullif(p_customer->>'docType', ''), 'NINGUNO');
  v_doc  text := nullif(trim(p_customer->>'docNumber'), '');
  -- Celular: se guardan solo los dígitos (ej. "987 654 321" -> "987654321").
  v_phone text := nullif(regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g'), '');
begin
  v_user := pos._auth(p_token);
  if v_phone is not null and v_phone !~ '^9[0-9]{8}$' then
    perform pos._err('DATOS_INVALIDOS', 'El celular debe tener 9 dígitos y empezar con 9.');
  end if;
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
        route = p_customer->>'route', phone = v_phone, address = p_customer->>'address',
        credit_limit = nullif(p_customer->>'customCreditLimit', '')::numeric,
        is_active = coalesce((p_customer->>'isActive')::boolean, is_active), updated_at = now()
      where id = v_id returning * into v_c;
    else
      insert into pos.customers(id, name, doc_type, doc_number, route, phone, address, credit_limit, created_by)
      values (coalesce(v_id, gen_random_uuid()), trim(p_customer->>'name'), v_doc_type, v_doc,
              p_customer->>'route', v_phone, p_customer->>'address',
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

-- Deudores: ahora incluye los números de boleta pendientes ("orderCodes", de la más antigua a la más nueva).
create or replace function public.pos_debts_list(p_token text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
begin
  perform pos._auth(p_token, array['admin', 'cajero']);
  return (
    select coalesce(jsonb_agg(x order by (x->>'fiadoDebt')::numeric desc), '[]')
    from (
      select pos._customer_json(c) || jsonb_build_object(
               'fiadoDebt', sum(o.debt_amount),
               'openOrders', count(*),
               'oldestDebtAt', min(o.created_at),
               'orderCodes', jsonb_agg(o.code order by o.created_at)) as x
        from pos.customers c
        join pos.orders o on o.customer_id = c.id and o.status = 'FIADO' and o.debt_amount > 0
       group by c.id
    ) t);
end $$;

-- Historial: fiados que el cliente terminó de pagar con abonos (boleta ya PAGADA con al menos un ABONO).
-- Cada fila es el pedido completo + datos del cliente, cantidad de abonos y fecha del último.
create or replace function public.pos_fiados_paid_list(p_token text, p_search text default null, p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_q text := nullif(lower(trim(coalesce(p_search, ''))), '');
begin
  perform pos._auth(p_token, array['admin', 'cajero']);
  return (
    select coalesce(jsonb_agg(pos._order_json(t.id) || jsonb_build_object(
             'customerPhone', t.phone, 'customerDoc', t.doc_number,
             'abonosCount', t.abonos, 'lastAbonoAt', t.last_abono)
             order by t.last_abono desc), '[]')
    from (
      select o.id, c.phone, c.doc_number, count(p.id) as abonos, max(p.created_at) as last_abono
        from pos.orders o
        join pos.customers c on c.id = o.customer_id
        join pos.payments p on p.order_id = o.id and p.kind = 'ABONO'
       where o.status = 'PAGADO'
         and (v_q is null or lower(c.name) like '%' || v_q || '%' or c.doc_number like '%' || v_q || '%'
              or c.phone like '%' || v_q || '%' or lower(o.code) like '%' || v_q || '%')
       group by o.id, c.phone, c.doc_number
       order by max(p.created_at) desc
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) t);
end $$;

revoke all on function public.pos_fiados_paid_list(text, text, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.pos_fiados_paid_list(text, text, integer) to anon, authenticated;
  end if;
end $$;
