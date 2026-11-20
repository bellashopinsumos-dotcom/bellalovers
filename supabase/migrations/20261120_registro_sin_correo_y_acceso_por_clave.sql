-- BellaLovers: solicitar ingreso solo con nombre, celular y categoría, sin correo.
-- No modifica cuentas ni compras existentes; mantiene RPC pública y validaciones de profesora.
-- Ya aplicado al proyecto xpnfdyfnaromfwkontid.
BEGIN;
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
    (email=v_email OR phone=v_phone) AND created_at>now()-interval '24 hours')
  OR EXISTS(SELECT 1 FROM public.bl_profiles WHERE phone=v_phone)
  OR EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email) THEN RETURN true; END IF;
 INSERT INTO public.bl_join_requests(full_name,phone,email,category,teacher_code,
  affiliate_teacher_id,marketing_optin)
 VALUES(trim(p_name),v_phone,v_email,p_category,v_code,v_teacher,coalesce(p_marketing,false))
 ON CONFLICT DO NOTHING;
 RETURN true;
END;$function$;
COMMIT;
