-- 1. household_settings: no anonymous reads
DROP POLICY IF EXISTS "Anyone can view household settings" ON public.household_settings;
CREATE POLICY "Signed-in users can view household settings"
ON public.household_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.household_settings FROM anon;

-- 2. meal_dishes: verify parent meal belongs to the same household
DROP POLICY IF EXISTS "Household can manage meal dishes" ON public.meal_dishes;
CREATE POLICY "Household can manage meal dishes"
ON public.meal_dishes FOR ALL TO authenticated
USING (
  household_id = public.current_household_id()
  AND EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_dishes.meal_id AND m.household_id = public.current_household_id())
)
WITH CHECK (
  household_id = public.current_household_id()
  AND EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_dishes.meal_id AND m.household_id = public.current_household_id())
);

-- 3. user_roles: explicit, fail-closed write denial + force RLS
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
DROP POLICY IF EXISTS "No direct role writes" ON public.user_roles;
CREATE POLICY "No direct role writes"
ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated, anon
USING (true) WITH CHECK (false);

-- 4. internal helpers should not be callable directly by app users
REVOKE ALL ON FUNCTION public.gen_join_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;