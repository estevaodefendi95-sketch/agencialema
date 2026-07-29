import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Calendar, LayoutGrid, List, ArrowUpDown, Building2, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, Eye, EyeOff } from "lucide-react";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { getEntityColor, PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";

interface Project {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  company_id: string;
  archived: boolean;
  color: string | null;
  companies?: { name: string; logo_url: string | null } | null;
}

interface Company { id: string; name: string; logo_url: string | null; }
type AdditionalCompany = { id: string; name: string; logo_url: string | null };

type SortField = "empresa" | "prazo";
type SortDir = "asc" | "desc";

function CompanyStack({ companies }: { companies: AdditionalCompany[] }) {
  if (companies.length === 0) return null;
  const visible = companies.slice(0, 3);
  const overflow = companies.length - visible.length;
  return (
    <div className="flex items-center -space-x-2 shrink-0">
      {visible.map((c) => (
        c.logo_url ? (
          <img
            key={c.id}
            src={c.logo_url}
            alt={c.name}
            title={c.name}
            className="h-6 w-6 rounded-full object-cover border-2 border-background"
          />
        ) : (
          <div
            key={c.id}
            title={c.name}
            className="h-6 w-6 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center"
          >
            <Building2 className="h-3 w-3 text-primary" />
          </div>
        )
      ))}
      {overflow > 0 && (
        <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
          +{overflow}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const { isAdmin, canEdit, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [additionalCompanyIds, setAdditionalCompanyIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Edit project dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editAdditionalCompanyIds, setEditAdditionalCompanyIds] = useState<string[]>([]);

  const [additionalCompaniesByProject, setAdditionalCompaniesByProject] = useState<Record<string, AdditionalCompany[]>>({});

  // Delete confirm
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"card" | "lista">(() =>
    (localStorage.getItem("view-mode-projetos") as "card" | "lista") || "card"
  );
  const [sortField, setSortField] = useState<SortField>(() =>
    (localStorage.getItem("sort-field-projetos") as SortField) || "empresa"
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    (localStorage.getItem("sort-dir-projetos") as SortDir) || "asc"
  );

  const [tasksByProject, setTasksByProject] = useState<Record<string, { id: string; title: string; status: string; priority: string; due_date: string | null }[]>>({});

  const load = async () => {
    const { data } = await supabase.from("projects").select("*, companies(name, logo_url)").order("created_at", { ascending: false });
    const list = (data as any[])?.map(d => ({ ...d, archived: d.archived ?? false })) || [];
    setProjects(list);
    if (canEdit) {
      const { data: c } = await supabase.from("companies").select("id, name, logo_url").order("name");
      setCompanies((c || []) as Company[]);
    }
    const ids = list.map((p) => p.id);
    if (ids.length) {
      const [{ data: tasks }, { data: pc }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id, position")
          .in("project_id", ids)
          .order("position", { ascending: true }),
        supabase
          .from("project_companies")
          .select("project_id, company_id, companies(name, logo_url)")
          .in("project_id", ids),
      ]);
      const grouped: Record<string, any[]> = {};
      (tasks || []).forEach((t: any) => {
        if (!grouped[t.project_id]) grouped[t.project_id] = [];
        grouped[t.project_id].push(t);
      });
      setTasksByProject(grouped);

      const pcGrouped: Record<string, AdditionalCompany[]> = {};
      (pc || []).forEach((row: any) => {
        if (!pcGrouped[row.project_id]) pcGrouped[row.project_id] = [];
        pcGrouped[row.project_id].push({
          id: row.company_id,
          name: row.companies?.name || "Empresa",
          logo_url: row.companies?.logo_url ?? null,
        });
      });
      setAdditionalCompaniesByProject(pcGrouped);
    } else {
      setTasksByProject({});
      setAdditionalCompaniesByProject({});
    }
  };

  useEffect(() => { load(); }, []);

  const toggleViewMode = (mode: "card" | "lista") => {
    setViewMode(mode);
    localStorage.setItem("view-mode-projetos", mode);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      const newDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(newDir);
      localStorage.setItem("sort-dir-projetos", newDir);
    } else {
      setSortField(field);
      setSortDir("asc");
      localStorage.setItem("sort-field-projetos", field);
      localStorage.setItem("sort-dir-projetos", "asc");
    }
  };

  const filteredProjects = useMemo(() =>
    projects.filter(p => showArchived ? p.archived : !p.archived),
    [projects, showArchived]
  );

  const groupedProjects = useMemo(() => {
    const groups: Record<string, { projects: Project[]; logoUrl: string | null; companyId: string | null }> = {};
    filteredProjects.forEach((p) => {
      const companyName = (p.companies as any)?.name || "Sem empresa";
      const companyId = (p.companies as any)?.id || p.company_id;
      if (!groups[companyName]) groups[companyName] = { projects: [], logoUrl: (p.companies as any)?.logo_url || null, companyId: companyId || null };
      groups[companyName].projects.push(p);
    });

    Object.values(groups).forEach((group) => {
      if (sortField === "prazo") {
        group.projects.sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return sortDir === "asc" ? da - db : db - da;
        });
      }
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (sortField === "empresa") {
        return sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
      }
      const earliest = (g: { projects: Project[] }) => {
        const dates = g.projects.filter(p => p.due_date).map(p => new Date(p.due_date!).getTime());
        return dates.length ? Math.min(...dates) : Infinity;
      };
      return sortDir === "asc" ? earliest(groups[a]) - earliest(groups[b]) : earliest(groups[b]) - earliest(groups[a]);
    });

    return sortedKeys.map((key) => ({ companyName: key, logoUrl: groups[key].logoUrl, companyId: groups[key].companyId, projects: groups[key].projects }));
  }, [filteredProjects, sortField, sortDir]);

  const logHistory = async (projectId: string, action: string, previousData: any, newData: any) => {
    await (supabase.from as any)("project_history").insert({
      project_id: projectId,
      action,
      previous_data: previousData,
      new_data: newData,
      user_id: user?.id,
    });
  };

  // Sincroniza project_companies com a lista desejada de empresas adicionais,
  // sem nunca mexer no vínculo da empresa principal (esse vem de projects.company_id).
  const syncProjectCompanies = async (projectId: string, principalId: string, desiredIds: string[]) => {
    const finalIds = Array.from(new Set(desiredIds.filter((id) => id && id !== principalId)));
    const { data: existing } = await supabase
      .from("project_companies")
      .select("id, company_id")
      .eq("project_id", projectId);
    const existingRows = (existing || []) as { id: string; company_id: string }[];
    const existingIds = existingRows.map((r) => r.company_id);

    const toAdd = finalIds.filter((id) => !existingIds.includes(id));
    const toRemove = existingRows.filter((r) => !finalIds.includes(r.company_id));

    if (toAdd.length > 0) {
      await supabase.from("project_companies").insert(toAdd.map((company_id) => ({ project_id: projectId, company_id })));
    }
    if (toRemove.length > 0) {
      await supabase.from("project_companies").delete().in("id", toRemove.map((r) => r.id));
    }
  };

  const save = async () => {
    const { data } = await supabase.from("projects").insert({ name, description, company_id: companyId, due_date: dueDate || null, color } as any).select().single();
    if (data) {
      await logHistory(data.id, "create", null, { name, description, due_date: dueDate || null });
      if (additionalCompanyIds.length > 0) {
        await syncProjectCompanies(data.id, companyId, additionalCompanyIds);
      }
    }
    toast({ title: "Projeto criado" });
    setOpen(false);
    setName(""); setDescription(""); setCompanyId(""); setDueDate(""); setColor(null); setAdditionalCompanyIds([]);
    load();
  };

  const openEdit = async (p: Project) => {
    setEditProject(p);
    setEditName(p.name);
    setEditDescription(p.description || "");
    setEditDueDate(p.due_date || "");
    setEditColor(p.color || null);
    setEditAdditionalCompanyIds((additionalCompaniesByProject[p.id] || []).map((c) => c.id));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editProject) return;
    const updates: any = {};
    const prev: any = {};
    const next: any = {};

    if (editName !== editProject.name) {
      updates.name = editName;
      prev.name = editProject.name;
      next.name = editName;
    }
    if (editDescription !== (editProject.description || "")) {
      updates.description = editDescription || null;
      prev.description = editProject.description;
      next.description = editDescription || null;
    }
    const newDue = editDueDate || null;
    if (newDue !== editProject.due_date) {
      updates.due_date = newDue;
      prev.due_date = editProject.due_date;
      next.due_date = newDue;
    }
    if (editColor !== (editProject.color || null)) {
      updates.color = editColor;
    }

    await syncProjectCompanies(editProject.id, editProject.company_id, editAdditionalCompanyIds);

    if (Object.keys(updates).length > 0) {
      await supabase.from("projects").update(updates).eq("id", editProject.id);
      await logHistory(editProject.id, "update", prev, next);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projetos</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showArchived ? "Arquivados" : "Ativos"}
          </Button>
          <Button
            variant={sortField === "empresa" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => toggleSort("empresa")}
          >
            <Building2 className="h-3.5 w-3.5" />
            Empresa {sortField === "empresa" && (sortDir === "asc" ? "A-Z" : "Z-A")}
          </Button>
          <Button
            variant={sortField === "prazo" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => toggleSort("prazo")}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Prazo {sortField === "prazo" && (sortDir === "asc" ? "↑" : "↓")}
          </Button>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === "card" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5" onClick={() => toggleViewMode("card")}>
              <LayoutGrid className="h-4 w-4" /> Card
            </Button>
            <Button variant={viewMode === "lista" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5" onClick={() => toggleViewMode("lista")}>
              <List className="h-4 w-4" /> Lista
            </Button>
          </div>
          {isAdmin && (
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          )}
        </div>
      </div>

      {viewMode === "lista" ? (
        <div className="space-y-4">
          {groupedProjects.map((group) => (
            <div key={group.companyName} className="space-y-1">
              <div
                className={cn("flex items-center gap-2 px-2 py-1.5", group.companyId && "cursor-pointer group/company")}
                onClick={() => group.companyId && navigate(`/empresas/${group.companyId}`)}
              >
                {group.logoUrl ? (
                  <img src={group.logoUrl} alt={group.companyName} className="h-5 w-5 rounded object-cover" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide group-hover/company:underline">{group.companyName}</h3>
                <span className="text-xs text-muted-foreground">({group.projects.length})</span>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tarefas</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Descrição</TableHead>
                      {canEdit && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.projects.map((p) => {
                      const tasks = tasksByProject[p.id] || [];
                      return (
                        <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/projetos/${p.id}`)}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            {tasks.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-col gap-0.5 max-w-[260px]">
                                <span className="text-xs font-medium text-muted-foreground">{tasks.length} tarefa{tasks.length > 1 ? "s" : ""}</span>
                                <span className="text-xs truncate">{tasks.slice(0, 2).map(t => t.title).join(", ")}{tasks.length > 2 ? "…" : ""}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.due_date ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(p.due_date).toLocaleDateString("pt-BR")}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.description || "—"}</TableCell>
                          {canEdit && (
                            <TableCell>
                              <ProjectActions p={p} />
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{showArchived ? "Nenhum projeto arquivado" : "Nenhum projeto encontrado"}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {groupedProjects.map((group) => (
            <div key={group.companyName} className="space-y-3">
              <div
                className={cn("flex items-center gap-2 px-1", group.companyId && "cursor-pointer group/company")}
                onClick={() => group.companyId && navigate(`/empresas/${group.companyId}`)}
              >
                {group.logoUrl ? (
                  <img src={group.logoUrl} alt={group.companyName} className="h-5 w-5 rounded object-cover" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide group-hover/company:underline">{group.companyName}</h3>
                <span className="text-xs text-muted-foreground">({group.projects.length})</span>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {group.projects.map((p) => (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:shadow-md transition-shadow relative border-l-4"
                    style={{ borderLeftColor: getEntityColor(p.id, p.color, PROJECT_COLOR_PALETTE) }}
                    onClick={() => navigate(`/projetos/${p.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {(p.companies as any)?.logo_url ? (
                          <img src={(p.companies as any).logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <FolderKanban className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <CompanyStack companies={additionalCompaniesByProject[p.id] || []} />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{p.name}</CardTitle>
                          <CardDescription
                            className="cursor-pointer hover:underline w-fit"
                            onClick={(e) => {
                              e.stopPropagation();
                              const companyId = (p.companies as any)?.id || p.company_id;
                              if (companyId) navigate(`/empresas/${companyId}`);
                            }}
                          >
                            {(p.companies as any)?.name}
                          </CardDescription>
                        </div>
                        <ProjectActions p={p} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {p.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.description}</p>}
                      {p.due_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" /> Prazo: {new Date(p.due_date).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                      {(() => {
                        const tasks = tasksByProject[p.id] || [];
                        if (tasks.length === 0) {
                          return <p className="text-xs text-muted-foreground italic">Nenhuma tarefa ainda</p>;
                        }
                        const priorityColor: Record<string, string> = {
                          urgente: "bg-destructive",
                          alta: "bg-orange-500",
                          media: "bg-yellow-500",
                          baixa: "bg-emerald-500",
                        };
                        return (
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
                        );
                      })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{showArchived ? "Nenhum projeto arquivado" : "Nenhum projeto encontrado"}</p>
            </div>
          )}
        </>
      )}

      {/* New Project Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setAdditionalCompanyIds((prev) => prev.filter((id) => id !== v)); }}>
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
            <div className="space-y-2">
              <Label>Cor</Label>
              <ColorSwatchPicker value={color} onChange={setColor} allowNone />
            </div>
            {companies.filter((c) => c.id !== companyId).length > 0 && (
              <div className="space-y-2">
                <Label>Empresas adicionais vinculadas</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {companies.filter((c) => c.id !== companyId).map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={additionalCompanyIds.includes(c.id)}
                        onCheckedChange={() => setAdditionalCompanyIds((prev) => prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name || !companyId}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
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
            {editProject && companies.filter((c) => c.id !== editProject.company_id).length > 0 && (
              <div className="space-y-2">
                <Label>Empresas adicionais vinculadas</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {companies.filter((c) => c.id !== editProject.company_id).map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editAdditionalCompanyIds.includes(c.id)}
                        onCheckedChange={() => setEditAdditionalCompanyIds((prev) => prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editName}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
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
