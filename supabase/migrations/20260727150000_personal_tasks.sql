-- Tarefas pessoais: sem projeto/empresa, visíveis só para quem criou.
ALTER TABLE public.tasks ALTER COLUMN project_id DROP NOT NULL;

CREATE POLICY "Users manage own personal tasks" ON public.tasks FOR ALL
USING (public.is_approved(auth.uid()) AND project_id IS NULL AND created_by = auth.uid())
WITH CHECK (public.is_approved(auth.uid()) AND project_id IS NULL AND created_by = auth.uid());
