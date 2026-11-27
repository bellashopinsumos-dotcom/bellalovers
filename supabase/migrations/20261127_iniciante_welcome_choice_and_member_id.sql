ALTER TABLE public.bl_profiles DROP CONSTRAINT bl_profiles_category_check, ADD CONSTRAINT bl_profiles_category_check CHECK(category IN ('iniciante','estudiante','manicurista','profesora'));
ALTER TABLE public.bl_join_requests DROP CONSTRAINT bl_join_requests_category_check, ADD CONSTRAINT bl_join_requests_category_check CHECK(category IN ('iniciante','estudiante','manicurista','profesora'));
ALTER TABLE public.bl_rewards DROP CONSTRAINT bl_rewards_audience_check, ADD CONSTRAINT bl_rewards_audience_check CHECK(audience IN ('todas','iniciante','estudiante','manicurista','profesora'));
ALTER TABLE public.bl_profiles ADD COLUMN IF NOT EXISTS member_code text GENERATED ALWAYS AS ('BL-'||upper(substr(id::text,1,8))) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS bl_profiles_member_code_unique ON public.bl_profiles(member_code);
ALTER TABLE public.bl_purchases ADD COLUMN IF NOT EXISTS welcome_choice text CHECK(welcome_choice IN ('kit','descuento5'));
CREATE UNIQUE INDEX IF NOT EXISTS bl_iniciante_welcome_once ON public.bl_purchases(customer_id) WHERE welcome_choice IS NOT NULL AND status='confirmada';
UPDATE public.bl_settings SET student_gift_min=200000, student_first_no_points=false WHERE id=1;
CREATE OR REPLACE FUNCTION bella_private.record_purchase(p_customer uuid, p_invoice text, p_amount integer, p_discount boolean, p_delivery integer, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pr public.bl_profiles%rowtype; cfg public.bl_settings%rowtype; pu uuid; n integer; n_all integer; pts integer:=0; refpts integer:=0; fir boolean:=false; gift boolean:=false; rel record; threshold integer; choice text:=nullif(current_setting('bella.welcome_choice',true),'');
begin
  if NOT bella_private.staff(true) then raise exception 'Solo el administrador puede registrar compras'; end if;
  if p_amount is null or p_amount<0 or p_delivery is null or p_delivery<0 then raise exception 'Valor inválido'; end if;
  if length(trim(coalesce(p_invoice,'')))<2 then raise exception 'Factura obligatoria'; end if;
  select * into pr from public.bl_profiles where id=p_customer for update;
  if not found or pr.blocked or pr.archived_at is not null or pr.deleted_at is not null then raise exception 'Clienta inexistente o bloqueada'; end if;
  select * into cfg from public.bl_settings where id=1;
  select count(*) into n from public.bl_purchases where customer_id=p_customer and status='confirmada' and products_total>=cfg.min_purchase and (not cfg.exclude_discounts or not special_discount);
  fir:=n=0;
  -- El regalo aplica únicamente a la primera compra real, aunque haya compras previas que no sumaran puntos.
  select count(*) into n_all from public.bl_purchases where customer_id=p_customer and status='confirmada';
  gift:=false;
  IF choice IS NOT NULL THEN
   IF pr.category<>'iniciante' OR choice NOT IN ('kit','descuento5') THEN RAISE EXCEPTION 'Beneficio exclusivo de iniciantes'; END IF;
   IF EXISTS(SELECT 1 FROM public.bl_purchases WHERE customer_id=p_customer AND status='confirmada' AND welcome_choice IS NOT NULL) OR EXISTS(SELECT 1 FROM public.bl_gift_claims WHERE student_id=p_customer) THEN RAISE EXCEPTION 'Ya eligió su beneficio de bienvenida'; END IF;
   IF choice='kit' AND (p_amount<cfg.student_gift_min OR coalesce(p_discount,false)) THEN RAISE EXCEPTION 'El kit requiere mínimo $200.000 en productos y no acumula descuentos'; END IF;
   IF choice='descuento5' AND (p_amount<ceil(cfg.student_gift_min*0.95) OR NOT coalesce(p_discount,false)) THEN RAISE EXCEPTION 'Confirma descuento del 5%% sobre mínimo $200.000 antes del descuento'; END IF;
   gift:=choice='kit';
  END IF;
  if p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
    pts:=floor(p_amount::numeric/cfg.point_value)::integer;
    if choice is not null then pts:=0; end if;
  end if;
  insert into public.bl_purchases(invoice,customer_id,products_total,delivery_fee,special_discount,points_awarded,welcome_eligible,welcome_choice,reason,created_by)
  values(trim(p_invoice),p_customer,p_amount,p_delivery,coalesce(p_discount,false),pts,gift,choice,nullif(p_notes,''),auth.uid()) returning id into pu;
  if pts>0 then perform bella_private.add_points(p_customer,pts,'compra',pu,'Factura '||trim(p_invoice)); end if;
  if cfg.teacher_referral_points_enabled and pr.category='estudiante' and fir and p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
    select * into rel from public.bl_referrals where student_id=p_customer and awarded_purchase is null for update;
    if found then
      select coalesce((select points from public.bl_referral_tiers where min_amount<=p_amount order by min_amount desc limit 1),0) into refpts;
      if refpts>0 then
        perform bella_private.add_points(rel.teacher_id,refpts,'referido',pu,'Compra referida verificada');
        update public.bl_referrals set awarded_purchase=pu,awarded_at=now() where student_id=p_customer;
        update public.bl_purchases set referral_awarded=refpts where id=pu;
      end if;
    end if;
  end if;
  perform bella_private.log_change('confirmar','compra',pu::text,jsonb_build_object('invoice',p_invoice,'points',pts,'referral',refpts,'gift',gift));
  return jsonb_build_object('purchase_id',pu,'points',pts,'referral_points',refpts,'welcome_eligible',gift);
end;$function$
;
CREATE OR REPLACE FUNCTION bella_private.deliver_welcome(p_student uuid, p_gift uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pu uuid; gift_stock integer; gift_claim uuid;
begin
  if not bella_private.staff(true) then raise exception 'Solo empleados autorizados'; end if;
  perform 1 from public.bl_profiles where id=p_student and category='iniciante' for update;
  if not found then raise exception 'No es iniciante'; end if;
  if exists(select 1 from public.bl_gift_claims where student_id=p_student) then raise exception 'Ya recibió su regalo de bienvenida'; end if;
  select id into pu from public.bl_purchases where customer_id=p_student and status='confirmada' and welcome_eligible and welcome_choice='kit' order by created_at limit 1;
  if pu is null then raise exception 'No hay un kit de bienvenida seleccionado'; end if;
  select stock into gift_stock from public.bl_gift_options where id=p_gift and active for update;
  if gift_stock is null or gift_stock<1 then raise exception 'Regalo agotado o no disponible'; end if;
  update public.bl_gift_options set stock=stock-1 where id=p_gift;
  insert into public.bl_gift_claims(student_id,purchase_id,gift_id,delivered_by) values(p_student,pu,p_gift,auth.uid()) returning id into gift_claim;
  perform bella_private.log_change('entregar','regalo',gift_claim::text,jsonb_build_object('estudiante',p_student));
  return gift_claim;
end;$function$
;
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
    IF p_category NOT IN ('iniciante','estudiante','manicurista','profesora') THEN RAISE EXCEPTION 'Categoría inválida'; END IF;
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
$function$
;
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
 IF r.category NOT IN ('iniciante','estudiante','manicurista') THEN RAISE EXCEPTION 'Categoría pública inválida'; END IF;
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
 IF p_category NOT IN ('iniciante','estudiante','manicurista') THEN
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
CREATE OR REPLACE FUNCTION public.bl_purchase_with_welcome(p_customer uuid, p_amount integer, p_invoice text, p_channel text, p_discount boolean, p_notes text, p_affiliate uuid, p_welcome_choice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo el administrador puede registrar compras'; END IF;
 PERFORM set_config('bella.welcome_choice',coalesce(p_welcome_choice,''),true);
 result:=bella_private.record_purchase_with_affiliate(p_customer,p_amount,p_invoice,p_channel,p_discount,p_notes,p_affiliate);
 PERFORM set_config('bella.welcome_choice','',true);
 RETURN result;
END; $function$
;
CREATE OR REPLACE FUNCTION public.bl_approve_join_with_welcome(p_request uuid, p_user uuid, p_invoice text, p_amount integer, p_delivery integer, p_discount boolean, p_channel text, p_notes text, p_welcome_choice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración'; END IF;
 PERFORM set_config('bella.welcome_choice',coalesce(p_welcome_choice,''),true);
 result:=bella_private.approve_join_request(p_request,p_user,p_invoice,p_amount,p_delivery,p_discount,p_channel,p_notes);
 PERFORM set_config('bella.welcome_choice','',true);
 RETURN result;
END; $function$
;
REVOKE ALL ON FUNCTION public.bl_purchase_with_welcome(uuid,integer,text,text,boolean,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bl_purchase_with_welcome(uuid,integer,text,text,boolean,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.bl_approve_join_with_welcome(uuid,uuid,text,integer,integer,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bl_approve_join_with_welcome(uuid,uuid,text,integer,integer,boolean,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';