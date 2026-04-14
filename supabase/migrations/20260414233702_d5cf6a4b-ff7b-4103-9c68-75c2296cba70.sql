
-- Add archived column to projects
ALTER TABLE public.projects ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Create project_history table
CREATE TABLE public.project_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admin can manage all project history"
ON public.project_history FOR ALL
USING (is_super_admin());

CREATE POLICY "Agency admin can manage agency project history"
ON public.project_history FOR ALL
USING (
  (has_role(auth.uid(), 'agency_admin') OR has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM projects p JOIN companies c ON c.id = p.company_id
    WHERE p.id = project_history.project_id AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

CREATE POLICY "Editors can view project history"
ON public.project_history FOR SELECT
USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor') OR has_role(auth.uid(), 'visualizador'))
  AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_history.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Editors can insert project history"
ON public.project_history FOR INSERT
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor')
  AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_history.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Clients can view project history"
ON public.project_history FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_history.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Clients can insert project history"
ON public.project_history FOR INSERT
WITH CHECK (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_history.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);
