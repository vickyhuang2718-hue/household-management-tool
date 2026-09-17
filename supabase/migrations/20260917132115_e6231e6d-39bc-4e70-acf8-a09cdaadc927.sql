ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'enough',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_status_check CHECK (status IN ('enough','low','out'));