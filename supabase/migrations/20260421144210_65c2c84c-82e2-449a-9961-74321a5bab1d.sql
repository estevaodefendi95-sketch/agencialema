
-- 1) Tabela principal de apresentação
CREATE TABLE public.project_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'rascunho',
  released boolean NOT NULL DEFAULT false,
  client_logo_url text,
  agency_logo_url text,
  hero_title text,
  hero_description text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_presentations_project ON public.project_presentations(project_id);
CREATE INDEX idx_project_presentations_slug ON public.project_presentations(slug);

CREATE TRIGGER trg_project_presentations_updated
BEFORE UPDATE ON public.project_presentations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_presentations ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "Admins manage all presentations"
ON public.project_presentations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Editores com acesso à empresa do projeto
CREATE POLICY "Editors manage presentations"
ON public.project_presentations FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_presentations.project_id
      AND has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_presentations.project_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Visualização interna (membros aprovados com acesso)
CREATE POLICY "Approved users view presentations"
ON public.project_presentations FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_presentations.project_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Acesso público (anônimo) somente quando publicada e liberada
CREATE POLICY "Public view released presentations"
ON public.project_presentations FOR SELECT
TO anon, authenticated
USING (status = 'publicado' AND released = true);

-- 2) Blocos
CREATE TABLE public.presentation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.project_presentations(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentation_blocks_presentation ON public.presentation_blocks(presentation_id);

ALTER TABLE public.presentation_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all blocks"
ON public.presentation_blocks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors manage blocks"
ON public.presentation_blocks FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_blocks.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_blocks.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Approved users view blocks"
ON public.presentation_blocks FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_blocks.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Public view released blocks"
ON public.presentation_blocks FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_presentations pp
    WHERE pp.id = presentation_blocks.presentation_id
      AND pp.status = 'publicado'
      AND pp.released = true
  )
);

-- 3) Posts planejados
CREATE TABLE public.presentation_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.project_presentations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  image_url text,
  title text,
  publish_date date,
  copy text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentation_posts_presentation ON public.presentation_posts(presentation_id);

ALTER TABLE public.presentation_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all posts"
ON public.presentation_posts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors manage posts"
ON public.presentation_posts FOR ALL
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_posts.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_posts.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Approved users view posts"
ON public.presentation_posts FOR SELECT
USING (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.project_presentations pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = presentation_posts.presentation_id
      AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Public view released posts"
ON public.presentation_posts FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_presentations pp
    WHERE pp.id = presentation_posts.presentation_id
      AND pp.status = 'publicado'
      AND pp.released = true
  )
);
