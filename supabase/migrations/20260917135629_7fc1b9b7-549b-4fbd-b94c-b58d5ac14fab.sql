ALTER TABLE public.inventory_items ADD COLUMN deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_edits ADD COLUMN action text NOT NULL DEFAULT 'rename';