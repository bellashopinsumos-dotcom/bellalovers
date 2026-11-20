-- BellaLovers: acceso sin claves con autorización de la jefa por dispositivo (10 min).
-- Ya aplicado en xpnfdyfnaromfwkontid. No ejecutar en otros proyectos.
CREATE TABLE IF NOT EXISTS public.bl_login_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 challenge_hash text NOT NULL UNIQUE CHECK(challenge_hash ~ '^[a-f0-9]{64}$'),
 member_id uuid NOT NULL REFERENCES public.bl_profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada','rechazada','usada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '10 minutes'),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS bl_login_requests_status_idx ON public.bl_login_requests(status,created_at DESC);
ALTER TABLE public.bl_login_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bl_login_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bl_login_requests TO authenticated;
DROP POLICY IF EXISTS bl_login_requests_admin_read ON public.bl_login_requests;
CREATE POLICY bl_login_requests_admin_read ON public.bl_login_requests FOR SELECT TO authenticated
 USING ((SELECT bella_private.staff(true)));

CREATE OR REPLACE FUNCTION bella_private.review_login_request(p_request uuid, p_approve boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE item public.bl_login_requests%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT bella_private.staff(true) THEN
   RAISE EXCEPTION 'Solo administración autorizada'; END IF;
 SELECT * INTO item FROM public.bl_login_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR item.status<>'pendiente' OR item.expires_at<now() THEN
   RAISE EXCEPTION 'Solicitud inexistente, vencida o ya revisada'; END IF;
 IF p_approve AND NOT EXISTS(
  SELECT 1 FROM public.bl_profiles p WHERE p.id=item.member_id
   AND NOT p.blocked AND p.archived_at IS NULL AND p.deleted_at IS NULL
 ) THEN RAISE EXCEPTION 'La cuenta ya no está activa'; END IF;
 UPDATE public.bl_login_requests SET status=CASE WHEN p_approve THEN 'aprobada' ELSE 'rechazada' END,
  reviewed_at=now(),reviewed_by=auth.uid() WHERE id=item.id;
 PERFORM bella_private.log_change(
  CASE WHEN p_approve THEN 'aprobar_acceso_temporal' ELSE 'rechazar_acceso_temporal' END,
  'bl_login_requests',item.id::text,
  jsonb_build_object('member_id',item.member_id,'vence',item.expires_at));
 RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION public.bl_review_login_request(p_request uuid, p_approve boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bella_private.review_login_request(p_request,p_approve);
$function$;

REVOKE ALL ON FUNCTION public.bl_review_login_request(uuid,boolean),
 bella_private.review_login_request(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bl_review_login_request(uuid,boolean),
 bella_private.review_login_request(uuid,boolean) TO authenticated;
