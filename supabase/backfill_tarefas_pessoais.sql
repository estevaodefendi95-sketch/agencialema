-- Backfill: atribui ao criador as tarefas PESSOAIS já existentes que ficaram
-- sem responsável (assigned_to null) antes da correção da criação.
--
-- "Tarefa pessoal" = project_id IS NULL (tarefas de projeto não são tocadas).
-- Usa created_by como fonte da verdade de quem criou a tarefa.
--
-- NÃO EXECUTAR AUTOMATICAMENTE. Rode manualmente (ex: SQL editor do Supabase)
-- depois de conferir o SELECT de conferência abaixo.

-- 1) Conferência: quantas tarefas pessoais estão sem responsável e têm criador conhecido
select count(*) as tarefas_pessoais_sem_responsavel
from public.tasks
where project_id is null
  and assigned_to is null
  and created_by is not null;

-- 2) Backfill de public.tasks.assigned_to
update public.tasks
set assigned_to = created_by
where project_id is null
  and assigned_to is null
  and created_by is not null;

-- 3) Backfill de public.task_assignees, para o send-task-reminders e a
--    team_workload enxergarem essas tarefas via múltiplos responsáveis também
--    (evita duplicar linha se já existir por algum motivo).
insert into public.task_assignees (task_id, user_id, added_by)
select t.id, t.assigned_to, t.assigned_to
from public.tasks t
where t.project_id is null
  and t.assigned_to is not null
  and not exists (
    select 1 from public.task_assignees ta
    where ta.task_id = t.id and ta.user_id = t.assigned_to
  );
