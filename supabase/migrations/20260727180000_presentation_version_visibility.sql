-- Cada lançamento (presentation_versions) agora pode ser mostrado ou
-- escondido do cliente individualmente, sem depender do status/released do
-- contêiner (project_presentations), que continua sendo o interruptor geral
-- da página pública existir ou não.
ALTER TABLE public.presentation_versions ADD COLUMN visible_to_client BOOLEAN NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Public view released presentation versions" ON public.presentation_versions;

CREATE POLICY "Public view released presentation versions"
ON public.presentation_versions FOR SELECT
TO anon, authenticated
USING (
  visible_to_client = true
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    WHERE pp.id = presentation_versions.presentation_id
      AND pp.status = 'publicado'
      AND pp.released = true
  )
);
