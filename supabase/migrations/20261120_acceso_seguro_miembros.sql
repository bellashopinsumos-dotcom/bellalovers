-- BellaLovers: protección contra solicitudes repetidas de enlaces de acceso.
-- Aplicada al proyecto BellaLovers xpnfdyfnaromfwkontid.
-- Ejecutar después de 20261120_profesoras_afiliadas.sql.
CREATE TABLE IF NOT EXISTS public.bl_member_access_limits (
 key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
 hour_start timestamptz NOT NULL,
 hits integer NOT NULL CHECK(hits>=1),
 PRIMARY KEY(key_hash,hour_start)
);
ALTER TABLE public.bl_member_access_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_member_access_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bl_limit_member_access(p_key text,p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE n integer;
BEGIN
 IF p_key !~ '^[a-f0-9]{64}$' OR p_max NOT BETWEEN 1 AND 100 THEN RETURN false; END IF;
 INSERT INTO public.bl_member_access_limits(key_hash,hour_start,hits)
 VALUES(p_key,pg_catalog.date_trunc('hour',pg_catalog.clock_timestamp()),1)
 ON CONFLICT(key_hash,hour_start) DO UPDATE
   SET hits=public.bl_member_access_limits.hits+1 RETURNING hits INTO n;
 RETURN n<=p_max;
END;$fn$;
REVOKE ALL ON FUNCTION public.bl_limit_member_access(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_limit_member_access(text,integer) TO service_role;
