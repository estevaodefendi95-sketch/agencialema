
-- 1. Create app_settings table (singleton)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text NOT NULL DEFAULT 'GestãoPro',
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (app_name) VALUES ('GestãoPro');

CREATE POLICY "Anyone authenticated can view settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage settings"
ON public.app_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create task_media table
CREATE TABLE public.task_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage media"
ON public.task_media FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users with access can view media"
ON public.task_media FOR SELECT USING (
  is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_media.task_id AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Users with access can insert media"
ON public.task_media FOR INSERT WITH CHECK (
  is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_media.task_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- 3. Make attachments bucket public
UPDATE storage.buckets SET public = true WHERE id = 'attachments';

-- 4. Storage policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT USING (bucket_id = 'attachments');

-- 5. RLS for editors and viewers
CREATE POLICY "Editors can view their projects"
ON public.projects FOR SELECT USING (
  is_approved(auth.uid()) 
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Editors can view their companies"
ON public.companies FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND has_company_access(auth.uid(), id)
);

CREATE POLICY "Editors can view tasks"
ON public.tasks FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can insert tasks"
ON public.tasks FOR INSERT WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can update tasks"
ON public.tasks FOR UPDATE USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can insert comments"
ON public.task_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can view comments"
ON public.task_comments FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can manage checklists"
ON public.task_checklists FOR ALL USING (
  is_approved(auth.uid()) AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_checklists.task_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors and viewers can view checklists"
ON public.task_checklists FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_checklists.task_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can view history"
ON public.task_history FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_history.task_id AND has_company_access(auth.uid(), p.company_id))
);

CREATE POLICY "Editors can view attachments"
ON public.task_attachments FOR SELECT USING (
  is_approved(auth.uid())
  AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role))
  AND EXISTS (SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND has_company_access(auth.uid(), p.company_id))
);
