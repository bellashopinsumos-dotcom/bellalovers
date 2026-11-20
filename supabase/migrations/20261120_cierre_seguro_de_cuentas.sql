-- BellaLovers: cierre irreversible de acceso y minimización de datos personales sin destruir facturas/auditoría.
-- Ya aplicado al proyecto BellaLovers, no usar en otros proyectos.
BEGIN;
ALTER TABLE public.bl_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bl_profiles ALTER COLUMN phone DROP NOT NULL;
CREATE OR REPLACE FUNCTION bella_private.adjust_points(p_customer uuid, p_delta integer, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid; available integer;
begin
  if not bella_private.staff(true) then raise exception 'Solo administración'; end if;
  if exists(select 1 from public.bl_profiles where id=p_customer and (deleted_at is not null or archived_at is not null)) then raise exception 'No se pueden modificar puntos de cuentas eliminadas o archivadas'; end if;
  if p_delta=0 or p_delta is null or abs(p_delta)>10000 then raise exception 'Ajuste fuera de rango'; end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Motivo obligatorio de al menos 8 caracteres'; end if;
  if p_delta>0 then
    c:=bella_private.add_points(p_customer,p_delta,'ajuste',null,p_reason);
  else
    perform 1 from public.bl_profiles where id=p_customer for update;
    perform bella_private.expire_one(p_customer);
    select cy.id,coalesce(sum(pt.delta),0)::integer into c,available from public.bl_cycles cy
       left join public.bl_points pt on pt.cycle_id=cy.id
       where cy.customer_id=p_customer and cy.closed_at is null and now()<cy.grace_until
       group by cy.id order by min(cy.expires_at) limit 1;
    if c is null or available < -p_delta then raise exception 'Saldo insuficiente para ajuste'; end if;
    insert into public.bl_points(customer_id,cycle_id,delta,kind,detail,created_by)
    values(p_customer,c,p_delta,'ajuste',p_reason,auth.uid());
  end if;
  perform bella_private.log_change('ajuste','puntos',p_customer::text,jsonb_build_object('delta',p_delta,'motivo',p_reason));
end;$function$;

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
  IF c.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'La cuenta fue eliminada y ya no puede restaurarse ni modificarse'; END IF;
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

CREATE OR REPLACE FUNCTION bella_private.delete_member_account(p_customer uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE pr public.bl_profiles%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración de BellaShop'; END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Explica el motivo con mínimo 8 caracteres'; END IF;
 IF p_customer=auth.uid() THEN RAISE EXCEPTION 'No puedes eliminar tu propio acceso administrativo'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_staff WHERE user_id=p_customer) THEN RAISE EXCEPTION 'Las cuentas del equipo se gestionan por Equipo y accesos'; END IF;
 SELECT * INTO pr FROM public.bl_profiles WHERE id=p_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta inexistente'; END IF;
 IF pr.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('deleted',true,'already_deleted',true); END IF;
 IF EXISTS(SELECT 1 FROM public.bl_redemptions WHERE customer_id=p_customer AND status='solicitada') THEN
  RAISE EXCEPTION 'Procesa las solicitudes de premios pendientes antes de eliminar la cuenta';
 END IF;
 -- Keep financial/audit history, detach affiliation and erase the identifying fields.
 UPDATE public.bl_affiliated_teachers SET active=false,linked_profile_id=NULL,updated_at=now()
   WHERE linked_profile_id=p_customer;
 DELETE FROM public.bl_join_requests WHERE approved_user_id=p_customer;
 DELETE FROM public.bl_teacher_codes WHERE teacher_id=p_customer;
 UPDATE public.bl_profiles SET
   blocked=true,archived_at=coalesce(archived_at,now()),archived_by=auth.uid(),
   deleted_at=now(),full_name='Cuenta eliminada',phone=NULL,marketing_optin=false,
   updated_at=now()
 WHERE id=p_customer;
 PERFORM bella_private.log_change('eliminar_cuenta_y_datos_contacto','bl_profiles',p_customer::text,
   jsonb_build_object('reason',trim(p_reason),'conserva_facturas_y_movimientos',true));
 RETURN jsonb_build_object('deleted',true,'customer_id',p_customer);
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_delete_member_account(p_customer uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.delete_member_account(p_customer,p_reason);
$function$;
REVOKE ALL ON FUNCTION public.bl_delete_member_account(uuid,text),bella_private.delete_member_account(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_delete_member_account(uuid,text),bella_private.delete_member_account(uuid,text) TO authenticated;
DROP POLICY IF EXISTS bl_profiles_read ON public.bl_profiles;
CREATE POLICY bl_profiles_read ON public.bl_profiles FOR SELECT TO authenticated USING((id=(SELECT auth.uid()) AND NOT blocked AND archived_at IS NULL AND deleted_at IS NULL) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_points_read ON public.bl_points;
CREATE POLICY bl_points_read ON public.bl_points FOR SELECT TO authenticated USING((customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=customer_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_cycles_read ON public.bl_cycles;
CREATE POLICY bl_cycles_read ON public.bl_cycles FOR SELECT TO authenticated USING((customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=customer_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_purchases_read ON public.bl_purchases;
CREATE POLICY bl_purchases_read ON public.bl_purchases FOR SELECT TO authenticated USING((customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=customer_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_redemptions_read ON public.bl_redemptions;
CREATE POLICY bl_redemptions_read ON public.bl_redemptions FOR SELECT TO authenticated USING((customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=customer_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_claims_read ON public.bl_gift_claims;
CREATE POLICY bl_claims_read ON public.bl_gift_claims FOR SELECT TO authenticated USING((student_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=student_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_referrals_read ON public.bl_referrals;
CREATE POLICY bl_referrals_read ON public.bl_referrals FOR SELECT TO authenticated USING((student_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.bl_profiles p WHERE p.id=student_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL)) OR (SELECT bella_private.staff()));
DROP POLICY IF EXISTS bl_redemption_items_read ON public.bl_redemption_items;
CREATE POLICY bl_redemption_items_read ON public.bl_redemption_items FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.bl_redemptions r WHERE r.id=redemption_id AND (
    (r.customer_id=(SELECT auth.uid()) AND EXISTS(
      SELECT 1 FROM public.bl_profiles p WHERE p.id=r.customer_id AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL
    )) OR (SELECT bella_private.staff())
 ))
);
COMMIT;