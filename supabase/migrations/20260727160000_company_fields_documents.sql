-- Campos extras de empresa (site/Instagram/rótulo do botão de planejamento)
-- e uma tabela de documentos anexados por empresa.
ALTER TABLE public.companies ADD COLUMN website_url TEXT;
ALTER TABLE public.companies ADD COLUMN instagram_url TEXT;
ALTER TABLE public.companies ADD COLUMN planning_label TEXT;

CREATE TABLE public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all company documents" ON public.company_documents FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors manage their company documents" ON public.company_documents FOR ALL
USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND public.has_company_access(auth.uid(), company_id))
WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users view their company documents" ON public.company_documents FOR SELECT
USING (public.is_approved(auth.uid()) AND public.has_company_access(auth.uid(), company_id));
