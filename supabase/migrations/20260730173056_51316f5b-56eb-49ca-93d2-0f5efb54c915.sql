-- 1. get_admin_profiles: no anonymous access
REVOKE EXECUTE ON FUNCTION public.get_admin_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_profiles() TO authenticated;

-- 2. tasks UPDATE policies need WITH CHECK mirroring USING
DROP POLICY IF EXISTS "Users update their tasks" ON public.tasks;
CREATE POLICY "Users update their tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id AND has_company_access(auth.uid(), p.company_id)
  )
);

DROP POLICY IF EXISTS "Non-viewers update their tasks" ON public.tasks;
CREATE POLICY "Non-viewers update their tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  is_approved(auth.uid())
  AND NOT has_role(auth.uid(), 'visualizador'::app_role)
  AND (project_id IS NULL OR has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  is_approved(auth.uid())
  AND NOT has_role(auth.uid(), 'visualizador'::app_role)
  AND (project_id IS NULL OR has_project_access(auth.uid(), project_id))
);

-- 3. Hard guard against self status escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_status_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar o status do usuário';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_status_self_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_profile_status_self_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_status_self_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_status_self_change();

-- 4. Strip internal client feedback from publicly readable presentation snapshots
CREATE OR REPLACE FUNCTION public.sanitize_presentation_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _posts jsonb;
BEGIN
  IF NEW.snapshot IS NOT NULL AND jsonb_typeof(NEW.snapshot->'posts') = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(elem - 'client_status' - 'client_comment' - 'client_responded_at'),
      '[]'::jsonb
    )
    INTO _posts
    FROM jsonb_array_elements(NEW.snapshot->'posts') elem;
    NEW.snapshot := jsonb_set(NEW.snapshot, '{posts}', _posts);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sanitize_presentation_snapshot() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sanitize_presentation_snapshot ON public.presentation_versions;
CREATE TRIGGER trg_sanitize_presentation_snapshot
BEFORE INSERT OR UPDATE ON public.presentation_versions
FOR EACH ROW EXECUTE FUNCTION public.sanitize_presentation_snapshot();

UPDATE public.presentation_versions
SET snapshot = snapshot
WHERE jsonb_typeof(snapshot->'posts') = 'array';