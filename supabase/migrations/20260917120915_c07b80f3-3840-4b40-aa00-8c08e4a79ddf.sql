
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'adult',
  color text NOT NULL DEFAULT 'sage',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO anon, authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage members" ON public.members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  notes text,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  due_date date NOT NULL DEFAULT current_date,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chores TO anon, authenticated;
GRANT ALL ON public.chores TO service_role;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage chores" ON public.chores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_chores_updated_at BEFORE UPDATE ON public.chores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chore_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id uuid NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  completed_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chore_completions TO anon, authenticated;
GRANT ALL ON public.chore_completions TO service_role;
ALTER TABLE public.chore_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage completions" ON public.chore_completions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date date NOT NULL,
  slot text NOT NULL,
  title text NOT NULL,
  notes text,
  toddler_note text NOT NULL DEFAULT 'Plate her portion before adding salt, spice or seasoning.',
  cooked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meal_date, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO anon, authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage meals" ON public.meals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meal_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_ingredients TO anon, authenticated;
GRANT ALL ON public.meal_ingredients TO service_role;
ALTER TABLE public.meal_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage meal ingredients" ON public.meal_ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'pantry',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  low_threshold numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO anon, authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage inventory" ON public.inventory_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity text,
  category text NOT NULL DEFAULT 'pantry',
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO anon, authenticated;
GRANT ALL ON public.shopping_items TO service_role;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household can manage shopping list" ON public.shopping_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_shopping_updated_at BEFORE UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.members (name, role, color, sort_order) VALUES
  ('Wife', 'adult', 'clay', 1),
  ('Husband', 'adult', 'sage', 2),
  ('Father-in-law', 'adult', 'ochre', 3),
  ('Little one', 'toddler', 'plum', 4);

INSERT INTO public.chores (title, member_id, frequency, due_date, notes)
SELECT v.title, m.id, v.frequency, current_date + v.offset_days, v.notes
FROM (VALUES
  ('Dishes after dinner', 'Husband', 'daily', 0, NULL),
  ('Toddler bath & bedtime', 'Wife', 'daily', 0, NULL),
  ('Take bins out', 'Father-in-law', 'weekly', 1, 'Kerbside by 7am'),
  ('Vacuum living areas', 'Husband', 'weekly', 2, NULL),
  ('Laundry & folding', 'Wife', 'weekly', 0, NULL),
  ('Water the garden', 'Father-in-law', 'daily', 0, NULL),
  ('Grocery shop', 'Wife', 'weekly', 3, 'Use the shopping list'),
  ('Clean bathrooms', 'Husband', 'weekly', 4, NULL),
  ('Tidy toys', 'Little one', 'daily', 0, 'With a grown-up')
) AS v(title, member_name, frequency, offset_days, notes)
JOIN public.members m ON m.name = v.member_name;

INSERT INTO public.inventory_items (name, category, quantity, unit, low_threshold) VALUES
  ('Rice', 'pantry', 3, 'kg', 1),
  ('Pasta', 'pantry', 2, 'packs', 1),
  ('Olive oil', 'pantry', 1, 'bottles', 1),
  ('Milk', 'fridge', 1, 'L', 2),
  ('Eggs', 'fridge', 6, 'pcs', 6),
  ('Yoghurt', 'fridge', 2, 'tubs', 1),
  ('Chicken thighs', 'freezer', 1, 'kg', 1),
  ('Frozen peas', 'freezer', 2, 'bags', 1),
  ('Dish soap', 'cleaning', 1, 'bottles', 1),
  ('Laundry powder', 'cleaning', 1, 'boxes', 1),
  ('Toothpaste', 'toiletries', 2, 'tubes', 1),
  ('Toilet paper', 'toiletries', 4, 'rolls', 6),
  ('Nappies', 'baby', 20, 'pcs', 24),
  ('Baby wipes', 'baby', 2, 'packs', 2);

INSERT INTO public.meals (meal_date, slot, title, notes) VALUES
  (current_date, 'breakfast', 'Porridge with banana', 'Mash banana for the little one'),
  (current_date, 'lunch', 'Chicken and vegetable soup', NULL),
  (current_date, 'dinner', 'Rice, chicken thighs and steamed greens', 'Season adults at the table'),
  (current_date + 1, 'dinner', 'Pasta with tomato and vegetables', NULL);

INSERT INTO public.meal_ingredients (meal_id, name, quantity)
SELECT m.id, v.name, v.quantity
FROM (VALUES
  ('Rice, chicken thighs and steamed greens', 'Rice', '2 cups'),
  ('Rice, chicken thighs and steamed greens', 'Chicken thighs', '800 g'),
  ('Rice, chicken thighs and steamed greens', 'Broccoli', '1 head'),
  ('Pasta with tomato and vegetables', 'Pasta', '500 g'),
  ('Pasta with tomato and vegetables', 'Tinned tomatoes', '2 tins'),
  ('Pasta with tomato and vegetables', 'Zucchini', '2'),
  ('Porridge with banana', 'Oats', '2 cups'),
  ('Porridge with banana', 'Bananas', '3'),
  ('Chicken and vegetable soup', 'Carrots', '3'),
  ('Chicken and vegetable soup', 'Celery', '2 stalks')
) AS v(meal_title, name, quantity)
JOIN public.meals m ON m.title = v.meal_title;
