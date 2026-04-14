import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Calendar } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  company_id: string;
  companies?: { name: string } | null;
}

interface Company { id: string; name: string; }

export default function Projects() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = async () => {
    const { data } = await supabase.from("projects").select("*, companies(name)").order("created_at", { ascending: false });
    setProjects(data || []);
    if (isAdmin) {
      const { data: c } = await supabase.from("companies").select("id, name").order("name");
      setCompanies(c || []);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    await supabase.from("projects").insert({ name, description, company_id: companyId, due_date: dueDate || null });
    toast({ title: "Projeto criado" });
    setOpen(false);
    setName(""); setDescription(""); setCompanyId(""); setDueDate("");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projetos</h2>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projetos/${p.id}`)}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>{(p.companies as any)?.name}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {p.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.description}</p>}
              {p.due_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Prazo: {new Date(p.due_date).toLocaleDateString("pt-BR")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum projeto encontrado</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name || !companyId}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
