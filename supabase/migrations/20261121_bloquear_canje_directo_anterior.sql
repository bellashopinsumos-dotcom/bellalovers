-- La solicitud de premio desde una cuenta no verificada ya no puede reservar puntos.
-- Las redenciones antiguas permanecen para que BellaShop las revise desde administración.
REVOKE EXECUTE ON FUNCTION public.bl_redeem(jsonb) FROM PUBLIC, anon, authenticated;
