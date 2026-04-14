import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Upload, X } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

export default function AdminSettings() {
  const { toast } = useToast();
  const [appName, setAppName] = useState("GestãoPro");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).single();
      if (data) {
        setSettingsId(data.id);
        setAppName(data.app_name);
        setLogoUrl(data.logo_url);
      }
    };
    load();
  }, []);

  const save = async () => {
    if (!settingsId) return;
    await supabase.from("app_settings").update({ app_name: appName, logo_url: logoUrl }).eq("id", settingsId);
    toast({ title: "Configurações salvas" });
    window.dispatchEvent(new Event("app-settings-changed"));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" /> Configurações
      </h2>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Personalização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Aplicação</Label>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Nome exibido no sistema" />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-cover rounded-full border-2 border-border shadow-sm" />
                <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                  <X className="h-4 w-4" /> Remover
                </Button>
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Fazer upload da logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              </div>
            )}
          </div>

          <Button onClick={save} className="w-full">Salvar Configurações</Button>
        </CardContent>
      </Card>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          open={!!cropFile}
          onClose={() => setCropFile(null)}
          onCropped={(url) => setLogoUrl(url)}
          circular
          uploadPath={`logos/app-logo-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
