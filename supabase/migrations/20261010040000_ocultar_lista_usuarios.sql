-- El login ya no muestra la lista de usuarios: cada persona escribe su usuario y su PIN.
-- Esta función devolvía los nombres de todos los usuarios activos a cualquiera con la clave pública;
-- se elimina para que no se puedan consultar desde fuera de la app.
--
-- Ejecutar en Supabase → SQL Editor SOLO DESPUÉS de instalar el APK nuevo en todos los celulares
-- (los APK anteriores todavía la usan para mostrar los perfiles en el login).

drop function if exists public.pos_login_users();
