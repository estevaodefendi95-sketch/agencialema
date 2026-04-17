import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Upload, X, ShieldAlert } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

export default function AdminSettings() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [appName, setAppName] = useState("GestãoPro");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loginAppName, setLoginAppName] = useState("GestãoPro");
  const [loginLogoUrl, setLoginLogoUrl] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<"app" | "login">("app");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).single();
      if (data) {
        setSettingsId(data.id);
        setAppName(data.app_name);
        setLogoUrl(data.logo_url);
        setLoginAppName(data.login_app_name);
        setLoginLogoUrl(data.login_logo_url);
      }
    };
    if (isAdmin) load();
  }, [isAdmin]);

  const saveGlobal = async () => {
    if (!settingsId) return;
    await supabase.from("app_settings").update({
      app_name: appName,
      logo_url: logoUrl,
      login_app_name: loginAppName,
      login_logo_url: loginLogoUrl,
    }).eq("id", settingsId);
    toast({ title: "Configurações salvas" });
    window.dispatchEvent(new Event("app-settings-changed"));
  };

  const handleFileSelect = (target: "app" | "login") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropTarget(target);
      setCropFile(file);
    }
    e.target.value = "";
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <ShieldAlert className="h-12 w-12" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Você não tem permissão para acessar as configurações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" /> Configurações
      </h2>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Personalização do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Aplicação</Label>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Nome exibido no sistema" />
          </div>
          <div className="space-y-2">
            <Label>Logo do Sistema</Label>
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-cover rounded-full border-2 border-border shadow-sm" />
                <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                  <X className="h-4 w-4" /> Remover
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" />
                Fazer upload da logo
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect("app")} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Personalização da Tela de Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome exibido no Login</Label>
            <Input value={loginAppName} onChange={(e) => setLoginAppName(e.target.value)} placeholder="Nome exibido na tela de login" />
          </div>
          <div className="space-y-2">
            <Label>Logo do Login</Label>
            {loginLogoUrl ? (
              <div className="flex items-center gap-3">
                <img src={loginLogoUrl} alt="Logo Login" className="h-16 w-16 object-cover rounded-full border-2 border-border shadow-sm" />
                <Button variant="ghost" size="sm" onClick={() => setLoginLogoUrl(null)}>
                  <X className="h-4 w-4" /> Remover
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" />
                Fazer upload da logo do login
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect("login")} />
              </label>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
            {loginLogoUrl ? (
              <img src={loginLogoUrl} alt="Preview" className="h-12 w-12 object-cover rounded-full mx-auto" />
            ) : (
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <Settings className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
            <p className="text-lg font-semibold">{loginAppName || "GestãoPro"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="max-w-lg">
        <Button onClick={saveGlobal} className="w-full">Salvar Configurações</Button>
      </div>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          open={!!cropFile}
          onClose={() => setCropFile(null)}
          onCropped={(url) => {
            if (cropTarget === "login") setLoginLogoUrl(url);
            else setLogoUrl(url);
          }}
          circular
          uploadPath={`logos/${cropTarget}-logo-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
