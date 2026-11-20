-- BellaLovers - instalación incremental tras supabase/schema.sql
-- Contiene las funciones de recuperación de cuentas y administración de empleados.
-- SOLO PARA BELLALOVERS, no para RutaYa, Master Viviana u otros proyectos.
BEGIN;
ALTER TABLE public.bl_profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.bl_profiles ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);
DROP POLICY IF EXISTS bl_profiles_staff_update ON public.bl_profiles;
REVOKE UPDATE ON public.bl_profiles FROM authenticated;
GRANT USAGE ON SCHEMA bella_private TO authenticated;

CREATE OR REPLACE FUNCTION bella_private.audit_catalog_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  change_id text;
BEGIN
  change_id := COALESCE(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id',
                   to_jsonb(NEW)->>'min_amount',to_jsonb(OLD)->>'min_amount','1');
  PERFORM bella_private.log_change('config_'||lower(TG_OP),TG_TABLE_NAME,change_id,
    jsonb_build_object('before',to_jsonb(OLD),'after',to_jsonb(NEW)));
  RETURN COALESCE(NEW,OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION bella_private.bl_list_staff()
 RETURNS TABLE(user_id uuid, email text, role text, active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
    RAISE EXCEPTION 'Solo administradores autorizados';
  END IF;
  RETURN QUERY
    SELECT s.user_id,u.email::text,s.role,s.active,s.created_at
    FROM public.bl_staff s JOIN auth.users u ON u.id=s.user_id
    ORDER BY s.created_at;
END;
$function$;

CREATE OR REPLACE FUNCTION bella_private.bl_manage_customer(p_customer uuid, p_action text, p_reason text, p_category text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  c public.bl_profiles%rowtype;
  old_state jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
    RAISE EXCEPTION 'Solo un administrador autorizado puede gestionar cuentas';
  END IF;
  IF p_customer IS NULL OR p_action NOT IN ('block','unblock','archive','restore','category') THEN
    RAISE EXCEPTION 'Operación inválida';
  END IF;
  IF length(trim(coalesce(p_reason,''))) < 8 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Explica el motivo con al menos 8 caracteres';
  END IF;
  SELECT * INTO c FROM public.bl_profiles WHERE id=p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe esa clienta'; END IF;
  old_state := jsonb_build_object('category',c.category,'blocked',c.blocked,'archived',c.archived_at IS NOT NULL);

  CASE p_action
  WHEN 'block' THEN
    IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'La cuenta está archivada'; END IF;
    IF c.blocked THEN RAISE EXCEPTION 'La cuenta ya está bloqueada'; END IF;
    UPDATE public.bl_profiles SET blocked=true,updated_at=now() WHERE id=p_customer;
  WHEN 'unblock' THEN
    IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Primero restaura la cuenta archivada'; END IF;
    IF NOT c.blocked THEN RAISE EXCEPTION 'La cuenta ya está activa'; END IF;
    UPDATE public.bl_profiles SET blocked=false,updated_at=now() WHERE id=p_customer;
  WHEN 'archive' THEN
    IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'La cuenta ya está archivada'; END IF;
    UPDATE public.bl_profiles SET blocked=true,archived_at=now(),archived_by=auth.uid(),updated_at=now()
    WHERE id=p_customer;
  WHEN 'restore' THEN
    IF c.archived_at IS NULL THEN RAISE EXCEPTION 'La cuenta no está archivada'; END IF;
    -- Restauración sin borrar historial de compras ni movimientos de puntos.
    UPDATE public.bl_profiles SET blocked=false,archived_at=NULL,archived_by=NULL,updated_at=now()
    WHERE id=p_customer;
  WHEN 'category' THEN
    IF c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restaura la cuenta antes de cambiar su categoría'; END IF;
    IF p_category NOT IN ('estudiante','manicurista','profesora') THEN RAISE EXCEPTION 'Categoría inválida'; END IF;
    IF c.category=p_category THEN RAISE EXCEPTION 'No hay cambios en la categoría'; END IF;
    UPDATE public.bl_profiles
       SET category=p_category,
           teacher_verified=CASE WHEN p_category='profesora' THEN teacher_verified AND c.category='profesora' ELSE false END,
           updated_at=now()
     WHERE id=p_customer;
    IF c.category='profesora' AND p_category<>'profesora' THEN
      UPDATE public.bl_teacher_codes SET enabled=false WHERE teacher_id=p_customer;
    END IF;
  END CASE;
  PERFORM bella_private.log_change('cuenta_'||p_action,'bl_profiles',p_customer::text,
    jsonb_build_object('before',old_state,'reason',trim(p_reason),'new_category',p_category));
  RETURN jsonb_build_object('success',true,'action',p_action,'customer_id',p_customer);
END;
$function$;

CREATE OR REPLACE FUNCTION bella_private.bl_manage_staff(p_email text, p_role text, p_active boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid;
  existing public.bl_staff%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
    RAISE EXCEPTION 'Solo administradores autorizados';
  END IF;
  IF length(trim(coalesce(p_reason,''))) < 8 OR length(p_reason)>500 THEN
    RAISE EXCEPTION 'Explica el motivo con al menos 8 caracteres';
  END IF;
  IF p_role NOT IN ('admin','operador') OR p_active IS NULL THEN
    RAISE EXCEPTION 'Rol o estado inválido';
  END IF;
  IF p_email IS NULL OR length(trim(p_email))>320 THEN RAISE EXCEPTION 'Correo inválido'; END IF;
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email)=lower(trim(p_email)) AND u.email_confirmed_at IS NOT NULL;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Primero crea y confirma el correo en Authentication → Users de Supabase';
  END IF;
  SELECT * INTO existing FROM public.bl_staff WHERE public.bl_staff.user_id=uid FOR UPDATE;
  IF uid=auth.uid() AND (NOT p_active OR p_role<>'admin') THEN
    RAISE EXCEPTION 'No puedes retirarte tus propios permisos de administrador';
  END IF;
  IF existing.role='admin' AND existing.active AND (NOT p_active OR p_role<>'admin') AND
     (SELECT count(*) FROM public.bl_staff WHERE role='admin' AND active) <= 1 THEN
    RAISE EXCEPTION 'Debe existir al menos un administrador activo';
  END IF;
  INSERT INTO public.bl_staff(user_id,role,active)
  VALUES(uid,p_role,p_active)
  ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,active=excluded.active;
  PERFORM bella_private.log_change('empleado_actualizado','bl_staff',uid::text,
    jsonb_build_object('old_role',existing.role,'old_active',existing.active,'new_role',p_role,
      'new_active',p_active,'reason',trim(p_reason)));
  RETURN jsonb_build_object('success',true,'user_id',uid,'email',lower(trim(p_email)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.bl_list_staff()
 RETURNS TABLE(user_id uuid, email text, role text, active boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT * FROM bella_private.bl_list_staff();
$function$;

CREATE OR REPLACE FUNCTION public.bl_manage_customer(p_customer uuid, p_action text, p_reason text, p_category text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT bella_private.bl_manage_customer(p_customer,p_action,p_reason,p_category);
$function$;

CREATE OR REPLACE FUNCTION public.bl_manage_staff(p_email text, p_role text, p_active boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT bella_private.bl_manage_staff(p_email,p_role,p_active,p_reason);
$function$;

REVOKE ALL ON FUNCTION bella_private.bl_manage_customer(uuid,text,text,text),
  bella_private.bl_list_staff(),bella_private.bl_manage_staff(text,text,boolean,text),
  public.bl_manage_customer(uuid,text,text,text),public.bl_list_staff(),
  public.bl_manage_staff(text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION bella_private.bl_manage_customer(uuid,text,text,text),
  bella_private.bl_list_staff(),bella_private.bl_manage_staff(text,text,boolean,text),
  public.bl_manage_customer(uuid,text,text,text),public.bl_list_staff(),
  public.bl_manage_staff(text,text,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION bella_private.audit_catalog_changes() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS bl_rewards_audit ON public.bl_rewards;
CREATE TRIGGER bl_rewards_audit AFTER INSERT OR UPDATE OR DELETE ON public.bl_rewards
FOR EACH ROW EXECUTE FUNCTION bella_private.audit_catalog_changes();
DROP TRIGGER IF EXISTS bl_gift_options_audit ON public.bl_gift_options;
CREATE TRIGGER bl_gift_options_audit AFTER INSERT OR UPDATE OR DELETE ON public.bl_gift_options
FOR EACH ROW EXECUTE FUNCTION bella_private.audit_catalog_changes();
DROP TRIGGER IF EXISTS bl_settings_audit ON public.bl_settings;
CREATE TRIGGER bl_settings_audit AFTER UPDATE ON public.bl_settings
FOR EACH ROW EXECUTE FUNCTION bella_private.audit_catalog_changes();
DROP TRIGGER IF EXISTS bl_referral_tiers_audit ON public.bl_referral_tiers;
CREATE TRIGGER bl_referral_tiers_audit AFTER INSERT OR UPDATE OR DELETE ON public.bl_referral_tiers
FOR EACH ROW EXECUTE FUNCTION bella_private.audit_catalog_changes();
COMMIT;
