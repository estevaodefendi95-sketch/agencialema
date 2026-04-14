import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  app_name: string;
  logo_url: string | null;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({ app_name: "GestãoPro", logo_url: null });

  const load = async () => {
    const { data } = await supabase.from("app_settings").select("app_name, logo_url").limit(1).single();
    if (data) setSettings(data);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("app-settings-changed", handler);
    return () => window.removeEventListener("app-settings-changed", handler);
  }, []);

  return settings;
}
