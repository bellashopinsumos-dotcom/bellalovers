-- Resolución de correo exclusiva del servidor BellaLovers.
-- No expone datos del cliente al navegador ni habilita login por nombre + contacto sin verificar identidad.
CREATE OR REPLACE FUNCTION public.bl_resolve_member_email(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT p.id FROM public.bl_profiles p JOIN auth.users u ON u.id=p.id
 WHERE lower(u.email)=lower(trim(p_email)) AND p.deleted_at IS NULL
 AND p.archived_at IS NULL AND NOT p.blocked
 LIMIT 1;
$body$;
REVOKE ALL ON FUNCTION public.bl_resolve_member_email(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_resolve_member_email(text) TO service_role;
