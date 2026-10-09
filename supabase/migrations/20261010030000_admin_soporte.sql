-- Cuenta de soporte técnico y restablecimiento de PIN por el administrador.
--
--   * pos.users.is_support: cuenta de soporte del desarrollador. No aparece en la pantalla
--     "¿Quién va a trabajar?" (se entra tocando 5 veces el logo) y los administradores del
--     cliente la ven en Usuarios como protegida: no pueden editarla, desactivarla ni cambiar su PIN.
--   * pos_user_reset_pin: el admin restablece el PIN de un usuario que lo olvidó (sin borrarlo).
--     Nadie puede restablecer su propio PIN; el de soporte solo lo cambia soporte.
--
-- Ejecutar en Supabase → SQL Editor después de 20261010020000_pin_inmutable.sql. No borra datos.
-- La cuenta de soporte se crea aparte, con un PIN que solo usted conozca (ver README).

alter table pos.users add column if not exists is_support boolean not null default false;

create or replace function pos._user_json(u pos.users) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', u.id, 'username', u.username, 'fullName', u.full_name, 'role', u.role,
    'sellerCode', u.seller_code, 'isActive', u.is_active, 'mustChangePin', u.must_change_pin,
    'lastLoginAt', u.last_login_at, 'createdAt', u.created_at, 'isSupport', u.is_support,
    'lockedUntil', case when u.locked_until > now() then u.locked_until end)
$$;

-- La cuenta de soporte no se lista en la pantalla de inicio.
create or replace function public.pos_login_users()
returns jsonb language sql stable security definer set search_path = pos, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('username', username, 'fullName', full_name, 'role', role)
                            order by case role when 'admin' then 0 when 'cajero' then 1 else 2 end, full_name), '[]')
    from pos.users where is_active and not is_support
$$;

create or replace function public.pos_user_update(p_token text, p_user_id uuid, p_patch jsonb)
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
  if v_user.is_support and not v_admin.is_support then
    perform pos._err('PERMISO_DENEGADO', 'La cuenta de soporte técnico está protegida.');
  end if;

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
    perform pos._err('PIN_INMUTABLE', 'El PIN se asigna al crear el usuario y no se puede cambiar.');
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

create or replace function public.pos_user_reset_pin(p_token text, p_user_id uuid, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare
  v_admin pos.users;
  v_user  pos.users;
begin
  v_admin := pos._auth(p_token, array['admin']);
  select * into v_user from pos.users where id = p_user_id for update;
  if not found then perform pos._err('NO_ENCONTRADO', 'Usuario no encontrado.'); end if;
  if v_user.id = v_admin.id then
    perform pos._err('PERMISO_DENEGADO', 'No puede restablecer su propio PIN. Pídaselo a otro administrador.');
  end if;
  if v_user.is_support and not v_admin.is_support then
    perform pos._err('PERMISO_DENEGADO', 'La cuenta de soporte técnico está protegida.');
  end if;
  perform pos._validate_pin(p_new_pin);

  update pos.users set
    pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 8)),
    must_change_pin = false, failed_attempts = 0, locked_until = null, updated_at = now()
  where id = p_user_id returning * into v_user;

  -- Sus sesiones abiertas se cierran: tendrá que entrar con el PIN nuevo.
  update pos.sessions set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  perform pos._audit(v_admin.id, 'PIN_RESTABLECIDO', 'user', p_user_id::text,
                     jsonb_build_object('username', v_user.username));
  return pos._user_json(v_user);
end $$;

revoke all on function public.pos_user_reset_pin(text, uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.pos_user_reset_pin(text, uuid, text) to anon, authenticated;
  end if;
end $$;
