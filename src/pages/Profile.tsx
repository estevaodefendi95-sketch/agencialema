import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Save } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, nickname, email")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setNickname((data as any).nickname || "");
        setEmail(data.email || "");
      }
      setLoading(false);
    })();
  }, [user]);

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
        <CardContent className="space-y-4">
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
    </div>
  );
}
