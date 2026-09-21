-- Ordem manual das tarefas dentro de um dia no Calendário/Minhas Tarefas
-- (drag-and-drop). Não reaproveita `position`, que é a ordem das colunas do
-- Kanban — são conceitos independentes. Sem mudança de policies.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS day_order integer;
