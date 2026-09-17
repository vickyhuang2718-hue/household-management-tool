CREATE TABLE public.chore_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id uuid NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name text NOT NULL DEFAULT '',
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  undone boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.chore_edits TO authenticated;
GRANT ALL ON public.chore_edits TO service_role;

ALTER TABLE public.chore_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view chore edits"
ON public.chore_edits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can log their own edits"
ON public.chore_edits FOR INSERT TO authenticated WITH CHECK (auth.uid() = edited_by);

CREATE POLICY "Admins can resolve chore edits"
ON public.chore_edits FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX chore_edits_pending_idx ON public.chore_edits (created_at DESC) WHERE NOT dismissed;