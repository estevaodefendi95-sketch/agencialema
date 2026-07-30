CREATE TABLE public.portal_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL DEFAULT '',
  title text,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_banners TO authenticated;
GRANT ALL ON public.portal_banners TO service_role;
ALTER TABLE public.portal_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users view active banners" ON public.portal_banners
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) AND active = true);
CREATE POLICY "Admins manage banners" ON public.portal_banners
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_portal_banners_updated_at BEFORE UPDATE ON public.portal_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.portal_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text,
  icon text NOT NULL DEFAULT 'Sparkles',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_services TO authenticated;
GRANT ALL ON public.portal_services TO service_role;
ALTER TABLE public.portal_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users view active services" ON public.portal_services
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) AND active = true);
CREATE POLICY "Admins manage services" ON public.portal_services
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_portal_services_updated_at BEFORE UPDATE ON public.portal_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.presentation_posts
  ADD COLUMN IF NOT EXISTS publish_time time,
  ADD COLUMN IF NOT EXISTS format_type text;