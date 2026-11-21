-- BellaLovers: Canjes consultivos, pendientes de confirmación por WhatsApp.
-- Implementada en Supabase xpnfdyfnaromfwkontid; no ejecutarla repetidamente en proyectos distintos.
CREATE TABLE IF NOT EXISTS public.bl_guest_reward_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.bl_profiles(id) ON DELETE RESTRICT,
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
 total_points integer NOT NULL CHECK(total_points>0),
 status text NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada','rechazada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id),
 decision_reason text,
 redemption_id uuid UNIQUE REFERENCES public.bl_redemptions(id)
);
CREATE INDEX IF NOT EXISTS bl_guest_reward_requests_customer_idx
 ON public.bl_guest_reward_requests(customer_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bl_guest_reward_one_pending_per_customer
 ON public.bl_guest_reward_requests(customer_id) WHERE status='pendiente';
ALTER TABLE public.bl_guest_reward_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_guest_reward_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_guest_reward_requests TO authenticated;
DROP POLICY IF EXISTS bl_guest_reward_requests_staff ON public.bl_guest_reward_requests;
CREATE POLICY bl_guest_reward_requests_staff ON public.bl_guest_reward_requests
 FOR SELECT TO authenticated USING((SELECT bella_private.staff(true)));

CREATE OR REPLACE FUNCTION bella_private.decide_guest_reward(p_request uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ticket public.bl_guest_reward_requests%ROWTYPE;
 person public.bl_profiles%ROWTYPE;
 item record; r public.bl_rewards%ROWTYPE; cycle_item record;
 needed integer:=0; available integer:=0; unlock integer;
 remaining integer; spend integer; redemption uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
  RAISE EXCEPTION 'Solo administrador autorizado'; END IF;
 SELECT * INTO ticket FROM public.bl_guest_reward_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR ticket.status<>'pendiente' THEN
  RAISE EXCEPTION 'Solicitud inexistente o ya revisada'; END IF;
 IF NOT p_approve THEN
  IF length(trim(coalesce(p_reason,'')))<5 THEN
   RAISE EXCEPTION 'Escribe el motivo del rechazo'; END IF;
  UPDATE public.bl_guest_reward_requests SET status='rechazada',
   reviewed_at=now(),reviewed_by=auth.uid(),
   decision_reason=trim(p_reason) WHERE id=p_request;
  PERFORM bella_private.log_change('rechazar_solicitud_externa','premio',p_request::text,
   jsonb_build_object('customer_id',ticket.customer_id,'reason',p_reason));
  RETURN NULL;
 END IF;
 SELECT * INTO person FROM public.bl_profiles WHERE id=ticket.customer_id FOR UPDATE;
 IF NOT FOUND OR person.blocked OR person.archived_at IS NOT NULL OR person.deleted_at IS NOT NULL THEN
  RAISE EXCEPTION 'La clienta ya no está activa'; END IF;
 IF jsonb_typeof(ticket.items)<>'array' OR jsonb_array_length(ticket.items)=0 OR jsonb_array_length(ticket.items)>10 THEN
  RAISE EXCEPTION 'Lista de premios inválida'; END IF;
 PERFORM bella_private.expire_one(person.id);
 FOR item IN
  SELECT (value->>'reward_id')::uuid AS reward_id,
  sum((value->>'qty')::integer)::integer AS qty
  FROM jsonb_array_elements(ticket.items)
  GROUP BY 1 ORDER BY 1
 LOOP
  IF item.qty<1 OR item.qty>5 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  SELECT * INTO r FROM public.bl_rewards WHERE id=item.reward_id FOR UPDATE;
  IF NOT FOUND OR NOT r.active OR r.audience NOT IN ('todas',person.category)
    OR r.stock-r.reserved<item.qty THEN RAISE EXCEPTION 'Premio sin existencias o no disponible'; END IF;
  needed:=needed+r.points_cost*item.qty;
 END LOOP;
 SELECT unlock_points INTO unlock FROM public.bl_settings WHERE id=1;
 SELECT coalesce(sum(v.balance),0)::integer INTO available FROM (
  SELECT cy.id,coalesce(sum(pt.delta),0)::integer balance
  FROM public.bl_cycles cy LEFT JOIN public.bl_points pt ON pt.cycle_id=cy.id
  WHERE cy.customer_id=person.id AND cy.closed_at IS NULL AND now()<cy.grace_until
  GROUP BY cy.id
 ) v;
 IF available<unlock OR needed>available THEN RAISE EXCEPTION 'La clienta no tiene puntos suficientes'; END IF;
 INSERT INTO public.bl_redemptions(customer_id,total_points,status,processed_at,processed_by,reason)
 VALUES(person.id,needed,'aprobada',now(),auth.uid(),'Confirmado por BellaShop tras validar la titularidad')
 RETURNING id INTO redemption;
 FOR item IN
  SELECT (value->>'reward_id')::uuid AS reward_id,
  sum((value->>'qty')::integer)::integer AS qty
  FROM jsonb_array_elements(ticket.items)
  GROUP BY 1 ORDER BY 1
 LOOP
  SELECT * INTO r FROM public.bl_rewards WHERE id=item.reward_id FOR UPDATE;
  INSERT INTO public.bl_redemption_items(redemption_id,reward_id,qty,points_each)
  VALUES(redemption,r.id,item.qty,r.points_cost);
  UPDATE public.bl_rewards SET stock=stock-item.qty
   WHERE id=r.id AND stock-reserved>=item.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay stock suficiente'; END IF;
 END LOOP;
 remaining:=needed;
 FOR cycle_item IN
  SELECT c.id,coalesce(sum(pt.delta),0)::integer balance
  FROM public.bl_cycles c LEFT JOIN public.bl_points pt ON pt.cycle_id=c.id
  WHERE c.customer_id=person.id AND c.closed_at IS NULL AND now()<c.grace_until
  GROUP BY c.id HAVING coalesce(sum(pt.delta),0)>0 ORDER BY min(c.expires_at)
 LOOP
  EXIT WHEN remaining<=0;
  spend:=least(cycle_item.balance,remaining);
  INSERT INTO public.bl_points(customer_id,cycle_id,delta,kind,redemption_id,detail,created_by)
  VALUES(person.id,cycle_item.id,-spend,'redencion',redemption,
   'Premio confirmado por BellaShop tras verificar la clienta',auth.uid());
  remaining:=remaining-spend;
 END LOOP;
 IF remaining<>0 THEN RAISE EXCEPTION 'No se pudo descontar el saldo correctamente'; END IF;
 UPDATE public.bl_guest_reward_requests
 SET status='aprobada',reviewed_at=now(),reviewed_by=auth.uid(),
  decision_reason='Titularidad y premio confirmados por BellaShop',redemption_id=redemption
 WHERE id=p_request;
 PERFORM bella_private.log_change('aprobar_solicitud_externa','premio',p_request::text,
  jsonb_build_object('customer_id',person.id,'points',needed,'redemption',redemption));
 RETURN redemption;
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_decide_guest_reward(p_request uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.decide_guest_reward(p_request,p_approve,p_reason);
$function$;

REVOKE ALL ON FUNCTION public.bl_decide_guest_reward(uuid,boolean,text),
 bella_private.decide_guest_reward(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_decide_guest_reward(uuid,boolean,text),
 bella_private.decide_guest_reward(uuid,boolean,text) TO authenticated;

-- Retira el flujo de aprobación de inicios de sesión.
REVOKE EXECUTE ON FUNCTION public.bl_review_login_request(uuid,boolean) FROM authenticated;
