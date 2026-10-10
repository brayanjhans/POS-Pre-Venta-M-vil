-- Foto para los combos y promociones (requiere 20261010070000_fotos_productos.sql).
--
-- Usa la misma tabla pos.product_images: la app reduce la foto a ~480x300 px en WebP
-- (unos 15-25 KB) y el combo guarda solo la referencia "img:<id>" en image_url.

alter table pos.promos add column if not exists image_url text;

-- Una foto está en uso si la tiene algún producto o algún combo.
create or replace function pos._image_in_use(p_ref text) returns boolean
language sql stable as $$
  select exists (select 1 from pos.products where image_url = p_ref)
      or exists (select 1 from pos.promos where image_url = p_ref)
$$;

create or replace function pos._image_cleanup() returns trigger
language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_old text := old.image_url;
begin
  if v_old like 'img:%' and (tg_op = 'DELETE' or new.image_url is distinct from v_old)
     and not pos._image_in_use(v_old) then
    delete from pos.product_images where id = nullif(substr(v_old, 5), '')::uuid;
  end if;
  return null;
exception when invalid_text_representation then
  return null;
end $$;

-- Productos: ahora también revisa si un combo usa la misma foto.
drop trigger if exists products_image_cleanup on pos.products;
create trigger products_image_cleanup
  after update of image_url or delete on pos.products
  for each row execute function pos._image_cleanup();
drop function if exists pos._product_image_cleanup();

drop trigger if exists promos_image_cleanup on pos.promos;
create trigger promos_image_cleanup
  after update of image_url or delete on pos.promos
  for each row execute function pos._image_cleanup();

-- La limpieza de fotos nunca usadas también respeta las de los combos.
create or replace function public.pos_product_image_upload(p_token text, p_data text)
returns text language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_id uuid;
begin
  v_user := pos._auth(p_token, array['admin']);
  if p_data is null or p_data !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$' then
    perform pos._err('IMAGEN_INVALIDA', 'La foto debe estar en formato WebP o JPEG.');
  end if;
  if char_length(p_data) > 60000 then
    perform pos._err('IMAGEN_GRANDE', 'La foto es muy pesada. Vuelva a tomarla.');
  end if;

  delete from pos.product_images i
   where i.created_at < now() - interval '1 day'
     and not pos._image_in_use('img:' || i.id);

  insert into pos.product_images(data, bytes, created_by)
  values (p_data, (char_length(p_data) - position(',' in p_data)) * 3 / 4, v_user.id)
  returning id into v_id;
  return 'img:' || v_id;
end $$;

create or replace function pos._promo_json(p pos.promos) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'badgeText', p.badge_text, 'tag', p.tag, 'discountBadge', p.discount_badge,
    'title', p.title, 'subtitle', p.subtitle, 'originalPrice', p.original_price,
    'offerPrice', p.offer_price, 'savingText', p.saving_text,
    'associatedBarcodes', to_jsonb(p.associated_barcodes), 'isActive', p.is_active,
    'imageUrl', p.image_url)
$$;

create or replace function public.pos_promo_save(p_token text, p_promo jsonb)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users; v_id uuid := nullif(p_promo->>'id', '')::uuid; v_promo pos.promos;
        v_image text := nullif(p_promo->>'imageUrl', '');
begin
  v_user := pos._auth(p_token, array['admin']);
  if v_image is not null and v_image !~ '^img:[0-9a-f-]{36}$' then
    perform pos._err('IMAGEN_INVALIDA', 'La foto del combo no es válida.');
  end if;
  insert into pos.promos(id, badge_text, tag, discount_badge, title, subtitle, original_price, offer_price,
                         saving_text, associated_barcodes, is_active, image_url)
  values (coalesce(v_id, gen_random_uuid()), coalesce(p_promo->>'badgeText', 'PROMOCIÓN'),
          coalesce(p_promo->>'tag', ''), coalesce(p_promo->>'discountBadge', ''), trim(p_promo->>'title'),
          coalesce(p_promo->>'subtitle', ''), coalesce((p_promo->>'originalPrice')::numeric, 0),
          coalesce((p_promo->>'offerPrice')::numeric, 0), coalesce(p_promo->>'savingText', ''),
          coalesce(array(select jsonb_array_elements_text(p_promo->'associatedBarcodes')), '{}'),
          coalesce((p_promo->>'isActive')::boolean, true), v_image)
  on conflict (id) do update set
    badge_text = excluded.badge_text, tag = excluded.tag, discount_badge = excluded.discount_badge,
    title = excluded.title, subtitle = excluded.subtitle, original_price = excluded.original_price,
    offer_price = excluded.offer_price, saving_text = excluded.saving_text,
    associated_barcodes = excluded.associated_barcodes, is_active = excluded.is_active,
    image_url = excluded.image_url, updated_at = now()
  returning * into v_promo;
  return pos._promo_json(v_promo);
end $$;
