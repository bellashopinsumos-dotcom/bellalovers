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
  if pr.category='estudiante' and fir and p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
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
CREATE OR REPLACE FUNCTION bella_private.record_purchase_channel(p_customer uuid, p_invoice text, p_amount integer, p_discount boolean, p_delivery integer, p_notes text, p_channel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE res jsonb; rid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo el administrador puede registrar compras'; END IF;
  IF p_channel NOT IN ('tienda','whatsapp','web','domicilio','otro') OR p_channel IS NULL
    THEN RAISE EXCEPTION 'Canal de compra inválido'; END IF;
  res:=bella_private.record_purchase(p_customer,p_invoice,p_amount,p_discount,p_delivery,p_notes);
  rid:=(res->>'purchase_id')::uuid;
  UPDATE public.bl_purchases SET channel=p_channel WHERE id=rid;
  PERFORM bella_private.log_change('canal_venta','compra',rid::text,jsonb_build_object('canal',p_channel));
  RETURN res;
END;$function$
;
CREATE OR REPLACE FUNCTION bella_private.record_purchase_simple(p_customer uuid, p_amount integer, p_invoice text DEFAULT NULL::text, p_channel text DEFAULT NULL::text, p_discount boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE final_invoice text; chosen_channel text; answer jsonb; auto_code boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo el administrador puede registrar compras'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>500000000 THEN RAISE EXCEPTION 'Escribe un valor de productos válido'; END IF;
 IF p_customer IS NULL THEN RAISE EXCEPTION 'Primero busca a la clienta por celular'; END IF;
 final_invoice:=nullif(trim(coalesce(p_invoice,'')),'');
 auto_code:=final_invoice IS NULL;
 IF final_invoice IS NOT NULL AND length(final_invoice)>80 THEN RAISE EXCEPTION 'El número de factura es demasiado largo'; END IF;
 IF auto_code THEN
   -- REG- is an internal tracking code, never a tax invoice.
   final_invoice:='REG-'||upper(replace(gen_random_uuid()::text,'-',''));
 END IF;
 chosen_channel:=coalesce(nullif(trim(coalesce(p_channel,'')),''),'otro');
 IF chosen_channel NOT IN ('tienda','whatsapp','web','domicilio','otro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
 IF length(coalesce(p_notes,''))>500 THEN RAISE EXCEPTION 'Observación muy larga'; END IF;
 answer:=bella_private.record_purchase_channel(p_customer,final_invoice,p_amount,
     coalesce(p_discount,false),0,p_notes,chosen_channel);
 IF auto_code THEN
  UPDATE public.bl_purchases SET reason=concat_ws(' · ',nullif(p_notes,''),'Registro interno sin número de factura')
    WHERE id=(answer->>'purchase_id')::uuid;
 END IF;
 RETURN answer||jsonb_build_object('reference',final_invoice,'internal_reference',auto_code);
END;$function$
;