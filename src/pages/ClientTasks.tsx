import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { CheckSquare, FolderKanban, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "baixa" | "media" | "alta" | "urgente";
  due_date: string | null;
  assigned_to: string | null;
  project_id: string;
  projectName: string;
};

type ColumnInfo = { project_id: string; slug: string; label: string; color: string; position: number };
type Profile = { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null };

// Conjunto genérico usado quando "todos os projetos" está selecionado (mesmo padrão do TaskCalendar)
const DEFAULT_STATUS_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer" },
  { slug: "em_andamento", label: "Em Andamento" },
  { slug: "concluido", label: "Concluído" },
  { slug: "aprovado", label: "Aprovado" },
];

const priorityColor: Record<string, string> = {
  baixa: "bg-blue-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  urgente: "bg-red-500",
};

const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export default function ClientTasks() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: access } = await supabase.from("user_company_access").select("company_id").eq("user_id", user.id);
    const companyIds = Array.from(new Set((access || []).map((a: any) => a.company_id)));
    if (companyIds.length === 0) {
      setProjects([]);
      setTasks([]);
      setColumns([]);
      setLoading(false);
      return;
    }

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, company_id")
      .in("company_id", companyIds)
      .eq("archived", false)
      .order("name");
    const projectIds = (projectsData || []).map((p: any) => p.id);
    setProjects((projectsData || []).map((p: any) => ({ id: p.id, name: p.name })));

    if (projectIds.length === 0) {
      setTasks([]);
      setColumns([]);
      setLoading(false);
      return;
    }

    const [{ data: tasksData }, { data: columnsData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, assigned_to, project_id")
        .in("project_id", projectIds)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("project_columns").select("project_id, slug, label, color, position").in("project_id", projectIds),
    ]);
    setColumns((columnsData || []) as ColumnInfo[]);

    const projectNameMap = new Map((projectsData || []).map((p: any) => [p.id, p.name as string]));

    const assigneeIds = Array.from(new Set((tasksData || []).map((t: any) => t.assigned_to).filter(Boolean)));
    const profileMap: Record<string, Profile> = {};
    if (assigneeIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url")
        .in("id", assigneeIds);
      (profilesData || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }
    setProfiles(profileMap);

    const enriched: TaskRow[] = (tasksData || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      assigned_to: t.assigned_to,
      project_id: t.project_id,
      projectName: projectNameMap.get(t.project_id) || "Projeto",
    }));
    setTasks(enriched);
    setLoading(false);
  }

  const statusOptions = useMemo(() => {
    if (projectFilter !== "all") {
      const list = columns.filter((c) => c.project_id === projectFilter).sort((a, b) => a.position - b.position);
      if (list.length > 0) return list.map((c) => ({ slug: c.slug, label: c.label }));
    }
    return DEFAULT_STATUS_COLUMNS;
  }, [columns, projectFilter]);

  function columnFor(projectId: string, status: string) {
    return columns.find((c) => c.project_id === projectId && c.slug === status) || null;
  }
  function statusLabelFor(projectId: string, status: string) {
    return columnFor(projectId, status)?.label || DEFAULT_STATUS_COLUMNS.find((d) => d.slug === status)?.label || status;
  }
  function statusColorFor(projectId: string, status: string) {
    return columnFor(projectId, status)?.color || "#94a3b8";
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, projectFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { projectName: string; items: TaskRow[] }>();
    filteredTasks.forEach((t) => {
      if (!map.has(t.project_id)) map.set(t.project_id, { projectName: t.projectName, items: [] });
      map.get(t.project_id)!.items.push(t);
    });
    return Array.from(map.entries())
      .map(([projectId, v]) => ({ projectId, projectName: v.projectName, items: v.items }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [filteredTasks]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe o andamento das tarefas dos seus projetos.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          value={projectFilter}
          onValueChange={(v) => {
            setProjectFilter(v);
            setStatusFilter("all");
          }}
        >
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma tarefa encontrada</p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((g) => (
            <section key={g.projectId} className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <FolderKanban className="h-5 w-5 text-primary" />
                {g.projectName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((t) => {
                  const profile = t.assigned_to ? profiles[t.assigned_to] : null;
                  const assigneeName = profile?.nickname?.trim() || profile?.full_name || null;
                  return (
                    <div key={t.id} className="rounded-xl border bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium leading-snug">{t.title}</h3>
                        <Badge
                          variant="secondary"
                          className="shrink-0"
                          style={{ backgroundColor: `${statusColorFor(t.project_id, t.status)}20`, color: statusColorFor(t.project_id, t.status) }}
                        >
                          {statusLabelFor(t.project_id, t.status)}
                        </Badge>
                      </div>
                      {t.description && <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <Badge variant="outline" className="gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", priorityColor[t.priority])} />
                          {priorityLabel[t.priority]}
                        </Badge>
                        {t.due_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(t.due_date + "T00:00:00"), "d 'de' MMM", { locale: ptBR })}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 ml-auto">
                          <AssigneeAvatar url={profile?.avatar_url} name={assigneeName} />
                          {assigneeName || "Sem responsável"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
