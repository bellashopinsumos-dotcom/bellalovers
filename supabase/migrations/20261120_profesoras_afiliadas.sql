-- BellaLovers: profesores solo afiliados por BellaShop.
-- Ejecutar después de 20261120_solicitudes_y_primera_compra.sql.
-- Ya aplicado en el proyecto xpnfdyfnaromfwkontid. No ejecutar en otros proyectos.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bl_affiliated_teachers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 3 AND 120),
 code text NOT NULL UNIQUE CHECK(code ~ '^BLP-[A-Z0-9]{8}$'),
 linked_profile_id uuid UNIQUE REFERENCES public.bl_profiles(id) ON DELETE SET NULL,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS bl_affiliated_teachers_active_idx ON public.bl_affiliated_teachers(active,display_name);
ALTER TABLE public.bl_affiliated_teachers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_affiliated_teachers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_affiliated_teachers TO authenticated;
CREATE POLICY bl_affiliated_teachers_admin_select ON public.bl_affiliated_teachers
 FOR SELECT TO authenticated USING ((SELECT bella_private.staff(true)));
ALTER TABLE public.bl_join_requests ADD COLUMN IF NOT EXISTS affiliate_teacher_id uuid
 REFERENCES public.bl_affiliated_teachers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bl_join_requests_affiliate_idx ON public.bl_join_requests(affiliate_teacher_id);
CREATE TABLE IF NOT EXISTS public.bl_affiliate_attributions(
 member_id uuid PRIMARY KEY REFERENCES public.bl_profiles(id) ON DELETE CASCADE,
 affiliate_id uuid NOT NULL REFERENCES public.bl_affiliated_teachers(id) ON DELETE RESTRICT,
 first_purchase_id uuid NOT NULL UNIQUE REFERENCES public.bl_purchases(id),
 awarded_points integer NOT NULL DEFAULT 0 CHECK(awarded_points>=0),
 awarded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bl_affiliate_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_affiliate_attributions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_affiliate_attributions TO authenticated;
CREATE POLICY bl_affiliate_attributions_read ON public.bl_affiliate_attributions
 FOR SELECT TO authenticated USING((SELECT bella_private.staff(true)));

CREATE OR REPLACE FUNCTION bella_private.approve_join_request(p_request uuid, p_user uuid, p_invoice text, p_amount integer, p_delivery integer, p_discount boolean, p_channel text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.bl_join_requests%rowtype;
DECLARE v_email text;
DECLARE v_purchase jsonb;
DECLARE t public.bl_affiliated_teachers%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración'; END IF;
 SELECT * INTO r FROM public.bl_join_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR r.status<>'pendiente' THEN RAISE EXCEPTION 'Solicitud inexistente o ya revisada'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Se requiere una compra real'; END IF;
 IF p_delivery IS NULL OR p_delivery<0 THEN RAISE EXCEPTION 'Transporte inválido'; END IF;
 IF char_length(trim(coalesce(p_invoice,''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Factura obligatoria'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_purchases WHERE invoice=trim(p_invoice)) THEN RAISE EXCEPTION 'Factura duplicada'; END IF;
 IF p_channel NOT IN ('tienda','whatsapp','web','domicilio','otro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
 IF r.category NOT IN ('estudiante','manicurista') THEN RAISE EXCEPTION 'Categoría pública inválida'; END IF;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_user;
 IF v_email IS DISTINCT FROM r.email THEN RAISE EXCEPTION 'Correo de la cuenta no coincide'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_profiles WHERE id=p_user OR phone=r.phone)
 THEN RAISE EXCEPTION 'Cuenta o celular ya registrados'; END IF;
 IF r.affiliate_teacher_id IS NOT NULL THEN
   SELECT * INTO t FROM public.bl_affiliated_teachers WHERE id=r.affiliate_teacher_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'La profesora afiliada ya no existe'; END IF;
 END IF;
 INSERT INTO public.bl_profiles(id,full_name,phone,category,marketing_optin,data_policy_accepted_at)
 VALUES(p_user,r.full_name,r.phone,r.category,r.marketing_optin,r.accepted_at);
 IF r.category='estudiante' AND r.affiliate_teacher_id IS NOT NULL
    AND t.linked_profile_id IS NOT NULL THEN
   INSERT INTO public.bl_referrals(student_id,teacher_id,code)
   VALUES(p_user,t.linked_profile_id,t.code);
 END IF;
 v_purchase:=bella_private.record_purchase_channel(
   p_user,trim(p_invoice),p_amount,coalesce(p_discount,false),p_delivery,p_notes,p_channel);
 IF r.affiliate_teacher_id IS NOT NULL THEN
   INSERT INTO public.bl_affiliate_attributions(member_id,affiliate_id,first_purchase_id,awarded_points,awarded_at)
   VALUES(p_user,r.affiliate_teacher_id,(v_purchase->>'purchase_id')::uuid,
      COALESCE((v_purchase->>'referral_points')::integer,0),
      CASE WHEN COALESCE((v_purchase->>'referral_points')::integer,0)>0 THEN now() END);
 END IF;
 UPDATE public.bl_join_requests SET status='aprobada',reviewed_at=now(),reviewed_by=auth.uid(),
 approved_user_id=p_user,first_purchase_id=(v_purchase->>'purchase_id')::uuid,
 review_reason='Primera compra confirmada en factura '||trim(p_invoice) WHERE id=p_request;
 PERFORM bella_private.log_change('aprobacion_por_compra','bl_join_requests',p_request::text,
 jsonb_build_object('factura',trim(p_invoice),'puntos',v_purchase->'points',
 'profesora_afiliada',r.affiliate_teacher_id));
 RETURN v_purchase;
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.list_affiliated_teachers()
 RETURNS TABLE(name text, code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT t.display_name,t.code FROM public.bl_affiliated_teachers t WHERE t.active ORDER BY t.display_name LIMIT 250;
$function$;

CREATE OR REPLACE FUNCTION bella_private.manage_affiliated_teacher(p_id uuid, p_name text, p_active boolean, p_linked_profile uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
DECLARE old_profile uuid;
DECLARE v_code text;
DECLARE r record;
DECLARE earned integer;
DECLARE minimum integer;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
   RAISE EXCEPTION 'Solo el administrador puede modificar las profesoras afiliadas'; END IF;
 IF char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 120 THEN
   RAISE EXCEPTION 'Escribe un nombre de profesora válido'; END IF;
 IF p_active IS NULL THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF p_linked_profile IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.bl_profiles p WHERE p.id=p_linked_profile
    AND p.category='profesora' AND NOT p.blocked AND p.archived_at IS NULL
 ) THEN RAISE EXCEPTION 'Solo puedes vincular una cuenta de profesora activa y aprobada'; END IF;
 IF p_id IS NULL THEN
   v_code:='BLP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
   INSERT INTO public.bl_affiliated_teachers(display_name,code,linked_profile_id,active,created_by)
   VALUES(btrim(p_name),v_code,p_linked_profile, p_active,auth.uid()) RETURNING id INTO v_id;
 ELSE
   SELECT id,code,linked_profile_id INTO v_id,v_code,old_profile
     FROM public.bl_affiliated_teachers WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Profesora no encontrada'; END IF;
   UPDATE public.bl_affiliated_teachers SET display_name=btrim(p_name),
     active=p_active,linked_profile_id=p_linked_profile,updated_at=now() WHERE id=v_id;
 END IF;
 -- Sync legacy referral code only when a member profile is affiliated.
 IF old_profile IS NOT NULL AND old_profile IS DISTINCT FROM p_linked_profile THEN
   DELETE FROM public.bl_teacher_codes WHERE teacher_id=old_profile;
   UPDATE public.bl_profiles SET teacher_verified=false WHERE id=old_profile;
 END IF;
 IF p_linked_profile IS NOT NULL THEN
   UPDATE public.bl_profiles SET teacher_verified=p_active WHERE id=p_linked_profile;
   INSERT INTO public.bl_teacher_codes(teacher_id,code,label,enabled)
   VALUES(p_linked_profile,v_code,btrim(p_name),p_active)
   ON CONFLICT(teacher_id) DO UPDATE SET code=excluded.code,label=excluded.label,enabled=excluded.enabled;
   -- Previously verified first purchases get their referral points once,
   -- even if the professor was linked after the purchase.
   IF p_active THEN
    SELECT min_purchase INTO minimum FROM public.bl_settings WHERE id=1;
    FOR r IN
      SELECT a.member_id,a.first_purchase_id,p.products_total,p.status,p.special_discount
      FROM public.bl_affiliate_attributions a
      JOIN public.bl_purchases p ON p.id=a.first_purchase_id
      JOIN public.bl_profiles member ON member.id=a.member_id
      WHERE a.affiliate_id=v_id AND a.awarded_at IS NULL
        AND member.category='estudiante' AND member.id<>p_linked_profile
      FOR UPDATE OF a
    LOOP
      IF r.status='confirmada' AND NOT r.special_discount AND r.products_total>=minimum THEN
        SELECT points INTO earned FROM public.bl_referral_tiers
         WHERE min_amount<=r.products_total ORDER BY min_amount DESC LIMIT 1;
        IF coalesce(earned,0)>0 THEN
          INSERT INTO public.bl_referrals(student_id,teacher_id,code,awarded_at,awarded_purchase)
          VALUES(r.member_id,p_linked_profile,v_code,now(),r.first_purchase_id)
          ON CONFLICT(student_id) DO NOTHING;
          IF FOUND THEN
            PERFORM bella_private.add_points(p_linked_profile,earned,'referido',r.first_purchase_id,
              'Primera compra referida por profesora afiliada');
            UPDATE public.bl_purchases SET referral_awarded=earned WHERE id=r.first_purchase_id;
            UPDATE public.bl_affiliate_attributions SET awarded_points=earned,awarded_at=now()
              WHERE member_id=r.member_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
   END IF;
 END IF;
 PERFORM bella_private.log_change('actualizar_afiliacion_profesora','bl_affiliated_teachers',v_id::text,
   jsonb_build_object('nombre',btrim(p_name),'activa',p_active,'perfil_vinculado',p_linked_profile));
 RETURN v_id;
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.submit_join_request(p_name text, p_phone text, p_email text, p_category text, p_teacher_code text, p_marketing boolean, p_accept boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text:=lower(trim(coalesce(p_email,'')));
DECLARE v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
DECLARE v_code text:=nullif(upper(trim(coalesce(p_teacher_code,''))),'');
DECLARE v_teacher uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bl_settings WHERE id=1 AND join_requests_open) THEN
  RAISE EXCEPTION 'BellaShop todavía no ha abierto las solicitudes'; END IF;
 IF NOT coalesce(p_accept,false) THEN RAISE EXCEPTION 'Debes aceptar el tratamiento de datos'; END IF;
 IF char_length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF v_phone ~ '^57[0-9]{10}$' THEN v_phone:=substring(v_phone from 3); END IF;
 IF v_phone !~ '^3[0-9]{9}$' THEN RAISE EXCEPTION 'Celular inválido'; END IF;
 v_phone:='+57'||v_phone;
 IF char_length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$'
 THEN RAISE EXCEPTION 'Escribe un correo válido para recibir el acceso'; END IF;
 IF p_category NOT IN ('estudiante','manicurista') THEN
   RAISE EXCEPTION 'Las profesoras afiliadas son autorizadas exclusivamente por BellaShop'; END IF;
 IF v_code IS NOT NULL THEN
   SELECT id INTO v_teacher FROM public.bl_affiliated_teachers WHERE code=v_code AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'La profesora seleccionada ya no está disponible'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.bl_join_requests WHERE
    (email=v_email OR phone=v_phone) AND created_at>now()-interval '24 hours')
  OR EXISTS(SELECT 1 FROM public.bl_profiles WHERE phone=v_phone)
  OR EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email) THEN RETURN true; END IF;
 INSERT INTO public.bl_join_requests(full_name,phone,email,category,teacher_code,
  affiliate_teacher_id,marketing_optin)
 VALUES(trim(p_name),v_phone,v_email,p_category,v_code,v_teacher,coalesce(p_marketing,false))
 ON CONFLICT DO NOTHING;
 RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_list_affiliated_teachers()
 RETURNS TABLE(name text, code text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT * FROM bella_private.list_affiliated_teachers();
$function$;

CREATE OR REPLACE FUNCTION public.bl_manage_affiliated_teacher(p_id uuid, p_name text, p_active boolean, p_linked_profile uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.manage_affiliated_teacher(p_id,p_name,p_active,p_linked_profile);
$function$;

GRANT USAGE ON SCHEMA bella_private TO anon,authenticated;
REVOKE ALL ON FUNCTION public.bl_list_affiliated_teachers(),
 public.bl_manage_affiliated_teacher(uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_list_affiliated_teachers(),
 bella_private.list_affiliated_teachers() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_manage_affiliated_teacher(uuid,text,boolean,uuid),
 bella_private.manage_affiliated_teacher(uuid,text,boolean,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bl_activate_teacher(uuid,text),
 bella_private.activate_teacher(uuid,text) FROM PUBLIC,anon,authenticated;
COMMIT;
