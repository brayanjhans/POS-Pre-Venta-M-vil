-- Fotos de productos, guardadas en la base de datos pero livianas.
--
-- La app reduce la foto antes de subirla (cuadrada, ~256 px, WebP, unos 8-15 KB).
-- Cada foto vive en pos.product_images con su propio id y nunca cambia: el producto
-- solo guarda la referencia "img:<id>" en image_url. Así pos_catalog sigue siendo liviano
-- y el celular descarga cada foto una sola vez y la guarda en su memoria.
--
-- Límite por foto: 60 000 caracteres en base64 (~44 KB). 300 productos ≈ 3-5 MB en total.

create table if not exists pos.product_images (
  id          uuid primary key default gen_random_uuid(),
  data        text not null check (
                data ~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$'
                and char_length(data) <= 60000),
  bytes       integer not null,
  created_by  uuid references pos.users(id),
  created_at  timestamptz not null default now()
);
alter table pos.product_images enable row level security;

-- Borra la foto vieja cuando el producto cambia de foto o se elimina (si nadie más la usa).
create or replace function pos._product_image_cleanup() returns trigger
language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_old text := old.image_url;
begin
  if v_old like 'img:%' and (tg_op = 'DELETE' or new.image_url is distinct from v_old)
     and not exists (select 1 from pos.products where image_url = v_old and id <> old.id) then
    delete from pos.product_images where id = nullif(substr(v_old, 5), '')::uuid;
  end if;
  return null;
exception when invalid_text_representation then
  return null;
end $$;

drop trigger if exists products_image_cleanup on pos.products;
create trigger products_image_cleanup
  after update of image_url or delete on pos.products
  for each row execute function pos._product_image_cleanup();

-- Sube una foto (solo admin). Devuelve la referencia "img:<id>" para guardarla en el producto.
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

  -- Fotos subidas pero nunca usadas (se canceló el formulario) se limpian al día siguiente.
  delete from pos.product_images i
   where i.created_at < now() - interval '1 day'
     and not exists (select 1 from pos.products p where p.image_url = 'img:' || i.id);

  insert into pos.product_images(data, bytes, created_by)
  values (p_data, (char_length(p_data) - position(',' in p_data)) * 3 / 4, v_user.id)
  returning id into v_id;
  return 'img:' || v_id;
end $$;

-- Devuelve las fotos pedidas como {id: dataUrl}. Lo usan todos los roles.
create or replace function public.pos_product_images(p_token text, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
begin
  perform pos._auth(p_token);
  return coalesce((
    select jsonb_object_agg(i.id, i.data)
      from pos.product_images i
     where i.id = any(p_ids[1:60])
  ), '{}'::jsonb);
end $$;

revoke all on function public.pos_product_image_upload(text, text) from public;
revoke all on function public.pos_product_images(text, uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.pos_product_image_upload(text, text) to anon, authenticated;
    grant execute on function public.pos_product_images(text, uuid[]) to anon, authenticated;
  end if;
end $$;
