-- Suporte a múltiplos arquivos (imagem/vídeo) por post do Planejamento de
-- Posts, mantendo presentation_posts.image_url como fallback legado (não
-- migrado automaticamente — a leitura no frontend cai de volta pra ele
-- quando um post ainda não tem nenhuma linha aqui).
CREATE TABLE public.presentation_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.presentation_posts(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentation_post_media_post ON public.presentation_post_media(post_id);

ALTER TABLE public.presentation_post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all post media"
ON public.presentation_post_media FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors manage post media"
ON public.presentation_post_media FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.presentation_posts post
    JOIN public.project_presentations pres ON pres.id = post.presentation_id
    JOIN public.projects proj ON proj.id = pres.project_id
    WHERE post.id = presentation_post_media.post_id
      AND has_company_access(auth.uid(), proj.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.presentation_posts post
    JOIN public.project_presentations pres ON pres.id = post.presentation_id
    JOIN public.projects proj ON proj.id = pres.project_id
    WHERE post.id = presentation_post_media.post_id
      AND has_company_access(auth.uid(), proj.company_id)
  )
);

CREATE POLICY "Approved users view post media"
ON public.presentation_post_media FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.presentation_posts post
    JOIN public.project_presentations pres ON pres.id = post.presentation_id
    JOIN public.projects proj ON proj.id = pres.project_id
    WHERE post.id = presentation_post_media.post_id
      AND has_company_access(auth.uid(), proj.company_id)
  )
);

CREATE POLICY "Public view released post media"
ON public.presentation_post_media FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.presentation_posts post
    JOIN public.project_presentations pres ON pres.id = post.presentation_id
    WHERE post.id = presentation_post_media.post_id
      AND pres.status = 'publicado'
      AND pres.released = true
  )
);
