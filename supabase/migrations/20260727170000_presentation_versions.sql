-- Versionamento de apresentações: cada "lançamento" congela um snapshot dos
-- blocos/posts/mídia no momento em que o admin/editor clica em "Lançar e
-- Salvar", separando a edição (Planejamento) da publicação (Apresentação).
CREATE TABLE public.presentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.project_presentations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentation_versions_presentation ON public.presentation_versions(presentation_id);

ALTER TABLE public.presentation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all presentation versions"
ON public.presentation_versions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors manage presentation versions"
ON public.presentation_versions FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_versions.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_versions.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Approved users view presentation versions"
ON public.presentation_versions FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_versions.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Public view released presentation versions"
ON public.presentation_versions FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_presentations pp
    WHERE pp.id = presentation_versions.presentation_id
      AND pp.status = 'publicado'
      AND pp.released = true
  )
);
