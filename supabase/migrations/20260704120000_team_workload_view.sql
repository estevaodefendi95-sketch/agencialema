-- View: team_workload
-- Aggregated task load per team member, used by the "Equipe" page.
-- The view itself gates access via has_role() instead of relying on RLS on the
-- underlying tables (profiles/tasks), since it deliberately aggregates data
-- across users for admins and editors, who don't otherwise have cross-user
-- SELECT access on public.profiles.
CREATE OR REPLACE VIEW public.team_workload AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.email,
  p.avatar_url,
  COUNT(t.id) FILTER (WHERE t.status NOT IN ('aprovado', 'concluido')) AS tarefas_ativas,
  COUNT(t.id) FILTER (WHERE t.status = 'aprovado') AS tarefas_aprovadas,
  COUNT(t.id) FILTER (
    WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('aprovado', 'concluido')
  ) AS tarefas_atrasadas,
  COUNT(t.id) FILTER (
    WHERE t.priority = 'urgente' AND t.status NOT IN ('aprovado', 'concluido')
  ) AS tarefas_urgentes
FROM public.profiles p
LEFT JOIN public.tasks t ON t.assigned_to = p.id
WHERE p.status = 'aprovado'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
GROUP BY p.id, p.full_name, p.email, p.avatar_url;

GRANT SELECT ON public.team_workload TO authenticated;
