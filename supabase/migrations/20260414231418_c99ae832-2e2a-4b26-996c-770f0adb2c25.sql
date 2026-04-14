
-- Add status column back to tasks if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN status text NOT NULL DEFAULT 'a_fazer';
  END IF;
END $$;

-- Create project_columns table
CREATE TABLE IF NOT EXISTS public.project_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_columns_project_id ON public.project_columns(project_id);

ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin can manage all columns"
ON public.project_columns FOR ALL
USING (is_super_admin());

-- Agency admin full access
CREATE POLICY "Agency admin can manage agency columns"
ON public.project_columns FOR ALL
USING (
  (has_role(auth.uid(), 'agency_admin') OR has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM projects p JOIN companies c ON c.id = p.company_id
    WHERE p.id = project_columns.project_id AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

-- Clients can view
CREATE POLICY "Clients can view project columns"
ON public.project_columns FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_columns.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Editors can view
CREATE POLICY "Editors can view project columns"
ON public.project_columns FOR SELECT
USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor') OR has_role(auth.uid(), 'visualizador'))
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_columns.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Editors can manage columns
CREATE POLICY "Editors can manage project columns"
ON public.project_columns FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_columns.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_project_columns_updated_at
BEFORE UPDATE ON public.project_columns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
