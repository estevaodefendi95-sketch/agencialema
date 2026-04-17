-- 1. Make user_id nullable to support pending invites
ALTER TABLE public.project_members ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add invitation status columns
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now();

-- 3. Index to speed up claim lookups
CREATE INDEX IF NOT EXISTS idx_project_members_invited_email
  ON public.project_members (lower(invited_email))
  WHERE invited_email IS NOT NULL;

-- 4. Function to claim pending invites when a user gains access to a company
CREATE OR REPLACE FUNCTION public.claim_pending_project_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id = NEW.user_id;
  IF _email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.project_members pm
  SET user_id = NEW.user_id,
      status = 'ativo',
      invited_email = NULL
  FROM public.projects p
  WHERE pm.project_id = p.id
    AND p.company_id = NEW.company_id
    AND pm.status = 'pendente'
    AND lower(pm.invited_email) = lower(_email);

  RETURN NEW;
END;
$$;

-- 5. Trigger on user_company_access
DROP TRIGGER IF EXISTS trg_claim_pending_invites ON public.user_company_access;
CREATE TRIGGER trg_claim_pending_invites
AFTER INSERT ON public.user_company_access
FOR EACH ROW
EXECUTE FUNCTION public.claim_pending_project_invites();