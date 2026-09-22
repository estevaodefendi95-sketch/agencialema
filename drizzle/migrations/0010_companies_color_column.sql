ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS color text;

NOTIFY pgrst, 'reload schema';