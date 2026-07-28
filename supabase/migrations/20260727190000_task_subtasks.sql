-- Subtarefas: uma tarefa pode referenciar outra como "mãe". Se a mãe for
-- excluída, a subtarefa não some — só perde o vínculo (continua existindo
-- normalmente em todo board/lista).
ALTER TABLE public.tasks ADD COLUMN parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id);
