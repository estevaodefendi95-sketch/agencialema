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

CREATE OR REPLACE FUNCTION public.prevent_delete_default_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN
    RAISE EXCEPTION 'O projeto "Geral" da empresa não pode ser excluído';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_default_project ON public.projects;

CREATE TRIGGER trg_prevent_delete_default_project
BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_default_project();

INSERT INTO public.projects (company_id, name, is_default)
SELECT c.id, 'Geral', true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.company_id = c.id AND p.is_default
);