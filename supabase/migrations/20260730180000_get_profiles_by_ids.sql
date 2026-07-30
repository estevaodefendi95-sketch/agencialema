-- Permite que qualquer usuário autenticado (incluindo clientes) resolva
-- nome/avatar de responsáveis por tarefa, sem expor a tabela profiles
-- inteira (que é restrita). Usado no Calendário e em Tarefas do portal
-- do cliente, pra mostrar a foto de quem está responsável.
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, full_name text, nickname text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.nickname, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids) AND p.status = 'aprovado'
$$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_by_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids(uuid[]) TO authenticated;
