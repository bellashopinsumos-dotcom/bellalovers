ALTER TABLE public.bl_settings ADD COLUMN IF NOT EXISTS teacher_referral_points_enabled boolean NOT NULL DEFAULT false;
UPDATE public.bl_settings SET teacher_referral_points_enabled=false WHERE id=1;
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
   IF p_active AND EXISTS (SELECT 1 FROM public.bl_settings WHERE id=1 AND teacher_referral_points_enabled) THEN
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
END;$function$
;
CREATE OR REPLACE FUNCTION bella_private.record_purchase(p_customer uuid, p_invoice text, p_amount integer, p_discount boolean, p_delivery integer, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pr public.bl_profiles%rowtype; cfg public.bl_settings%rowtype; pu uuid; n integer; n_all integer; pts integer:=0; refpts integer:=0; fir boolean:=false; gift boolean:=false; rel record; threshold integer;
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
  gift:=(pr.category='estudiante' and n_all=0 and p_amount>=cfg.student_gift_min);
  if p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
    pts:=floor(p_amount::numeric/cfg.point_value)::integer;
    if pr.category='estudiante' and cfg.student_first_no_points and fir then pts:=0; end if;
  end if;
  insert into public.bl_purchases(invoice,customer_id,products_total,delivery_fee,special_discount,points_awarded,welcome_eligible,reason,created_by)
  values(trim(p_invoice),p_customer,p_amount,p_delivery,coalesce(p_discount,false),pts,gift,nullif(p_notes,''),auth.uid()) returning id into pu;
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