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
 IF p_amount IS NULL OR p_amount<50000 THEN RAISE EXCEPTION 'Para ingresar a BellaLovers se requiere una compra de productos de mínimo $50.000'; END IF;
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
END;$function$
;
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
 IF v_email='' THEN
  -- Correo técnico interno, nunca se envía nada a esta dirección reservada.
  v_email:='bl-'||replace(gen_random_uuid()::text,'-','')||'@example.com';
 ELSIF char_length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$' THEN
  RAISE EXCEPTION 'Correo opcional inválido';
 END IF;
 IF p_category NOT IN ('estudiante','manicurista') THEN
   RAISE EXCEPTION 'Las profesoras afiliadas son autorizadas exclusivamente por BellaShop'; END IF;
 IF v_code IS NOT NULL THEN
   SELECT id INTO v_teacher FROM public.bl_affiliated_teachers WHERE code=v_code AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'La profesora seleccionada ya no está disponible'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.bl_join_requests WHERE
    (email=v_email OR phone=v_phone) AND (status='pendiente' OR created_at>now()-interval '24 hours'))
  OR EXISTS(SELECT 1 FROM public.bl_profiles WHERE phone=v_phone)
  OR EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email) THEN RETURN true; END IF;
 INSERT INTO public.bl_join_requests(full_name,phone,email,category,teacher_code,
  affiliate_teacher_id,marketing_optin)
 VALUES(trim(p_name),v_phone,v_email,p_category,v_code,v_teacher,coalesce(p_marketing,false))
 ON CONFLICT DO NOTHING;
 RETURN true;
END;$function$
;