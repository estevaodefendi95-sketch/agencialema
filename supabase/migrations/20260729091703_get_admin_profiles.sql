-- Perfis de admins aprovados, pra listar na aba "Equipe do Projeto" (admins
-- tem acesso universal a qualquer empresa, sem precisar de linha em
-- user_company_access) — SECURITY DEFINER porque a RLS de user_roles só
-- deixa cada usuário ver a própria role, não a de terceiros.
CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS TABLE (id UUID, full_name TEXT, nickname TEXT, email TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.nickname, p.email, p.avatar_url
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'admin' AND p.status = 'aprovado'
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_profiles() TO authenticated;
