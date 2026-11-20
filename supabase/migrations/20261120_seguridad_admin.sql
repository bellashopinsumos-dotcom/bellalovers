-- BellaLovers — refuerzo de seguridad del administrador.
-- Registro del primer administrador se realiza solo por una cuenta con permisos
-- sobre el proyecto Supabase. No se permite crear administradores desde la web.
DROP FUNCTION IF EXISTS public.bl_claim_first_admin();
DROP FUNCTION IF EXISTS bella_private.claim_first_admin();
REVOKE INSERT,UPDATE,DELETE ON public.bl_staff FROM PUBLIC,anon,authenticated;

-- Una vez creado Y confirmado el usuario desde Authentication > Users:
-- Ejecutar desde el SQL Editor del proyecto BellaLovers, previa aprobación.
-- insert into public.bl_staff(user_id,role,active)
-- select id,'admin',true from auth.users
-- where lower(email)='bellashopinsumos@gmail.com'
-- and email_confirmed_at is not null
-- on conflict (user_id) do update set role='admin',active=true;
