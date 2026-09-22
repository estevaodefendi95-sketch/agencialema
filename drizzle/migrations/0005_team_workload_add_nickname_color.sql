DROP VIEW IF EXISTS public.team_workload;

CREATE VIEW public.team_workload WITH (security_invoker = true) AS
SELECT p.id AS user_id,
    p.full_name,
    p.nickname,
    p.email,
    p.avatar_url,
    p.color,
    count(t.id) FILTER (WHERE t.status <> ALL (ARRAY['aprovado'::text, 'concluido'::text])) AS tarefas_ativas,
    count(t.id) FILTER (WHERE t.status = 'aprovado'::text) AS tarefas_aprovadas,
    count(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND (t.status <> ALL (ARRAY['aprovado'::text, 'concluido'::text]))) AS tarefas_atrasadas,
    count(t.id) FILTER (WHERE t.priority = 'urgente'::task_priority AND (t.status <> ALL (ARRAY['aprovado'::text, 'concluido'::text]))) AS tarefas_urgentes
   FROM profiles p
     LEFT JOIN tasks t ON t.assigned_to = p.id
  WHERE p.status = 'aprovado'::user_status AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
  GROUP BY p.id, p.full_name, p.nickname, p.email, p.avatar_url, p.color;

GRANT SELECT ON public.team_workload TO authenticated;