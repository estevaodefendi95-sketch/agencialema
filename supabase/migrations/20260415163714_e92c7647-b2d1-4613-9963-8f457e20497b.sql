
CREATE TABLE public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'membro',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin can manage all members"
ON public.project_members FOR ALL
USING (is_super_admin());

-- Agency admin can manage members for agency projects
CREATE POLICY "Agency admin can manage agency project members"
ON public.project_members FOR ALL
USING (
  (has_role(auth.uid(), 'agency_admin') OR has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM projects p JOIN companies c ON c.id = p.company_id
    WHERE p.id = project_members.project_id AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

-- Editors can manage members for their projects
CREATE POLICY "Editors can manage project members"
ON public.project_members FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_members.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Members can view project members
CREATE POLICY "Members can view project members"
ON public.project_members FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_members.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);
