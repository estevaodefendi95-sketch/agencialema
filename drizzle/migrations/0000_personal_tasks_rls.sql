-- Tarefas pessoais (project_id IS NULL) só podem ser vistas/alteradas por quem as criou, inclusive por administradores.

DROP POLICY IF EXISTS "Admins manage all tasks" ON public.tasks;

CREATE POLICY "Admins manage all tasks" ON public.tasks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND project_id IS NOT NULL)
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND project_id IS NOT NULL);

DROP POLICY IF EXISTS "Non-viewers update their tasks" ON public.tasks;

CREATE POLICY "Non-viewers update their tasks" ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.is_approved(auth.uid())
  AND NOT public.has_role(auth.uid(), 'visualizador'::public.app_role)
  AND (
    (project_id IS NULL AND created_by = auth.uid())
    OR (project_id IS NOT NULL AND public.has_project_access(auth.uid(), project_id))
  )
)
WITH CHECK (
  public.is_approved(auth.uid())
  AND NOT public.has_role(auth.uid(), 'visualizador'::public.app_role)
  AND (
    (project_id IS NULL AND created_by = auth.uid())
    OR (project_id IS NOT NULL AND public.has_project_access(auth.uid(), project_id))
  )
);

DROP POLICY IF EXISTS "Admins manage all comments" ON public.task_comments;

CREATE POLICY "Admins manage all comments" ON public.task_comments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id));

DROP POLICY IF EXISTS "Admins manage all checklists" ON public.task_checklists;

CREATE POLICY "Admins manage all checklists" ON public.task_checklists
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_checklists.task_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_checklists.task_id));

DROP POLICY IF EXISTS "Admins manage all attachments" ON public.task_attachments;

CREATE POLICY "Admins manage all attachments" ON public.task_attachments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id));

DROP POLICY IF EXISTS "Admins manage all history" ON public.task_history;

CREATE POLICY "Admins manage all history" ON public.task_history
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id));

DROP POLICY IF EXISTS "Admins manage all media" ON public.task_media;

CREATE POLICY "Admins manage all media" ON public.task_media
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_media.task_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
       AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_media.task_id));