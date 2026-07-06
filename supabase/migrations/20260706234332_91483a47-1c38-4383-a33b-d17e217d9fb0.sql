
-- 1) profiles: impedir usuário de alterar o próprio status
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- 2) project_history / task_history: forçar user_id = auth.uid() no INSERT
DROP POLICY IF EXISTS "Users insert project history" ON public.project_history;
CREATE POLICY "Users insert project history" ON public.project_history
  FOR INSERT
  WITH CHECK (
    is_approved(auth.uid())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_history.project_id
        AND has_company_access(auth.uid(), p.company_id)
    )
  );

DROP POLICY IF EXISTS "Users insert task history" ON public.task_history;
CREATE POLICY "Users insert task history" ON public.task_history
  FOR INSERT
  WITH CHECK (
    is_approved(auth.uid())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_history.task_id
        AND has_company_access(auth.uid(), p.company_id)
    )
  );

-- 3) View team_workload: usar security_invoker
ALTER VIEW public.team_workload SET (security_invoker = true);

-- 4) Revogar EXECUTE de funções SECURITY DEFINER que não devem ser chamadas
--    diretamente pela API (triggers e RPC não usadas).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_pending_project_invites() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_presentation_published() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_approved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_pending_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_presentation_post(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Helpers usadas em políticas RLS: manter apenas para authenticated
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) FROM PUBLIC, anon;
