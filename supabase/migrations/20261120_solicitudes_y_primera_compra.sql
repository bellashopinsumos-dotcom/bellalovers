-- BellaLovers: solicitudes SIN SMS, aprobaciones humanas con primera compra facturada.
-- Aplicar tras las migraciones 20261120_restauracion_y_equipo.sql y 20261120_premios_canales_registro.sql.
-- YA aplicada al proyecto xpnfdyfnaromfwkontid. No ejecutar sobre otros proyectos.
BEGIN;
ALTER TABLE public.bl_settings ADD COLUMN IF NOT EXISTS join_requests_open boolean NOT NULL DEFAULT false;
UPDATE public.bl_settings SET signup_open=false WHERE id=1;
CREATE TABLE IF NOT EXISTS public.bl_join_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 3 AND 120),
 phone text NOT NULL CHECK (phone ~ '^[+]573[0-9]{9}$'),
 email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
 category text NOT NULL CHECK (category IN ('estudiante','manicurista','profesora')),
 teacher_code text,
 marketing_optin boolean NOT NULL DEFAULT false,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','rechazada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id),
 review_reason text,
 approved_user_id uuid REFERENCES auth.users(id),
 first_purchase_id uuid REFERENCES public.bl_purchases(id),
 CONSTRAINT bl_join_approval_check CHECK(
 (status='aprobada' AND approved_user_id IS NOT NULL AND first_purchase_id IS NOT NULL) OR
 (status<>'aprobada' AND approved_user_id IS NULL AND first_purchase_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bl_join_pending_email ON public.bl_join_requests(lower(email)) WHERE status='pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS bl_join_pending_phone ON public.bl_join_requests(phone) WHERE status='pendiente';
CREATE INDEX IF NOT EXISTS bl_join_status_idx ON public.bl_join_requests(status,created_at DESC);
ALTER TABLE public.bl_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_join_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_join_requests TO authenticated;
CREATE POLICY bl_join_staff_read ON public.bl_join_requests FOR SELECT TO authenticated USING ((SELECT bella_private.staff(true)));

CREATE OR REPLACE FUNCTION bella_private.approve_join_request(p_request uuid, p_user uuid, p_invoice text, p_amount integer, p_delivery integer, p_discount boolean, p_channel text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.bl_join_requests%rowtype; v_email text; v_purchase jsonb; t record;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración'; END IF;
 SELECT * INTO r FROM public.bl_join_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR r.status<>'pendiente' THEN RAISE EXCEPTION 'Solicitud inexistente o ya revisada'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Se requiere una compra real'; END IF;
 IF p_delivery IS NULL OR p_delivery<0 THEN RAISE EXCEPTION 'Transporte inválido'; END IF;
 IF char_length(trim(coalesce(p_invoice,''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Factura obligatoria'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_purchases WHERE invoice=trim(p_invoice)) THEN RAISE EXCEPTION 'Factura duplicada'; END IF;
 IF p_channel NOT IN ('tienda','whatsapp','web','domicilio','otro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_user;
 IF v_email IS DISTINCT FROM r.email THEN RAISE EXCEPTION 'Correo de la cuenta no coincide'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_profiles WHERE id=p_user OR phone=r.phone)
 THEN RAISE EXCEPTION 'Cuenta o celular ya registrados'; END IF;
 INSERT INTO public.bl_profiles(id,full_name,phone,category,marketing_optin,data_policy_accepted_at)
 VALUES(p_user,r.full_name,r.phone,r.category,r.marketing_optin,r.accepted_at);
 IF r.category='estudiante' AND r.teacher_code IS NOT NULL THEN
  SELECT teacher_id,code INTO t FROM public.bl_teacher_codes
   WHERE upper(code)=upper(r.teacher_code) AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código de profesora no encontrado'; END IF;
  INSERT INTO public.bl_referrals(student_id,teacher_id,code) VALUES(p_user,t.teacher_id,t.code);
 END IF;
 v_purchase:=bella_private.record_purchase_channel(p_user,trim(p_invoice),p_amount,coalesce(p_discount,false),p_delivery,p_notes,p_channel);
 UPDATE public.bl_join_requests SET status='aprobada',reviewed_at=now(),reviewed_by=auth.uid(),
 approved_user_id=p_user,first_purchase_id=(v_purchase->>'purchase_id')::uuid,
 review_reason='Primera compra confirmada en factura '||trim(p_invoice) WHERE id=p_request;
 PERFORM bella_private.log_change('aprobacion_por_compra','bl_join_requests',p_request::text,
 jsonb_build_object('factura',trim(p_invoice),'puntos',v_purchase->'points'));
 RETURN v_purchase;
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.join_requests_status()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce((SELECT join_requests_open FROM public.bl_settings WHERE id=1),false);
$function$;

CREATE OR REPLACE FUNCTION bella_private.reject_join_request(p_request uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN RAISE EXCEPTION 'Solo administración'; END IF;
 IF char_length(trim(coalesce(p_reason,'')))<8 THEN RAISE EXCEPTION 'Indica el motivo del rechazo'; END IF;
 UPDATE public.bl_join_requests SET status='rechazada',reviewed_at=now(),reviewed_by=auth.uid(),review_reason=trim(p_reason)
 WHERE id=p_request AND status='pendiente';
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud ya revisada'; END IF;
 PERFORM bella_private.log_change('rechazo_solicitud','bl_join_requests',p_request::text,
 jsonb_build_object('motivo',trim(p_reason)));
 RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.submit_join_request(p_name text, p_phone text, p_email text, p_category text, p_teacher_code text, p_marketing boolean, p_accept boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text:=lower(trim(coalesce(p_email,'')));
DECLARE v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bl_settings WHERE id=1 AND join_requests_open) THEN
  RAISE EXCEPTION 'BellaShop aún no ha abierto las solicitudes de ingreso'; END IF;
 IF NOT coalesce(p_accept,false) THEN RAISE EXCEPTION 'Debes aceptar el tratamiento de datos'; END IF;
 IF char_length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF v_phone ~ '^57[0-9]{10}$' THEN v_phone:=substring(v_phone from 3); END IF;
 IF v_phone !~ '^3[0-9]{9}$' THEN RAISE EXCEPTION 'Celular inválido'; END IF;
 v_phone:='+57'||v_phone;
 IF char_length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$'
 THEN RAISE EXCEPTION 'Escribe un correo válido para recibir el acceso'; END IF;
 IF p_category NOT IN ('estudiante','manicurista','profesora') THEN RAISE EXCEPTION 'Categoría inválida'; END IF;
 IF char_length(coalesce(p_teacher_code,''))>30 THEN RAISE EXCEPTION 'Código de profesora inválido'; END IF;
 IF EXISTS(SELECT 1 FROM public.bl_join_requests WHERE
   (email=v_email OR phone=v_phone) AND created_at>now()-interval '24 hours')
 OR EXISTS(SELECT 1 FROM public.bl_profiles WHERE phone=v_phone)
 OR EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email) THEN RETURN true; END IF;
 INSERT INTO public.bl_join_requests(full_name,phone,email,category,teacher_code,marketing_optin)
 VALUES(trim(p_name),v_phone,v_email,p_category,
 nullif(upper(trim(coalesce(p_teacher_code,''))),''),coalesce(p_marketing,false))
 ON CONFLICT DO NOTHING;
 RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_approve_join_request(p_request uuid, p_user uuid, p_invoice text, p_amount integer, p_delivery integer, p_discount boolean, p_channel text, p_notes text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.approve_join_request(p_request,p_user,p_invoice,p_amount,p_delivery,p_discount,p_channel,p_notes);
$function$;

CREATE OR REPLACE FUNCTION public.bl_join_requests_status()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT bella_private.join_requests_status();
$function$;

CREATE OR REPLACE FUNCTION public.bl_reject_join_request(p_request uuid, p_reason text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.reject_join_request(p_request,p_reason);
$function$;

CREATE OR REPLACE FUNCTION public.bl_submit_join_request(p_name text, p_phone text, p_email text, p_category text, p_teacher_code text, p_marketing boolean, p_accept boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.submit_join_request(p_name,p_phone,p_email,p_category,p_teacher_code,p_marketing,p_accept);
$function$;

GRANT USAGE ON SCHEMA bella_private TO anon,authenticated;
REVOKE ALL ON FUNCTION public.bl_register(text,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bl_submit_join_request(text,text,text,text,text,boolean,boolean),
 public.bl_approve_join_request(uuid,uuid,text,integer,integer,boolean,text,text),
 public.bl_reject_join_request(uuid,text),public.bl_join_requests_status()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_submit_join_request(text,text,text,text,text,boolean,boolean),
 bella_private.submit_join_request(text,text,text,text,text,boolean,boolean),
 public.bl_join_requests_status(),bella_private.join_requests_status() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_approve_join_request(uuid,uuid,text,integer,integer,boolean,text,text),
 bella_private.approve_join_request(uuid,uuid,text,integer,integer,boolean,text,text),
 public.bl_reject_join_request(uuid,text),bella_private.reject_join_request(uuid,text) TO authenticated;
COMMIT;
