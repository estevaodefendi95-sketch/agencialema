import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Pencil, Trash2, Upload, X } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

interface Company {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

export default function Companies() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    setCompanies(data || []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setName(""); setDescription(""); setLogoUrl(null); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setName(c.name); setDescription(c.description || ""); setLogoUrl(c.logo_url); setOpen(true); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = "";
  };

  const save = async () => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (editing) {
      await supabase.from("companies").update({ name, description, slug, logo_url: logoUrl }).eq("id", editing.id);
      toast({ title: "Empresa atualizada" });
    } else {
      await supabase.from("companies").insert({ name, description, slug, logo_url: logoUrl });
      toast({ title: "Empresa criada" });
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("companies").delete().eq("id", id);
    toast({ title: "Empresa removida" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Empresas</h2>
        {isAdmin && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Empresa
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-center gap-3">
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="h-10 w-10 object-cover rounded-full border" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <CardDescription className="text-xs">{c.slug}</CardDescription>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </CardHeader>
            {c.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma empresa cadastrada</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição" />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="Logo" className="h-12 w-12 object-cover rounded-full border-2 border-border shadow-sm" />
                  <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                    <X className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          open={!!cropFile}
          onClose={() => setCropFile(null)}
          onCropped={(url) => setLogoUrl(url)}
          circular
          uploadPath={`logos/company-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
