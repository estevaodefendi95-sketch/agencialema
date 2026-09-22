CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View task_assignees for visible tasks" ON public.task_assignees;
CREATE POLICY "View task_assignees for visible tasks" ON public.task_assignees FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id));

DROP POLICY IF EXISTS "Manage task_assignees for editable tasks" ON public.task_assignees;
CREATE POLICY "Manage task_assignees for editable tasks" ON public.task_assignees FOR ALL
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id));

NOTIFY pgrst, 'reload schema';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;