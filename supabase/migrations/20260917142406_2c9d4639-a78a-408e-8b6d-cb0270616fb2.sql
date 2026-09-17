UPDATE public.members SET color = 'teal' WHERE color = 'plum';
UPDATE public.members SET color = 'cocoa' WHERE color = 'rose';

CREATE OR REPLACE FUNCTION public.household_member_roles()
RETURNS TABLE(member_id uuid, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.member_id, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.household_id = public.current_household_id()
    AND p.member_id IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.household_member_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_member_roles() TO authenticated;