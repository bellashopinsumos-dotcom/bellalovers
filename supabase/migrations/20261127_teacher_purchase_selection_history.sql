ALTER TABLE public.bl_purchases ADD COLUMN IF NOT EXISTS selected_affiliate_id uuid REFERENCES public.bl_affiliated_teachers(id);
CREATE INDEX IF NOT EXISTS bl_purchases_selected_affiliate_idx ON public.bl_purchases(selected_affiliate_id) WHERE selected_affiliate_id IS NOT NULL;
CREATE OR REPLACE FUNCTION bella_private.record_purchase_with_affiliate(p_customer uuid, p_amount integer, p_invoice text, p_channel text, p_discount boolean, p_notes text, p_affiliate uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo el administrador puede registrar compras'; END IF;
 IF p_affiliate IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bl_affiliated_teachers t WHERE t.id=p_affiliate AND t.active AND t.linked_profile_id IS DISTINCT FROM p_customer) THEN RAISE EXCEPTION 'Selecciona una profesora afiliada activa distinta de la clienta'; END IF;
 result:=bella_private.record_purchase_simple(p_customer,p_amount,p_invoice,p_channel,p_discount,p_notes);
 IF p_affiliate IS NOT NULL THEN
 UPDATE public.bl_purchases SET selected_affiliate_id=p_affiliate WHERE id=(result->>'purchase_id')::uuid;
 END IF;
 RETURN result;
END; $function$
;
CREATE OR REPLACE FUNCTION public.bl_purchase_with_affiliate(p_customer uuid, p_amount integer, p_invoice text, p_channel text, p_discount boolean, p_notes text, p_affiliate uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT bella_private.record_purchase_with_affiliate(p_customer,p_amount,p_invoice,p_channel,p_discount,p_notes,p_affiliate); $function$
;
REVOKE ALL ON FUNCTION bella_private.record_purchase_with_affiliate(uuid,integer,text,text,boolean,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION bella_private.record_purchase_with_affiliate(uuid,integer,text,text,boolean,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.bl_purchase_with_affiliate(uuid,integer,text,text,boolean,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bl_purchase_with_affiliate(uuid,integer,text,text,boolean,text,uuid) TO authenticated;