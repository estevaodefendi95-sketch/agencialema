-- Registro no repositório (já aplicado direto no banco pelo Lovable) das duas
-- funções que geram notificações com link de tarefa — agora incluindo
-- ?task=<id> no link, pra abrir a tarefa automaticamente ao clicar na
-- notificação (feat/deep-link-tarefa).
CREATE OR REPLACE FUNCTION public.send_due_task_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT id, title, project_id, assigned_to, created_by, due_date, due_time, reminder_minutes_before
    FROM public.tasks
    WHERE due_date IS NOT NULL AND due_time IS NOT NULL AND reminder_minutes_before IS NOT NULL
      AND reminder_sent_at IS NULL
      AND ((due_date + due_time) AT TIME ZONE 'America/Sao_Paulo') - (reminder_minutes_before || ' minutes')::interval <= now()
      AND ((due_date + due_time) AT TIME ZONE 'America/Sao_Paulo') > now()
  LOOP
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      COALESCE(t.assigned_to, t.created_by),
      'Lembrete: ' || t.title,
      'Vence em breve (' || to_char(t.due_time, 'HH24:MI') || ')',
      CASE WHEN t.project_id IS NOT NULL THEN '/projetos/' || t.project_id || '?task=' || t.id ELSE '/minhas-tarefas?task=' || t.id END
    );
    UPDATE public.tasks SET reminder_sent_at = now() WHERE id = t.id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project_name text;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      NEW.assigned_to,
      'Nova tarefa atribuída a você',
      NEW.title || COALESCE(' — ' || _project_name, ''),
      CASE WHEN NEW.project_id IS NOT NULL THEN '/projetos/' || NEW.project_id || '?task=' || NEW.id ELSE '/minhas-tarefas?task=' || NEW.id END
    );
  END IF;
  RETURN NEW;
END;
$function$;
