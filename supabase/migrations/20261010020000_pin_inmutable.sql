-- PIN inmutable: el PIN que el administrador asigna al crear un usuario es definitivo.
--   * pos_user_create: los usuarios nuevos ya no tienen que cambiar el PIN en su primer ingreso.
--   * pos_user_update: rechaza cualquier intento de cambiar el PIN (PIN_INMUTABLE).
--   * pos_change_pin: solo sirve para reemplazar un PIN temporal (el admin inicial del seed).
-- Usuarios existentes con PIN temporal pendiente se pasan a PIN definitivo, salvo el admin del seed.
-- Si alguien olvida su PIN: desactivar ese usuario y crear uno nuevo.
-- Ejecutar en Supabase → SQL Editor después de 20261010010000_libreta_fiados.sql. No borra datos.

create or replace function public.pos_user_create(p_token text, p_user jsonb)
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
            false, v_admin.id)
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

create or replace function public.pos_change_pin(p_token text, p_current_pin text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = pos, pg_temp as $$
declare v_user pos.users;
begin
  v_user := pos._auth(p_token, null, true);
  -- Solo se permite reemplazar un PIN temporal (ej. el 2580 del admin inicial del seed).
  if not v_user.must_change_pin then
    perform pos._err('PIN_INMUTABLE', 'El PIN no se puede cambiar.');
  end if;
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

update pos.users set must_change_pin = false, updated_at = now()
 where must_change_pin and username <> 'admin';
