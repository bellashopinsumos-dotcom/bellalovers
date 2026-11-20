-- BellaLovers: ajustes auditables y compras simplificadas sin factura/canal obligatorios.
-- Ya aplicado al proyecto BellaLovers. No ejecutar en otro proyecto.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bl_adjustment_reversals(
 original_adjustment_id uuid PRIMARY KEY REFERENCES public.bl_points(id) ON DELETE RESTRICT,
 reversal_point_id uuid NOT NULL UNIQUE REFERENCES public.bl_points(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES auth.users(id),
 reason text NOT NULL CHECK(char_length(trim(reason)) BETWEEN 8 AND 500)
);
ALTER TABLE public.bl_adjustment_reversals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_adjustment_reversals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_adjustment_reversals TO authenticated;
DROP POLICY IF EXISTS bl_reversals_admin_select ON public.bl_adjustment_reversals;
CREATE POLICY bl_reversals_admin_select ON public.bl_adjustment_reversals FOR SELECT TO authenticated USING((SELECT bella_private.staff(true)));

CREATE OR REPLACE FUNCTION bella_private.record_purchase_simple(p_customer uuid, p_amount integer, p_invoice text DEFAULT NULL::text, p_channel text DEFAULT NULL::text, p_discount boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE final_invoice text; chosen_channel text; answer jsonb; auto_code boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff() THEN RAISE EXCEPTION 'Solo empleados autorizados'; END IF;
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
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.reverse_manual_adjustment(p_point uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE original public.bl_points%ROWTYPE; v_balance integer; reversed uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración autorizada'; END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Escribe un motivo de 8 a 500 caracteres'; END IF;
 SELECT * INTO original FROM public.bl_points WHERE id=p_point FOR UPDATE;
 IF NOT FOUND OR original.kind<>'ajuste' OR original.delta=0 THEN RAISE EXCEPTION 'Selecciona un ajuste manual válido'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_adjustment_reversals WHERE original_adjustment_id=p_point) THEN RAISE EXCEPTION 'Este ajuste ya fue revertido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bl_cycles WHERE id=original.cycle_id AND closed_at IS NULL AND now()<grace_until) THEN RAISE EXCEPTION 'Este ajuste pertenece a un ciclo cerrado; requiere revisión administrativa'; END IF;
 PERFORM 1 FROM public.bl_profiles WHERE id=original.customer_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta está archivada'; END IF;
 PERFORM bella_private.expire_one(original.customer_id);
 SELECT coalesce(sum(pt.delta),0)::integer INTO v_balance FROM public.bl_points pt
 JOIN public.bl_cycles cy ON cy.id=pt.cycle_id
 WHERE pt.customer_id=original.customer_id AND cy.closed_at IS NULL AND now()<cy.grace_until;
 IF v_balance-original.delta<0 THEN RAISE EXCEPTION 'Saldo insuficiente para revertir este ajuste completo; revisa los canjes realizados'; END IF;
 INSERT INTO public.bl_points(customer_id,cycle_id,delta,kind,detail,created_by)
 VALUES(original.customer_id,original.cycle_id,-original.delta,'ajuste',
   'Reversión del ajuste manual: '||trim(p_reason),auth.uid()) RETURNING id INTO reversed;
 INSERT INTO public.bl_adjustment_reversals(original_adjustment_id,reversal_point_id,created_by,reason)
 VALUES(p_point,reversed,auth.uid(),trim(p_reason));
 PERFORM bella_private.log_change('revertir_ajuste_manual','puntos',original.customer_id::text,
   jsonb_build_object('ajuste_original',p_point,'movimiento_reverso',reversed,'puntos',-original.delta,'motivo',trim(p_reason)));
 RETURN jsonb_build_object('reverted_points',-original.delta,'reversal_id',reversed);
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_purchase_simple(p_customer uuid, p_amount integer, p_invoice text DEFAULT NULL::text, p_channel text DEFAULT NULL::text, p_discount boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.record_purchase_simple(p_customer,p_amount,p_invoice,p_channel,p_discount,p_notes);
$function$;

CREATE OR REPLACE FUNCTION public.bl_reverse_manual_adjustment(p_point uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.reverse_manual_adjustment(p_point,p_reason);
$function$;

REVOKE ALL ON FUNCTION public.bl_reverse_manual_adjustment(uuid,text),bella_private.reverse_manual_adjustment(uuid,text),
public.bl_purchase_simple(uuid,integer,text,text,boolean,text),bella_private.record_purchase_simple(uuid,integer,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_reverse_manual_adjustment(uuid,text),bella_private.reverse_manual_adjustment(uuid,text),
public.bl_purchase_simple(uuid,integer,text,text,boolean,text),bella_private.record_purchase_simple(uuid,integer,text,text,boolean,text) TO authenticated;
COMMIT;