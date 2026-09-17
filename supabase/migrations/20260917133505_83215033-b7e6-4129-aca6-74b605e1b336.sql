CREATE TABLE public.inventory_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name text NOT NULL DEFAULT '',
  before_name text NOT NULL,
  after_name text NOT NULL,
  undone boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.inventory_edits TO authenticated;
GRANT ALL ON public.inventory_edits TO service_role;

ALTER TABLE public.inventory_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view inventory edits"
  ON public.inventory_edits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can log their own inventory edits"
  ON public.inventory_edits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Admins can resolve inventory edits"
  ON public.inventory_edits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));