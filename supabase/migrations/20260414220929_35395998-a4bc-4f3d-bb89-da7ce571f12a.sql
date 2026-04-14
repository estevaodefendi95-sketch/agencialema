
-- 1. Create agencies table
CREATE TABLE public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  app_name text NOT NULL DEFAULT 'GestãoPro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add agency_id to profiles and companies
ALTER TABLE public.profiles ADD COLUMN agency_id uuid REFERENCES public.agencies(id);
ALTER TABLE public.companies ADD COLUMN agency_id uuid REFERENCES public.agencies(id);

-- 3. Create helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() ->> 'email') = 'estevaodefendi95@gmail.com', false)
$$;

CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- 4. RLS for agencies table
CREATE POLICY "Super admin can manage agencies"
  ON public.agencies FOR ALL USING (public.is_super_admin());

CREATE POLICY "Users can view own agency"
  ON public.agencies FOR SELECT
  USING (id = public.get_user_agency_id(auth.uid()));

-- 5. Update companies RLS
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Clients can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Editors can view their companies" ON public.companies;

CREATE POLICY "Super admin can manage all companies"
  ON public.companies FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency companies"
  ON public.companies FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND agency_id = public.get_user_agency_id(auth.uid())
  );

CREATE POLICY "Users can view their companies"
  ON public.companies FOR SELECT
  USING (public.is_approved(auth.uid()) AND public.has_company_access(auth.uid(), id));

-- 6. Update profiles RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admin can view all profiles"
  ON public.profiles FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Agency admin can view agency profiles"
  ON public.profiles FOR SELECT
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND agency_id = public.get_user_agency_id(auth.uid())
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Super admin can update any profile"
  ON public.profiles FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "Agency admin can update agency profiles"
  ON public.profiles FOR UPDATE
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND agency_id = public.get_user_agency_id(auth.uid())
  );

-- 7. Update user_roles RLS
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Super admin can manage all roles"
  ON public.user_roles FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can view agency roles"
  ON public.user_roles FOR SELECT
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

CREATE POLICY "Agency admin can insert agency roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

CREATE POLICY "Agency admin can update agency roles"
  ON public.user_roles FOR UPDATE
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

CREATE POLICY "Agency admin can delete agency roles"
  ON public.user_roles FOR DELETE
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

-- 8. Update user_company_access RLS
DROP POLICY IF EXISTS "Admins can manage access" ON public.user_company_access;

CREATE POLICY "Super admin can manage all access"
  ON public.user_company_access FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency access"
  ON public.user_company_access FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

-- 9. Update tasks RLS
DROP POLICY IF EXISTS "Admins can manage tasks" ON public.tasks;

CREATE POLICY "Super admin can manage all tasks"
  ON public.tasks FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency tasks"
  ON public.tasks FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN companies c ON c.id = p.company_id
      WHERE p.id = tasks.project_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 10. Update projects RLS
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

CREATE POLICY "Super admin can manage all projects"
  ON public.projects FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency projects"
  ON public.projects FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = projects.company_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 11. Update notifications RLS
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

CREATE POLICY "Super admin can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Agency admin can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND public.get_user_agency_id(user_id) = public.get_user_agency_id(auth.uid())
  );

-- 12. Update task_attachments RLS
DROP POLICY IF EXISTS "Admins can manage attachments" ON public.task_attachments;

CREATE POLICY "Super admin can manage all attachments"
  ON public.task_attachments FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency attachments"
  ON public.task_attachments FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN companies c ON c.id = p.company_id
      WHERE t.id = task_attachments.task_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 13. Update task_checklists RLS
DROP POLICY IF EXISTS "Admins can manage checklists" ON public.task_checklists;

CREATE POLICY "Super admin can manage all checklists"
  ON public.task_checklists FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency checklists"
  ON public.task_checklists FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN companies c ON c.id = p.company_id
      WHERE t.id = task_checklists.task_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 14. Update task_comments RLS
DROP POLICY IF EXISTS "Admins can manage comments" ON public.task_comments;

CREATE POLICY "Super admin can manage all comments"
  ON public.task_comments FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency comments"
  ON public.task_comments FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN companies c ON c.id = p.company_id
      WHERE t.id = task_comments.task_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 15. Update task_history RLS
DROP POLICY IF EXISTS "Admins can manage history" ON public.task_history;

CREATE POLICY "Super admin can manage all history"
  ON public.task_history FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency history"
  ON public.task_history FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN companies c ON c.id = p.company_id
      WHERE t.id = task_history.task_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 16. Update task_media RLS
DROP POLICY IF EXISTS "Admins can manage media" ON public.task_media;

CREATE POLICY "Super admin can manage all media"
  ON public.task_media FOR ALL USING (public.is_super_admin());

CREATE POLICY "Agency admin can manage agency media"
  ON public.task_media FOR ALL
  USING (
    (public.has_role(auth.uid(), 'agency_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN companies c ON c.id = p.company_id
      WHERE t.id = task_media.task_id
      AND c.agency_id = public.get_user_agency_id(auth.uid())
    )
  );

-- 17. Update app_settings RLS
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;

CREATE POLICY "Super admin can manage settings"
  ON public.app_settings FOR ALL USING (public.is_super_admin());
