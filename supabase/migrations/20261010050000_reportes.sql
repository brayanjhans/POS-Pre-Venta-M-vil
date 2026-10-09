-- Reporte de ventas por período (día, semana, mes o rango) para el panel del administrador.
-- Venta = pedido PAGADO o FIADO (igual que pos_dashboard). Fechas en la zona horaria de la tienda.
-- Ejecutar en Supabase → SQL Editor. No borra datos.

create or replace function public.pos_sales_report(p_token text, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_tz    text := pos._setting_text('timezone', 'America/Lima');
  v_start timestamptz;
  v_end   timestamptz;
  v_days  integer;
  v_prev_start timestamptz;
  v_hourly boolean;
begin
  perform pos._auth(p_token, array['admin']);
  if p_from is null or p_to is null or p_to < p_from then
    perform pos._err('DATOS_INVALIDOS', 'Rango de fechas inválido.');
  end if;
  if p_to - p_from > 366 then
    perform pos._err('DATOS_INVALIDOS', 'El rango máximo es de un año.');
  end if;

  v_start := p_from::timestamp at time zone v_tz;
  v_end   := (p_to + 1)::timestamp at time zone v_tz;
  v_days  := p_to - p_from + 1;
  v_prev_start := v_start - make_interval(days => v_days);
  v_hourly := v_days = 1;

  return (
    with sales as (
      select o.* from pos.orders o
       where o.status in ('PAGADO', 'FIADO') and o.created_at >= v_start and o.created_at < v_end
    ),
    items as (
      select i.*, p.category, o.discount_percent
        from pos.order_items i
        join sales o on o.id = i.order_id
        left join pos.products p on p.id = i.product_id
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'granularity', case when v_hourly then 'hour' else 'day' end,
      'totals', jsonb_build_object(
        'sales', (select coalesce(sum(total_amount), 0) from sales),
        'orders', (select count(*) from sales),
        'avgTicket', (select coalesce(round(avg(total_amount), 2), 0) from sales),
        'units', (select coalesce(sum(base_units), 0) from items),
        'fiado', (select coalesce(sum(total_amount), 0) from sales where payment_term <> 'Contado'),
        'collected', (select coalesce(sum(amount), 0) from pos.payments where created_at >= v_start and created_at < v_end),
        'cancelled', (select count(*) from pos.orders where status = 'CANCELADO' and created_at >= v_start and created_at < v_end),
        'profit', (select round(sum(subtotal * (1 - discount_percent / 100) - unit_cost * quantity), 2)
                     from items where unit_cost is not null),
        'previousSales', (select coalesce(sum(total_amount), 0) from pos.orders
                           where status in ('PAGADO', 'FIADO') and created_at >= v_prev_start and created_at < v_start)
      ),
      -- Serie completa (incluye horas/días sin ventas en 0).
      'series', (
        select coalesce(jsonb_agg(jsonb_build_object('key', s.k, 'sales', coalesce(t.sales, 0), 'orders', coalesce(t.orders, 0)) order by s.k), '[]')
          from (
            select lpad(h::text, 2, '0') as k from generate_series(0, 23) h where v_hourly
            union all
            select to_char(d, 'YYYY-MM-DD') from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d where not v_hourly
          ) s
          left join (
            select case when v_hourly then to_char(created_at at time zone v_tz, 'HH24') else to_char(created_at at time zone v_tz, 'YYYY-MM-DD') end as k,
                   sum(total_amount) as sales, count(*) as orders
              from sales group by 1
          ) t on t.k = s.k
      ),
      'topProducts', (
        select coalesce(jsonb_agg(x order by (x->>'revenue')::numeric desc), '[]') from (
          select jsonb_build_object('name', product_name, 'units', sum(base_units), 'revenue', sum(subtotal)) as x
            from items group by product_id, product_name
            order by sum(subtotal) desc limit 10
        ) t
      ),
      'bySeller', (
        select coalesce(jsonb_agg(x order by (x->>'sales')::numeric desc), '[]') from (
          select jsonb_build_object('name', u.full_name, 'sales', sum(s.total_amount), 'orders', count(*)) as x
            from sales s join pos.users u on u.id = s.seller_id group by u.id, u.full_name
        ) t
      ),
      'byPayment', (
        select coalesce(jsonb_agg(x order by (x->>'amount')::numeric desc), '[]') from (
          select jsonb_build_object('method', method, 'amount', sum(amount)) as x
            from pos.payments where created_at >= v_start and created_at < v_end and kind <> 'DEVOLUCION'
           group by method
        ) t
      ),
      'byCategory', (
        select coalesce(jsonb_agg(x order by (x->>'revenue')::numeric desc), '[]') from (
          select jsonb_build_object('category', coalesce(category, 'Otros'), 'revenue', sum(subtotal)) as x
            from items group by coalesce(category, 'Otros')
        ) t
      )
    )
  );
end $$;

revoke all on function public.pos_sales_report(text, date, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.pos_sales_report(text, date, date) to anon, authenticated;
  end if;
end $$;
