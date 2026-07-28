import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Globe, Camera, FolderKanban, Calendar, Plus, MoreVertical, Pencil,
  Archive, ArchiveRestore, Trash2, ClipboardList,
} from "lucide-react";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { getEntityColor, PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";
import { CompanyDocuments } from "@/components/CompanyDocuments";

interface Company {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  planning_label: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  archived: boolean;
  color: string | null;
}

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const { isAdmin, canEdit, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, { id: string; title: string; priority: string }[]>>({});
  const [loading, setLoading] = useState(true);

  // Novo projeto
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState<string | null>(null);

  // Editar projeto
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [planningPopoverOpen, setPlanningPopoverOpen] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data: c } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
    setCompany(c as Company | null);

    const { data: p } = await supabase
      .from("projects")
      .select("id, name, description, due_date, archived, color")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    const list = ((p || []) as any[]).map((d) => ({ ...d, archived: d.archived ?? false })) as Project[];
    setProjects(list);

    const ids = list.filter((pr) => !pr.archived).map((pr) => pr.id);
    if (ids.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, priority, project_id")
        .in("project_id", ids);
      const grouped: Record<string, any[]> = {};
      (tasks || []).forEach((t: any) => {
        if (!grouped[t.project_id]) grouped[t.project_id] = [];
        grouped[t.project_id].push(t);
      });
      setTasksByProject(grouped);
    } else {
      setTasksByProject({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const logHistory = async (projectId: string, action: string, previousData: any, newData: any) => {
    await (supabase.from as any)("project_history").insert({
      project_id: projectId,
      action,
      previous_data: previousData,
      new_data: newData,
      user_id: user?.id,
    });
  };

  const save = async () => {
    if (!companyId || !name.trim()) return;
    const { data } = await supabase
      .from("projects")
      .insert({ name, description, company_id: companyId, due_date: dueDate || null, color } as any)
      .select()
      .single();
    if (data) await logHistory(data.id, "create", null, { name, description, due_date: dueDate || null });
    toast({ title: "Projeto criado" });
    setOpen(false);
    setName(""); setDescription(""); setDueDate(""); setColor(null);
    load();
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setEditName(p.name);
    setEditDescription(p.description || "");
    setEditDueDate(p.due_date || "");
    setEditColor(p.color || null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editProject) return;
    const updates: any = {};
    const prev: any = {};
    const next: any = {};
    if (editName !== editProject.name) { updates.name = editName; prev.name = editProject.name; next.name = editName; }
    if (editDescription !== (editProject.description || "")) { updates.description = editDescription || null; prev.description = editProject.description; next.description = editDescription || null; }
    const newDue = editDueDate || null;
    if (newDue !== editProject.due_date) { updates.due_date = newDue; prev.due_date = editProject.due_date; next.due_date = newDue; }
    if (editColor !== (editProject.color || null)) updates.color = editColor;

    if (Object.keys(updates).length === 0) { setEditOpen(false); return; }

    await supabase.from("projects").update(updates).eq("id", editProject.id);
    await logHistory(editProject.id, "update", prev, next);
    toast({ title: "Projeto atualizado" });
    setEditOpen(false);
    setEditProject(null);
    load();
  };

  const archiveProject = async (p: Project) => {
    const newArchived = !p.archived;
    await supabase.from("projects").update({ archived: newArchived } as any).eq("id", p.id);
    await logHistory(p.id, newArchived ? "archive" : "unarchive", { archived: p.archived }, { archived: newArchived });
    toast({ title: newArchived ? "Projeto arquivado" : "Projeto desarquivado" });
    load();
  };

  const deleteProject = async (id: string) => {
    await logHistory(id, "delete", { id }, null);
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    toast({ title: "Projeto excluído" });
    setDeleteProjectId(null);
    load();
  };

  const openPlanning = (projectId: string) => {
    setPlanningPopoverOpen(false);
    navigate(`/projetos/${projectId}?tab=planejamento`);
  };

  const handlePlanningClick = () => {
    if (activeProjects.length === 1) openPlanning(activeProjects[0].id);
  };

  const ProjectActions = ({ p }: { p: Project }) => {
    if (!canEdit) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => openEdit(p)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => archiveProject(p)}>
            {p.archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            {p.archived ? "Desarquivar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteProjectId(p.id)}>
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Carregando...</div>;
  }

  if (!company) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Empresa não encontrada</p>
      </div>
    );
  }

  const planningLabel = company.planning_label || "Planejamento";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-16 w-16 object-cover rounded-full border" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl">{company.name}</CardTitle>
              {company.description && <CardDescription className="mt-1 max-w-xl break-words">{company.description}</CardDescription>}
              {(company.website_url || company.instagram_url) && (
                <div className="flex items-center gap-3 mt-2">
                  {company.website_url && (
                    <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Link">
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  {company.instagram_url && (
                    <a href={company.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Instagram">
                      <Camera className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {activeProjects.length === 1 ? (
            <Button className="gap-2 shrink-0" onClick={handlePlanningClick}>
              <ClipboardList className="h-4 w-4" /> {planningLabel}
            </Button>
          ) : (
            <Popover open={planningPopoverOpen} onOpenChange={setPlanningPopoverOpen}>
              <PopoverTrigger asChild>
                <Button className="gap-2 shrink-0" disabled={activeProjects.length === 0}>
                  <ClipboardList className="h-4 w-4" /> {planningLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Escolha o projeto</p>
                <div className="space-y-0.5">
                  {activeProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openPlanning(p.id)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <CompanyDocuments companyId={company.id} canManage={canEdit} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" /> Projetos
        </h3>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        )}
      </div>

      {activeProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum projeto ainda</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {activeProjects.map((p) => {
            const tasks = tasksByProject[p.id] || [];
            const priorityColor: Record<string, string> = {
              urgente: "bg-destructive",
              alta: "bg-orange-500",
              media: "bg-yellow-500",
              baixa: "bg-emerald-500",
            };
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md transition-shadow relative border-l-4"
                style={{ borderLeftColor: getEntityColor(p.id, p.color, PROJECT_COLOR_PALETTE) }}
                onClick={() => navigate(`/projetos/${p.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                    </div>
                    <ProjectActions p={p} />
                  </div>
                </CardHeader>
                <CardContent>
                  {p.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2 break-words">{p.description}</p>}
                  {p.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Calendar className="h-3 w-3" /> Prazo: {new Date(p.due_date).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                  {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tarefa ainda</p>
                  ) : (
                    <div className="space-y-1.5 mt-2 border-t pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Tarefas</span>
                        <span>{tasks.length}</span>
                      </div>
                      <ul className="space-y-1">
                        {tasks.slice(0, 4).map((t) => (
                          <li key={t.id} className="flex items-center gap-2 text-xs">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityColor[t.priority] || "bg-muted-foreground"}`} />
                            <span className="truncate flex-1">{t.title}</span>
                          </li>
                        ))}
                        {tasks.length > 4 && (
                          <li className="text-xs text-muted-foreground pl-3.5">+ {tasks.length - 4} outras</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Novo Projeto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label>Cor</Label>
              <ColorSwatchPicker value={color} onChange={setColor} allowNone />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar Projeto */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do projeto" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <ColorSwatchPicker
                value={editColor}
                onChange={setEditColor}
                allowNone
                fallbackColor={editProject ? getEntityColor(editProject.id, null) : undefined}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editName}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => { if (!open) setDeleteProjectId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as tarefas do projeto serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteProjectId && deleteProject(deleteProjectId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
