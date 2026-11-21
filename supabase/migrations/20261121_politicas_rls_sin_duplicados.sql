-- Evitar políticas SELECT permisivas duplicadas; mantener las reglas de escritura solo para administración.
DROP POLICY IF EXISTS bl_gifts_manage ON public.bl_gift_options;
CREATE POLICY bl_gifts_admin_insert ON public.bl_gift_options FOR INSERT TO authenticated WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_gifts_admin_update ON public.bl_gift_options FOR UPDATE TO authenticated USING ((SELECT bella_private.staff(true))) WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_gifts_admin_delete ON public.bl_gift_options FOR DELETE TO authenticated USING ((SELECT bella_private.staff(true)));
DROP POLICY IF EXISTS bl_tiers_modify ON public.bl_referral_tiers;
CREATE POLICY bl_tiers_admin_insert ON public.bl_referral_tiers FOR INSERT TO authenticated WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_tiers_admin_update ON public.bl_referral_tiers FOR UPDATE TO authenticated USING ((SELECT bella_private.staff(true))) WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_tiers_admin_delete ON public.bl_referral_tiers FOR DELETE TO authenticated USING ((SELECT bella_private.staff(true)));
DROP POLICY IF EXISTS bl_rewards_manage ON public.bl_rewards;
CREATE POLICY bl_rewards_admin_insert ON public.bl_rewards FOR INSERT TO authenticated WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_rewards_admin_update ON public.bl_rewards FOR UPDATE TO authenticated USING ((SELECT bella_private.staff(true))) WITH CHECK ((SELECT bella_private.staff(true)));
CREATE POLICY bl_rewards_admin_delete ON public.bl_rewards FOR DELETE TO authenticated USING ((SELECT bella_private.staff(true)));
