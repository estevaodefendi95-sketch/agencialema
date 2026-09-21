ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS day_order integer;