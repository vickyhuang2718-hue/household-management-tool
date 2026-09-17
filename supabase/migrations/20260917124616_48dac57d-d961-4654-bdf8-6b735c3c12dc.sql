ALTER TABLE public.members ADD COLUMN IF NOT EXISTS initial text NOT NULL DEFAULT '';
UPDATE public.members SET initial = left(name, 1) WHERE initial = '';