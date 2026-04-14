
-- Add login customization columns to app_settings
ALTER TABLE public.app_settings
ADD COLUMN login_logo_url text,
ADD COLUMN login_app_name text NOT NULL DEFAULT 'GestãoPro';

-- Allow anonymous users to read app_settings (for login page)
CREATE POLICY "Anon can view settings"
ON public.app_settings
FOR SELECT
TO anon
USING (true);
