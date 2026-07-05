import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { Users, AlertTriangle, Zap, Pencil, Building2, FolderKanban } from "lucide-react";

type Member = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  tarefas_ativas: number;
  tarefas_aprovadas: number;
  tarefas_atrasadas: number;
  tarefas_urgentes: number;
};

type Company = { id: string; name: string };
type Project = { id: string; name: string; company_id: string };

export default function Team() {
  const { canEdit, isAdmin } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  const [selected, setSelected] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompanies, setEditCompanies] = useState<string[]>([]);
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [initialProjects, setInitialProjects] = useState<string[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canEdit) return;
    load();
  }, [canEdit]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdminData();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("team_workload")
      .select("*")
      .order("tarefas_ativas", { ascending: false });
    setMembers((data || []) as Member[]);
    setLoading(false);
  }

  async function loadAdminData() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("projects").select("id, name, company_id").eq("archived", false).order("name"),
    ]);
    setCompanies((c || []) as Company[]);
    setAllProjects((p || []) as Project[]);
  }

  async function openEdit(m: Member) {
    setSelected(m);
    setEditName(m.full_name || "");
    setDialogLoading(true);
    const [{ data: access }, { data: pm }] = await Promise.all([
      supabase.from("user_company_access").select("company_id").eq("user_id", m.user_id),
      supabase.from("project_members").select("project_id").eq("user_id", m.user_id).eq("status", "ativo"),
    ]);
    const companyIds = (access || []).map((a: any) => a.company_id);
    const projectIds = (pm || []).map((p: any) => p.project_id);
    setEditCompanies(companyIds);
    setEditProjects(projectIds);
    setInitialProjects(projectIds);
    setDialogLoading(false);
  }

  const toggleCompany = (cid: string) => {
    setEditCompanies((prev) => (prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]));
  };

  const toggleProject = (pid: string) => {
    setEditProjects((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const errors: string[] = [];

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editName.trim() || null })
        .eq("id", selected.user_id);
      if (error) throw error;
    } catch (err: any) {
      errors.push(`Nome: ${err.message}`);
    }

    try {
      const { error: delErr } = await supabase.from("user_company_access").delete().eq("user_id", selected.user_id);
      if (delErr) throw delErr;
      if (editCompanies.length > 0) {
        const { error: insErr } = await supabase
          .from("user_company_access")
          .insert(editCompanies.map((cid) => ({ user_id: selected.user_id, company_id: cid })));
        if (insErr) throw insErr;
      }
    } catch (err: any) {
      errors.push(`Empresas: ${err.message}`);
    }

    try {
      const visibleProjectIds = allProjects.filter((p) => editCompanies.includes(p.company_id)).map((p) => p.id);
      const toAdd = editProjects.filter((id) => visibleProjectIds.includes(id) && !initialProjects.includes(id));
      const toRemove = initialProjects.filter((id) => visibleProjectIds.includes(id) && !editProjects.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("user_id", selected.user_id)
          .in("project_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("project_members")
          .insert(toAdd.map((pid) => ({ project_id: pid, user_id: selected.user_id, status: "ativo" })));
        if (error) throw error;
      }
    } catch (err: any) {
      errors.push(`Projetos: ${err.message}`);
    }

    setSaving(false);
    if (errors.length > 0) {
      toast({ title: "Algumas alterações não foram salvas", description: errors.join(" | "), variant: "destructive" });
    } else {
      toast({ title: "Membro atualizado com sucesso" });
      setSelected(null);
    }
    load();
  }

  if (!canEdit) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Equipe</h2>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum membro da equipe encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.user_id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <AssigneeAvatar url={m.avatar_url} name={m.full_name || m.email} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{m.full_name || m.email || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Tarefas ativas</span>
                  <span className="text-2xl font-bold">{m.tarefas_ativas}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{m.tarefas_aprovadas} aprovadas</Badge>
                  {m.tarefas_atrasadas > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {m.tarefas_atrasadas} atrasadas
                    </Badge>
                  )}
                  {m.tarefas_urgentes > 0 && (
                    <Badge className="gap-1 border-transparent bg-warning text-warning-foreground hover:bg-warning/80">
                      <Zap className="h-3 w-3" /> {m.tarefas_urgentes} urgentes
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Membro — {selected?.full_name || selected?.email}</DialogTitle>
          </DialogHeader>

          {dialogLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do membro" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Empresas com acesso
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox checked={editCompanies.includes(c.id)} onCheckedChange={() => toggleCompany(c.id)} />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" /> Projetos que participa
                </Label>
                {editCompanies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Marque ao menos uma empresa para ver os projetos</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto border rounded-lg p-3">
                    {companies
                      .filter((c) => editCompanies.includes(c.id))
                      .map((c) => {
                        const companyProjects = allProjects.filter((p) => p.company_id === c.id);
                        return (
                          <div key={c.id}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{c.name}</p>
                            {companyProjects.length === 0 ? (
                              <p className="text-xs text-muted-foreground pl-1">Nenhum projeto</p>
                            ) : (
                              <div className="space-y-1 pl-1">
                                {companyProjects.map((p) => (
                                  <div key={p.id} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={editProjects.includes(p.id)}
                                      onCheckedChange={() => toggleProject(p.id)}
                                    />
                                    <span className="text-sm">{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || dialogLoading}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
