-- Recorrência de tarefas pessoais: sem repetição, diária, semanal (com dias
-- da semana específicos) ou mensal (repete no mesmo dia do mês do prazo).
ALTER TABLE public.tasks ADD COLUMN recurrence_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.tasks ADD COLUMN recurrence_days SMALLINT[];
