import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AppSettings {
  app_name: string;
  logo_url: string | null;
  login_logo_url: string | null;
  login_app_name: string;
}

export function useAppSettings() {
  const { agencyId } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({
    app_name: "GestãoPro",
    logo_url: null,
    login_logo_url: null,
    login_app_name: "GestãoPro",
  });

  const load = async () => {
    // If user belongs to an agency, use agency branding for sidebar
    if (agencyId) {
      const { data: agency } = await supabase
        .from("agencies")
        .select("app_name, logo_url")
        .eq("id", agencyId)
        .single();
      if (agency) {
        setSettings(prev => ({
          ...prev,
          app_name: agency.app_name,
          logo_url: agency.logo_url,
        }));
      }
    }

    // Always load global settings for login page customization
    const { data } = await supabase
      .from("app_settings")
      .select("app_name, logo_url, login_logo_url, login_app_name")
      .limit(1)
      .single();
    
    if (data) {
      if (!agencyId) {
        // No agency — use global settings
        setSettings(data);
      } else {
        // Has agency — only use login settings from global
        setSettings(prev => ({
          ...prev,
          login_logo_url: data.login_logo_url,
          login_app_name: data.login_app_name,
        }));
      }
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("app-settings-changed", handler);
    return () => window.removeEventListener("app-settings-changed", handler);
  }, [agencyId]);

  return settings;
}
