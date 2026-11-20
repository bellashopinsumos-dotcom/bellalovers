-- BellaLovers: premios públicos, compras WhatsApp, registro y acceso inicial.
-- Aplicar SOLO tras supabase/schema.sql y 20261120_restauracion_y_equipo.sql.
-- Esta migración ya está aplicada al proyecto BellaLovers xpnfdyfnaromfwkontid.
BEGIN;
ALTER TABLE public.bl_purchases ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'tienda';
ALTER TABLE public.bl_purchases DROP CONSTRAINT IF EXISTS bl_purchases_channel_valid;
ALTER TABLE public.bl_purchases ADD CONSTRAINT bl_purchases_channel_valid
 CHECK (channel IN ('tienda','whatsapp','web','domicilio','otro'));
ALTER TABLE public.bl_settings ADD COLUMN IF NOT EXISTS signup_open boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION bella_private.bl_public_rewards()
 RETURNS TABLE(id uuid, name text, product_ref text, image_url text, points_cost integer, available integer, audience text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT r.id,r.name,r.product_ref,r.image_url,r.points_cost,
        greatest(0,r.stock-r.reserved)::integer,r.audience
 FROM public.bl_rewards r
 WHERE r.active AND r.stock>r.reserved
 ORDER BY r.points_cost,r.name LIMIT 120;
$function$;

CREATE OR REPLACE FUNCTION bella_private.bl_public_status()
 RETURNS TABLE(signup_open boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT s.signup_open FROM public.bl_settings s WHERE s.id=1;
$function$;

CREATE OR REPLACE FUNCTION bella_private.claim_first_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=auth.uid(); owner_email text; verified timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(25112026);
  SELECT lower(email),email_confirmed_at INTO owner_email,verified FROM auth.users WHERE id=uid;
  IF owner_email IS DISTINCT FROM 'bellashopinsumos@gmail.com' OR verified IS NULL
    THEN RAISE EXCEPTION 'Verifica primero el correo oficial de BellaShop'; END IF;
  IF EXISTS(SELECT 1 FROM public.bl_staff WHERE role='admin' AND active) THEN
    RETURN EXISTS(SELECT 1 FROM public.bl_staff WHERE user_id=uid AND role='admin' AND active);
  END IF;
  INSERT INTO public.bl_staff(user_id,role,active) VALUES(uid,'admin',true)
  ON CONFLICT(user_id) DO UPDATE SET role='admin',active=true;
  PERFORM bella_private.log_change('activar_administrador_inicial','bl_staff',uid::text,jsonb_build_object('correo',owner_email));
  RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION bella_private.record_purchase_channel(p_customer uuid, p_invoice text, p_amount integer, p_discount boolean, p_delivery integer, p_notes text, p_channel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE res jsonb; rid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT bella_private.staff() THEN RAISE EXCEPTION 'Solo empleados autorizados'; END IF;
  IF p_channel NOT IN ('tienda','whatsapp','web','domicilio','otro') OR p_channel IS NULL
    THEN RAISE EXCEPTION 'Canal de compra inválido'; END IF;
  res:=bella_private.record_purchase(p_customer,p_invoice,p_amount,p_discount,p_delivery,p_notes);
  rid:=(res->>'purchase_id')::uuid;
  UPDATE public.bl_purchases SET channel=p_channel WHERE id=rid;
  PERFORM bella_private.log_change('canal_venta','compra',rid::text,jsonb_build_object('canal',p_channel));
  RETURN res;
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_claim_first_admin()
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.claim_first_admin();
$function$;

CREATE OR REPLACE FUNCTION public.bl_public_rewards()
 RETURNS TABLE(id uuid, name text, product_ref text, image_url text, points_cost integer, available integer, audience text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT * FROM bella_private.bl_public_rewards();
$function$;

CREATE OR REPLACE FUNCTION public.bl_public_status()
 RETURNS TABLE(signup_open boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT * FROM bella_private.bl_public_status();
$function$;

CREATE OR REPLACE FUNCTION public.bl_purchase_channel(p_customer uuid, p_invoice text, p_amount integer, p_discount boolean, p_delivery integer, p_notes text, p_channel text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.record_purchase_channel(p_customer,p_invoice,p_amount,p_discount,p_delivery,p_notes,p_channel);
$function$;

CREATE OR REPLACE FUNCTION public.bl_register(p_name text, p_category text, p_teacher_code text, p_marketing boolean, p_accept boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (SELECT s.signup_open FROM public.bl_settings s WHERE s.id=1)
    THEN RAISE EXCEPTION 'Las inscripciones aún no están habilitadas por BellaShop'; END IF;
  RETURN bella_private.register_customer(p_name,p_category,p_teacher_code,p_marketing,p_accept);
END;$function$;

GRANT USAGE ON SCHEMA bella_private TO anon,authenticated;
REVOKE ALL ON FUNCTION public.bl_public_rewards(),public.bl_public_status(),
 public.bl_purchase_channel(uuid,text,integer,boolean,integer,text,text),
 public.bl_claim_first_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_public_rewards(),public.bl_public_status() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION bella_private.bl_public_rewards(),bella_private.bl_public_status() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_purchase_channel(uuid,text,integer,boolean,integer,text,text),
 public.bl_claim_first_admin(),bella_private.record_purchase_channel(uuid,text,integer,boolean,integer,text,text),
 bella_private.claim_first_admin() TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('bellalovers-premios','bellalovers-premios',true,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=3145728,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS "BellaLovers admin upload rewards" ON storage.objects;
CREATE POLICY "BellaLovers admin upload rewards" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK(bucket_id='bellalovers-premios' AND (SELECT bella_private.staff(true)));
DROP POLICY IF EXISTS "BellaLovers admin update rewards" ON storage.objects;
CREATE POLICY "BellaLovers admin update rewards" ON storage.objects
 FOR UPDATE TO authenticated USING(bucket_id='bellalovers-premios' AND (SELECT bella_private.staff(true)))
 WITH CHECK(bucket_id='bellalovers-premios' AND (SELECT bella_private.staff(true)));
DROP POLICY IF EXISTS "BellaLovers admin delete rewards" ON storage.objects;
CREATE POLICY "BellaLovers admin delete rewards" ON storage.objects
 FOR DELETE TO authenticated USING(bucket_id='bellalovers-premios' AND (SELECT bella_private.staff(true)));
COMMIT;
