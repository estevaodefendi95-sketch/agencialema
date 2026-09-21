-- Projeto padrão "Geral" por empresa — usado como project_id de fallback
-- quando o usuário cria uma tarefa de projeto sem escolher um projeto
-- específico no NewTaskDialog. Idempotente (pode rodar mais de uma vez).
-- Não mexe em policies — os triggers/funções abaixo rodam como SECURITY
-- DEFINER, igual outros triggers já existentes no projeto.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Só pode haver um projeto padrão por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_company_default
  ON public.projects (company_id)
  WHERE is_default;

-- Backfill: cria o "Geral" pra toda empresa que ainda não tem um projeto
-- padrão. As colunas do Kanban desse projeto são criadas pelo próprio
-- KanbanBoard na primeira vez que alguém abre o board (DEFAULT_COLUMNS).
INSERT INTO public.projects (company_id, name, is_default)
SELECT c.id, 'Geral', true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.company_id = c.id AND p.is_default
);

-- Toda empresa nova já nasce com o projeto "Geral".
CREATE OR REPLACE FUNCTION public.create_default_project_for_company()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (company_id, name, is_default)
  VALUES (NEW.id, 'Geral', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_create_default_project ON public.companies;
CREATE TRIGGER trg_create_default_project
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_default_project_for_company();
