
-- DELETE policy for tasks: editors can delete
CREATE POLICY "Editors can delete tasks"
ON public.tasks
FOR DELETE
TO public
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- DELETE policy for task_media: editors can delete
CREATE POLICY "Editors can delete media"
ON public.task_media
FOR DELETE
TO public
USING (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_media.task_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- DELETE policy for task_comments: author can delete own
CREATE POLICY "Authors can delete own comments"
ON public.task_comments
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- UPDATE policy for task_comments: author can update own
CREATE POLICY "Authors can update own comments"
ON public.task_comments
FOR UPDATE
TO public
USING (auth.uid() = user_id);

-- INSERT policy for task_history: editors can insert
CREATE POLICY "Editors can insert history"
ON public.task_history
FOR INSERT
TO public
WITH CHECK (
  is_approved(auth.uid())
  AND has_role(auth.uid(), 'editor'::app_role)
  AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_history.task_id AND has_company_access(auth.uid(), p.company_id)
  )
);

-- Clients can also insert history for tasks they access
CREATE POLICY "Clients can insert history"
ON public.task_history
FOR INSERT
TO public
WITH CHECK (
  is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_history.task_id AND has_company_access(auth.uid(), p.company_id)
  )
);
