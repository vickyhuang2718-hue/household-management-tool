CREATE TABLE public.meal_dishes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  household_id uuid NOT NULL DEFAULT current_household_id() REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  baby_tag text NOT NULL DEFAULT 'reserve' CHECK (baby_tag IN ('as_is','reserve','not_suitable')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_dishes TO authenticated;
GRANT ALL ON public.meal_dishes TO service_role;

ALTER TABLE public.meal_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household can manage meal dishes"
ON public.meal_dishes FOR ALL TO authenticated
USING (household_id = current_household_id())
WITH CHECK (household_id = current_household_id());

CREATE TRIGGER update_meal_dishes_updated_at
BEFORE UPDATE ON public.meal_dishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX meal_dishes_meal_id_idx ON public.meal_dishes(meal_id);

INSERT INTO public.meal_dishes (meal_id, household_id, name, notes, baby_tag, sort_order)
SELECT m.id, m.household_id, m.title, m.notes, 'reserve', 0
FROM public.meals m
WHERE btrim(coalesce(m.title, '')) <> '';