-- 1. households
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '我们的家 Our home',
  join_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gen_join_key()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

-- seed the existing household
INSERT INTO public.households (id, name, join_key)
SELECT id, name, public.gen_join_key() FROM public.household_settings LIMIT 1;

INSERT INTO public.households (name, join_key)
SELECT '我们的家 Our home', public.gen_join_key()
WHERE NOT EXISTS (SELECT 1 FROM public.households);

-- 2. helper functions
CREATE OR REPLACE FUNCTION public.is_household_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- 3. household_id columns
ALTER TABLE public.profiles ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;
UPDATE public.profiles SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);

CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;

ALTER TABLE public.user_roles ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
UPDATE public.user_roles SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);

ALTER TABLE public.members ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.chores ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.chore_completions ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.chore_edits ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.meals ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.meal_ingredients ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_edits ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_items ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;

UPDATE public.members SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.chores SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.chore_completions SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.chore_edits SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.meals SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.meal_ingredients SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.inventory_items SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.inventory_edits SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);
UPDATE public.shopping_items SET household_id = (SELECT id FROM public.households ORDER BY created_at LIMIT 1);

ALTER TABLE public.members ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.chores ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.chore_completions ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.chore_edits ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.meals ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.meal_ingredients ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.inventory_items ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.inventory_edits ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();
ALTER TABLE public.shopping_items ALTER COLUMN household_id SET NOT NULL, ALTER COLUMN household_id SET DEFAULT public.current_household_id();

-- 4. join requests
CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT join_requests_status_check CHECK (status IN ('pending', 'approved', 'declined')),
  CONSTRAINT join_requests_unique UNIQUE (household_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_join_requests_updated_at BEFORE UPDATE ON public.join_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view their own join requests" ON public.join_requests
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view their household join requests" ON public.join_requests
FOR SELECT TO authenticated
USING (household_id = public.current_household_id() AND public.is_household_admin());
CREATE POLICY "Admins can resolve join requests" ON public.join_requests
FOR UPDATE TO authenticated
USING (household_id = public.current_household_id() AND public.is_household_admin())
WITH CHECK (household_id = public.current_household_id() AND public.is_household_admin());

-- 5. households policies
CREATE POLICY "Members can view their household" ON public.households
FOR SELECT TO authenticated USING (id = public.current_household_id());
CREATE POLICY "Admins can rename their household" ON public.households
FOR UPDATE TO authenticated
USING (id = public.current_household_id() AND public.is_household_admin())
WITH CHECK (id = public.current_household_id() AND public.is_household_admin());

-- 6. profiles policies (fix email exposure)
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view profiles in their household" ON public.profiles
FOR SELECT TO authenticated
USING (
  public.is_household_admin()
  AND (
    household_id = public.current_household_id()
    OR EXISTS (
      SELECT 1 FROM public.join_requests jr
      WHERE jr.user_id = public.profiles.id
        AND jr.household_id = public.current_household_id()
    )
  )
);

-- 7. household-scoped policies for data tables
DROP POLICY IF EXISTS "Household can manage members" ON public.members;
CREATE POLICY "Household can manage members" ON public.members
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage chores" ON public.chores;
CREATE POLICY "Household can manage chores" ON public.chores
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage completions" ON public.chore_completions;
CREATE POLICY "Household can manage completions" ON public.chore_completions
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage meals" ON public.meals;
CREATE POLICY "Household can manage meals" ON public.meals
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage meal ingredients" ON public.meal_ingredients;
CREATE POLICY "Household can manage meal ingredients" ON public.meal_ingredients
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage inventory" ON public.inventory_items;
CREATE POLICY "Household can manage inventory" ON public.inventory_items
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Household can manage shopping list" ON public.shopping_items;
CREATE POLICY "Household can manage shopping list" ON public.shopping_items
FOR ALL TO authenticated
USING (household_id = public.current_household_id())
WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Signed-in users can view chore edits" ON public.chore_edits;
DROP POLICY IF EXISTS "Signed-in users can log their own edits" ON public.chore_edits;
DROP POLICY IF EXISTS "Admins can resolve chore edits" ON public.chore_edits;
CREATE POLICY "Household can view chore edits" ON public.chore_edits
FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Household can log chore edits" ON public.chore_edits
FOR INSERT TO authenticated
WITH CHECK (edited_by = auth.uid() AND household_id = public.current_household_id());
CREATE POLICY "Admins can resolve chore edits" ON public.chore_edits
FOR UPDATE TO authenticated
USING (household_id = public.current_household_id() AND public.is_household_admin())
WITH CHECK (household_id = public.current_household_id() AND public.is_household_admin());

DROP POLICY IF EXISTS "Signed-in users can view inventory edits" ON public.inventory_edits;
DROP POLICY IF EXISTS "Signed-in users can log their own inventory edits" ON public.inventory_edits;
DROP POLICY IF EXISTS "Admins can resolve inventory edits" ON public.inventory_edits;
CREATE POLICY "Household can view inventory edits" ON public.inventory_edits
FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Household can log inventory edits" ON public.inventory_edits
FOR INSERT TO authenticated
WITH CHECK (edited_by = auth.uid() AND household_id = public.current_household_id());
CREATE POLICY "Admins can resolve inventory edits" ON public.inventory_edits
FOR UPDATE TO authenticated
USING (household_id = public.current_household_id() AND public.is_household_admin())
WITH CHECK (household_id = public.current_household_id() AND public.is_household_admin());

DROP POLICY IF EXISTS "Signed-in users can view roles" ON public.user_roles;
CREATE POLICY "Household can view roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR household_id = public.current_household_id());

-- 8. new sign-ups get a profile only; no household, no role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 9. onboarding RPCs
CREATE OR REPLACE FUNCTION public.create_household(_name text, _display_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _hid uuid;
  _mid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF (SELECT household_id FROM public.profiles WHERE id = _uid) IS NOT NULL THEN
    RAISE EXCEPTION '你已经在一个家庭里了';
  END IF;

  INSERT INTO public.households (name, join_key)
  VALUES (coalesce(nullif(btrim(_name), ''), '我们的家 Our home'), public.gen_join_key())
  RETURNING id INTO _hid;

  INSERT INTO public.members (household_id, name, role, color, sort_order, initial)
  VALUES (_hid, coalesce(nullif(btrim(_display_name), ''), '我'), 'adult', 'sage', 0, '')
  RETURNING id INTO _mid;

  UPDATE public.profiles SET household_id = _hid, member_id = _mid WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, role, household_id)
  VALUES (_uid, 'admin', _hid) ON CONFLICT DO NOTHING;

  RETURN _hid;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_join_household(_key text, _display_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _hid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF (SELECT household_id FROM public.profiles WHERE id = _uid) IS NOT NULL THEN
    RAISE EXCEPTION '你已经在一个家庭里了';
  END IF;

  SELECT id INTO _hid FROM public.households
  WHERE upper(btrim(join_key)) = upper(btrim(_key));
  IF _hid IS NULL THEN RAISE EXCEPTION '找不到这个家庭邀请码'; END IF;

  INSERT INTO public.join_requests (household_id, user_id, display_name, status)
  VALUES (_hid, _uid, coalesce(nullif(btrim(_display_name), ''), '新成员'), 'pending')
  ON CONFLICT (household_id, user_id)
  DO UPDATE SET status = 'pending', display_name = EXCLUDED.display_name, updated_at = now();

  RETURN _hid;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_join_request(_request_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req public.join_requests%ROWTYPE;
  _mid uuid;
BEGIN
  SELECT * INTO _req FROM public.join_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION '找不到这个申请'; END IF;
  IF _req.household_id IS DISTINCT FROM public.current_household_id()
     OR NOT public.is_household_admin() THEN
    RAISE EXCEPTION '只有管理员可以处理申请';
  END IF;

  IF _approve THEN
    INSERT INTO public.members (household_id, name, role, color, sort_order, initial)
    VALUES (_req.household_id, _req.display_name, 'adult', 'clay',
            coalesce((SELECT max(sort_order) + 1 FROM public.members WHERE household_id = _req.household_id), 0), '')
    RETURNING id INTO _mid;

    UPDATE public.profiles SET household_id = _req.household_id, member_id = _mid
    WHERE id = _req.user_id;

    INSERT INTO public.user_roles (user_id, role, household_id)
    VALUES (_req.user_id, 'member', _req.household_id) ON CONFLICT DO NOTHING;

    UPDATE public.join_requests SET status = 'approved', updated_at = now() WHERE id = _request_id;
  ELSE
    UPDATE public.join_requests SET status = 'declined', updated_at = now() WHERE id = _request_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_onboarding_state()
RETURNS TABLE (household_id uuid, household_name text, join_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.household_id,
         h.name,
         (SELECT jr.status FROM public.join_requests jr
          WHERE jr.user_id = auth.uid() ORDER BY jr.updated_at DESC LIMIT 1)
  FROM public.profiles p
  LEFT JOIN public.households h ON h.id = p.household_id
  WHERE p.id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.gen_join_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_join_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_onboarding_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_admin() TO authenticated;