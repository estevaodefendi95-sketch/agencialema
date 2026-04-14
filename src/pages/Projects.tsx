import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Calendar, LayoutGrid, List, ArrowUpDown, Building2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  company_id: string;
  companies?: { name: string } | null;
}

interface Company { id: string; name: string; }

type SortField = "empresa" | "prazo";
type SortDir = "asc" | "desc";

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
  const [viewMode, setViewMode] = useState<"card" | "lista">(() =>
    (localStorage.getItem("view-mode-projetos") as "card" | "lista") || "card"
  );
  const [sortField, setSortField] = useState<SortField>(() =>
    (localStorage.getItem("sort-field-projetos") as SortField) || "empresa"
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    (localStorage.getItem("sort-dir-projetos") as SortDir) || "asc"
  );

  const load = async () => {
    const { data } = await supabase.from("projects").select("*, companies(name)").order("created_at", { ascending: false });
    setProjects(data || []);
    if (isAdmin) {
      const { data: c } = await supabase.from("companies").select("id, name").order("name");
      setCompanies(c || []);
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

  const groupedProjects = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    projects.forEach((p) => {
      const companyName = (p.companies as any)?.name || "Sem empresa";
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(p);
    });

    // Sort projects within each group by prazo
    Object.values(groups).forEach((list) => {
      if (sortField === "prazo") {
        list.sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return sortDir === "asc" ? da - db : db - da;
        });
      }
    });

    // Sort group names
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (sortField === "empresa") {
        return sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
      }
      // When sorting by prazo, sort groups by earliest due date in each group
      const earliest = (list: Project[]) => {
        const dates = list.filter(p => p.due_date).map(p => new Date(p.due_date!).getTime());
        return dates.length ? Math.min(...dates) : Infinity;
      };
      const ea = earliest(groups[a]);
      const eb = earliest(groups[b]);
      return sortDir === "asc" ? ea - eb : eb - ea;
    });

    return sortedKeys.map((key) => ({ companyName: key, projects: groups[key] }));
  }, [projects, sortField, sortDir]);

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
        <div className="flex items-center gap-2">
          {/* Sort buttons */}
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
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{group.companyName}</h3>
                <span className="text-xs text-muted-foreground">({group.projects.length})</span>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.projects.map((p) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/projetos/${p.id}`)}>
                        <TableCell className="font-medium">{p.name}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum projeto encontrado</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {groupedProjects.map((group) => (
            <div key={group.companyName} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{group.companyName}</h3>
                <span className="text-xs text-muted-foreground">({group.projects.length})</span>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {group.projects.map((p) => (
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
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum projeto encontrado</p>
            </div>
          )}
        </>
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
