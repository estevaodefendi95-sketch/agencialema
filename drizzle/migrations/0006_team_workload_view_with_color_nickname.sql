DROP VIEW IF EXISTS public.team_workload;

CREATE VIEW public.team_workload WITH (security_invoker = true) AS

SELECT
  p.id AS user_id,
  p.full_name,
  p.nickname,
  p.email,
  p.avatar_url,
  p.color,
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

GROUP BY p.id, p.full_name, p.nickname, p.email, p.avatar_url, p.color;

GRANT SELECT ON public.team_workload TO authenticated;