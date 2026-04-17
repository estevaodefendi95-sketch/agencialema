
-- Convert agency_admin role to admin
UPDATE public.user_roles SET role = 'admin' WHERE role = 'agency_admin';

-- Drop ALL policies on affected tables (including app_settings and agencies)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'agencies','app_settings','companies','projects','tasks','project_columns','project_members',
        'project_history','task_attachments','task_checklists','task_comments',
        'task_history','task_media','notifications','user_roles','user_company_access','profiles'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- Drop functions tied to agency model
DROP FUNCTION IF EXISTS public.get_user_agency_id(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin();

-- Drop columns and table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS agency_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS agency_id;
DROP TABLE IF EXISTS public.agencies CASCADE;

-- app_settings: anyone can read, admins manage
CREATE POLICY "Anyone can view settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_company_access
CREATE POLICY "Users view own access" ON public.user_company_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all access" ON public.user_company_access FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- companies
CREATE POLICY "Admins manage all companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view their companies" ON public.companies FOR SELECT USING (public.is_approved(auth.uid()) AND public.has_company_access(auth.uid(), id));

-- projects
CREATE POLICY "Admins manage all projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors manage their projects" ON public.projects FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND public.has_company_access(auth.uid(), company_id)) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND public.has_company_access(auth.uid(), company_id));
CREATE POLICY "Users view their projects" ON public.projects FOR SELECT USING (public.is_approved(auth.uid()) AND public.has_company_access(auth.uid(), company_id));

-- tasks
CREATE POLICY "Admins manage all tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors manage tasks" ON public.tasks FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND public.has_company_access(auth.uid(), p.company_id))) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users view their tasks" ON public.tasks FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users update their tasks" ON public.tasks FOR UPDATE USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND public.has_company_access(auth.uid(), p.company_id)));

-- project_columns
CREATE POLICY "Admins manage all columns" ON public.project_columns FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors manage columns" ON public.project_columns FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_columns.project_id AND public.has_company_access(auth.uid(), p.company_id))) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_columns.project_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users view columns" ON public.project_columns FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_columns.project_id AND public.has_company_access(auth.uid(), p.company_id)));

-- project_members
CREATE POLICY "Admins manage all members" ON public.project_members FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors manage members" ON public.project_members FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND public.has_company_access(auth.uid(), p.company_id))) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users view project members" ON public.project_members FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND public.has_company_access(auth.uid(), p.company_id)));

-- project_history
CREATE POLICY "Admins manage all project history" ON public.project_history FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view project history" ON public.project_history FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_history.project_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users insert project history" ON public.project_history FOR INSERT WITH CHECK (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_history.project_id AND public.has_company_access(auth.uid(), p.company_id)));

-- task_attachments
CREATE POLICY "Admins manage all attachments" ON public.task_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view attachments" ON public.task_attachments FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Editors manage attachments" ON public.task_attachments FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND public.has_company_access(auth.uid(), p.company_id))) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND public.has_company_access(auth.uid(), p.company_id)));

-- task_checklists
CREATE POLICY "Admins manage all checklists" ON public.task_checklists FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view checklists" ON public.task_checklists FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_checklists.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Editors manage checklists" ON public.task_checklists FOR ALL USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_checklists.task_id AND public.has_company_access(auth.uid(), p.company_id))) WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_checklists.task_id AND public.has_company_access(auth.uid(), p.company_id)));

-- task_comments
CREATE POLICY "Admins manage all comments" ON public.task_comments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view comments" ON public.task_comments FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users insert comments" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Authors update own comments" ON public.task_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authors delete own comments" ON public.task_comments FOR DELETE USING (auth.uid() = user_id);

-- task_history
CREATE POLICY "Admins manage all history" ON public.task_history FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view task history" ON public.task_history FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_history.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users insert task history" ON public.task_history FOR INSERT WITH CHECK (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_history.task_id AND public.has_company_access(auth.uid(), p.company_id)));

-- task_media
CREATE POLICY "Admins manage all media" ON public.task_media FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view media" ON public.task_media FOR SELECT USING (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_media.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Users insert media" ON public.task_media FOR INSERT WITH CHECK (public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_media.task_id AND public.has_company_access(auth.uid(), p.company_id)));
CREATE POLICY "Editors delete media" ON public.task_media FOR DELETE USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(), 'editor') AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_media.task_id AND public.has_company_access(auth.uid(), p.company_id)));

-- notifications
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins insert notifications" ON public.notifications FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
