import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Save, Camera, Trash2, Bell, BellRing } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
import { getExistingPushSubscription, getPushSupportState, subscribeToPush, type PushSupportState } from "@/lib/webPush";

// Fallback embutido: o app publicado no Lovable não recebe VITE_VAPID_PUBLIC_KEY
// (variável de build não configurável lá), então a chave pública (não é segredo)
// também fica hardcoded aqui.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BPs09Vddl5ICjJLyE3VIUc-co275nRY5OXYSzGF36719ETFjkjZtVtB9OEi1eD5OBZFVBIyMESaubE4wAkfKr9I";
// Placeholder ainda não preenchido não conta como configurado.
const VAPID_KEY_CONFIGURED = !!VAPID_PUBLIC_KEY && !VAPID_PUBLIC_KEY.startsWith("<");

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushState, setPushState] = useState<PushSupportState>("unsupported");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, nickname, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setNickname((data as any).nickname || "");
        setEmail(data.email || "");
        setAvatarUrl((data as any).avatar_url || null);
      }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      const state = getPushSupportState();
      if (state !== "idle") { setPushState(state); return; }
      const existing = await getExistingPushSubscription();
      setPushState(existing ? "active" : "idle");
    })();
  }, []);

  const activatePush = async () => {
    if (!user || !VAPID_KEY_CONFIGURED) return;
    setPushLoading(true);
    try {
      const subscription = await subscribeToPush(VAPID_PUBLIC_KEY);
      const json = subscription.toJSON();
      const { error } = await (supabase.from as any)("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setPushState("active");
      toast({ title: "Notificações ativadas" });
    } catch (err: any) {
      setPushState(getPushSupportState());
      toast({ title: "Não foi possível ativar as notificações", description: err.message, variant: "destructive" });
    } finally {
      setPushLoading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        nickname: nickname.trim() || null,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil atualizado" });
  };

  const onAvatarCropped = async (url: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: url } as any)
      .eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar foto", description: error.message, variant: "destructive" });
      return;
    }
    setAvatarUrl(url);
    setPendingFile(null);
    toast({ title: "Foto de perfil atualizada" });
  };

  const removeAvatar = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null } as any)
      .eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setAvatarUrl(null);
    toast({ title: "Foto removida" });
  };

  const initials = (fullName || nickname || email || "?").trim().charAt(0).toUpperCase();

  if (loading) {
    return <div className="container mx-auto p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas informações pessoais e como aparece no sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <Avatar className="h-24 w-24 border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Foto de perfil" />}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPendingFile(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                {avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeAvatar}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Aparece em Equipe e Minhas Tarefas. Login com Google/Apple importa a foto automaticamente.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="nickname">Apelido</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="Como você quer ser chamado"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Quando definido, será usado em comentários e registros de tarefas no lugar do nome completo.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Notificações push</CardTitle>
        </CardHeader>
        <CardContent>
          {pushState === "unsupported" && (
            <p className="text-sm text-muted-foreground">
              Notificações push não são suportadas neste navegador.
            </p>
          )}
          {pushState === "denied" && (
            <p className="text-sm text-muted-foreground">
              Notificações bloqueadas nas configurações do navegador. Ative lá e recarregue esta página.
            </p>
          )}
          {pushState === "active" && (
            <p className="text-sm flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" /> Notificações ativadas neste dispositivo.
            </p>
          )}
          {pushState === "idle" && (
            <div className="space-y-2">
              <Button onClick={activatePush} disabled={pushLoading || !VAPID_KEY_CONFIGURED} className="gap-2">
                <Bell className="h-4 w-4" />
                {pushLoading ? "Ativando..." : "Ativar notificações"}
              </Button>
              {!VAPID_KEY_CONFIGURED && (
                <p className="text-xs text-muted-foreground">Configuração pendente no servidor (chave VAPID).</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingFile && user && (
        <ImageCropper
          file={pendingFile}
          open
          onClose={() => setPendingFile(null)}
          onCropped={onAvatarCropped}
          aspect={1}
          circular
          uploadPath={`avatars/${user.id}-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
