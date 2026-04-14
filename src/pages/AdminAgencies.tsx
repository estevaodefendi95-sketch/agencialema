import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";

interface Agency {
  id: string;
  name: string;
  slug: string | null;
  app_name: string;
  logo_url: string | null;
  created_at: string;
}

export default function AdminAgencies() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [appName, setAppName] = useState("GestãoPro");

  const load = async () => {
    const { data } = await supabase.from("agencies").select("*").order("created_at");
    if (data) setAgencies(data);
  };

  useEffect(() => { load(); }, []);

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const load = async () => {
    const { data } = await supabase.from("agencies").select("*").order("created_at");
    if (data) setAgencies(data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setAppName("GestãoPro");
    setDialogOpen(true);
  };

  const openEdit = (a: Agency) => {
    setEditingId(a.id);
    setName(a.name);
    setSlug(a.slug || "");
    setAppName(a.app_name);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), slug: slug.trim() || null, app_name: appName.trim() };

    if (editingId) {
      await supabase.from("agencies").update(payload).eq("id", editingId);
      toast({ title: "Agência atualizada" });
    } else {
      await supabase.from("agencies").insert(payload);
      toast({ title: "Agência criada" });
    }

    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("agencies").delete().eq("id", id);
    toast({ title: "Agência removida" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building className="h-6 w-6" /> Agências
        </h2>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova Agência
        </Button>
      </div>

      {agencies.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma agência cadastrada ainda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agencies.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <Building className="h-5 w-5 text-muted-foreground" />
                  )}
                  {a.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {a.slug && <span className="font-mono">/{a.slug}</span>}
                  {a.slug && " · "}
                  {a.app_name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Agência" : "Nova Agência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da agência" />
            </div>
            <div className="space-y-2">
              <Label>Slug (opcional)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="minha-agencia" />
            </div>
            <div className="space-y-2">
              <Label>Nome exibido no app</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="GestãoPro" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
