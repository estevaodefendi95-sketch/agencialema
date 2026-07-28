REVOKE EXECUTE ON FUNCTION public.generate_recurring_task_instances() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_due_task_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM PUBLIC, anon;