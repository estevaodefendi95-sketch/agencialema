import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as Icons from "lucide-react";
import { Settings, Upload, X, ShieldAlert, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Sparkles } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

const SERVICE_ICONS = [
  "Sparkles", "Megaphone", "Camera", "PenTool", "TrendingUp", "Users",
  "Calendar", "MessageCircle", "Palette", "Target", "BarChart3", "Video",
  "Globe", "Rocket", "Award", "Layers",
];

type PortalBanner = { id: string; image_url: string; title: string | null; link_url: string | null; position: number; active: boolean };
type PortalService = { id: string; title: string; description: string | null; icon: string | null; position: number; active: boolean };

export default function AdminSettings() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [appName, setAppName] = useState("GestãoPro");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loginAppName, setLoginAppName] = useState("GestãoPro");
  const [loginLogoUrl, setLoginLogoUrl] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<"app" | "login" | "banner">("app");

  const [banners, setBanners] = useState<PortalBanner[]>([]);
  const [services, setServices] = useState<PortalService[]>([]);
  const [savingBanners, setSavingBanners] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

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
      const { data: bannersData } = await supabase.from("portal_banners").select("*").order("position");
      setBanners((bannersData || []) as PortalBanner[]);
      const { data: servicesData } = await supabase.from("portal_services").select("*").order("position");
      setServices((servicesData || []) as PortalService[]);
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

  const handleFileSelect = (target: "app" | "login" | "banner") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropTarget(target);
      setCropFile(file);
    }
    e.target.value = "";
  };

  async function addBanner() {
    if (banners.length >= 3) return;
    const { data, error } = await supabase
      .from("portal_banners")
      .insert({ image_url: "", position: banners.length })
      .select()
      .single();
    if (!error && data) setBanners((prev) => [...prev, data as PortalBanner]);
  }

  async function patchBanner(id: string, patch: Partial<PortalBanner>) {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    await supabase.from("portal_banners").update(patch).eq("id", id);
  }

  async function removeBanner(id: string) {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("portal_banners").delete().eq("id", id);
  }

  async function moveBanner(id: string, dir: -1 | 1) {
    const idx = banners.findIndex((b) => b.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= banners.length) return;
    const next = [...banners];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((b, i) => ({ ...b, position: i }));
    setBanners(reordered);
    setSavingBanners(true);
    await Promise.all(reordered.map((b) => supabase.from("portal_banners").update({ position: b.position }).eq("id", b.id)));
    setSavingBanners(false);
  }

  async function addService() {
    const { data, error } = await supabase
      .from("portal_services")
      .insert({ title: "Novo serviço", icon: "Sparkles", position: services.length })
      .select()
      .single();
    if (!error && data) setServices((prev) => [...prev, data as PortalService]);
  }

  async function patchService(id: string, patch: Partial<PortalService>) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from("portal_services").update(patch).eq("id", id);
  }

  async function removeService(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("portal_services").delete().eq("id", id);
  }

  async function moveService(id: string, dir: -1 | 1) {
    const idx = services.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= services.length) return;
    const next = [...services];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((s, i) => ({ ...s, position: i }));
    setServices(reordered);
    setSavingServices(true);
    await Promise.all(reordered.map((s) => supabase.from("portal_services").update({ position: s.position }).eq("id", s.id)));
    setSavingServices(false);
  }

  const [bannerDraftId, setBannerDraftId] = useState<string | null>(null);

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

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Banners do Portal do Cliente</CardTitle>
          <CardDescription>
            Até 3 banners em carrossel, exibidos no topo da home de todos os clientes ({"/portal"}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {banners.map((b, i) => (
            <div key={b.id} className="flex gap-3 border rounded-lg p-3">
              <div className="shrink-0">
                {b.image_url ? (
                  <div className="relative">
                    <img src={b.image_url} alt="" className="h-20 w-36 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => {
                        setBannerDraftId(b.id);
                        setCropTarget("banner");
                        document.getElementById(`banner-file-${b.id}`)?.click();
                      }}
                      className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs rounded"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <label className="h-20 w-36 rounded border border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground text-xs">
                    <ImageIcon className="h-5 w-5" />
                    Enviar imagem
                  </label>
                )}
                <input
                  id={`banner-file-${b.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setBannerDraftId(b.id);
                    handleFileSelect("banner")(e);
                  }}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Título (opcional, aparece sobre a imagem)"
                  value={b.title || ""}
                  onChange={(e) => patchBanner(b.id, { title: e.target.value })}
                />
                <Input
                  placeholder="Link ao clicar (opcional)"
                  value={b.link_url || ""}
                  onChange={(e) => patchBanner(b.id, { link_url: e.target.value })}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={b.active} onCheckedChange={(v) => patchBanner(b.id, { active: v })} />
                    <span className="text-sm text-muted-foreground">Ativo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={i === 0 || savingBanners} onClick={() => moveBanner(b.id, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={i === banners.length - 1 || savingBanners} onClick={() => moveBanner(b.id, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeBanner(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-2" onClick={addBanner} disabled={banners.length >= 3}>
            <Plus className="h-4 w-4" /> Adicionar banner {banners.length >= 3 && "(máximo 3)"}
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Serviços da Lema</CardTitle>
          <CardDescription>Lista de serviços exibida na home do portal — a mesma para todos os clientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.map((s, i) => {
            const Icon = (Icons as any)[s.icon || "Sparkles"] || Sparkles;
            return (
              <div key={s.id} className="flex gap-3 border rounded-lg p-3">
                <div className="shrink-0">
                  <Select value={s.icon || "Sparkles"} onValueChange={(v) => patchService(s.id, { icon: v })}>
                    <SelectTrigger className="w-14 h-14 p-0 items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_ICONS.map((name) => {
                        const OptIcon = (Icons as any)[name];
                        return (
                          <SelectItem key={name} value={name}>
                            <span className="flex items-center gap-2">
                              <OptIcon className="h-4 w-4" /> {name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Título do serviço"
                    value={s.title}
                    onChange={(e) => patchService(s.id, { title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Descrição (opcional)"
                    rows={2}
                    value={s.description || ""}
                    onChange={(e) => patchService(s.id, { description: e.target.value })}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={s.active} onCheckedChange={(v) => patchService(s.id, { active: v })} />
                      <span className="text-sm text-muted-foreground">Ativo</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" disabled={i === 0 || savingServices} onClick={() => moveService(s.id, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={i === services.length - 1 || savingServices} onClick={() => moveService(s.id, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeService(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" className="gap-2" onClick={addService}>
            <Plus className="h-4 w-4" /> Adicionar serviço
          </Button>
        </CardContent>
      </Card>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          open={!!cropFile}
          onClose={() => setCropFile(null)}
          onCropped={(url) => {
            if (cropTarget === "login") setLoginLogoUrl(url);
            else if (cropTarget === "banner" && bannerDraftId) patchBanner(bannerDraftId, { image_url: url });
            else setLogoUrl(url);
          }}
          circular={cropTarget !== "banner"}
          aspect={cropTarget === "banner" ? 21 / 9 : 1}
          uploadPath={cropTarget === "banner" ? `portal/banners/${Date.now()}.png` : `logos/${cropTarget}-logo-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
