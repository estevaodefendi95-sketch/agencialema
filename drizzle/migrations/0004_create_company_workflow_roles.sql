CREATE TABLE IF NOT EXISTS public.company_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL CHECK (role_key IN ('planejamento', 'copy', 'postagem_feed', 'postagem_story')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, role_key, user_id)
);

ALTER TABLE public.company_workflow_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and company access can view workflow roles" ON public.company_workflow_roles;

CREATE POLICY "Admins and company access can view workflow roles" ON public.company_workflow_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_company_access(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Admins manage workflow roles" ON public.company_workflow_roles;

CREATE POLICY "Admins manage workflow roles" ON public.company_workflow_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.company_workflow_roles TO authenticated;
GRANT ALL ON public.company_workflow_roles TO service_role;