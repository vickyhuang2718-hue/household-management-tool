ALTER TABLE public.inventory_items
  ADD COLUMN note text,
  ADD COLUMN note_updated_at timestamptz,
  ADD COLUMN note_updated_by text;