import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type DropResult } from "@hello-pangea/dnd";
import { CalendarDays, Building2, FolderKanban, X, MessageSquare, Filter } from "lucide-react";
import TaskDetail from "@/components/TaskDetail";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { TaskAssigneeChip } from "@/components/TaskAssigneeChip";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { TaskCalendarView } from "@/components/TaskCalendarView";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { getEntityColor, PROJECT_COLOR_PALETTE, TEAM_COLOR_PALETTE } from "@/lib/colorPalette";
import { useCalendarColorMode } from "@/hooks/useCalendarColorMode";
import { useToast } from "@/hooks/use-toast";

type TaskWithRelations = {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  assigned_to: string | null;
  assignee_name: string | null;
  project_id: string | null;
  created_by: string | null;
  status: string;
  color: string | null;
  day_order: number | null;
  created_at: string;
  parent_task_id: string | null;
  projects: { name: string; company_id: string; color: string | null; companies: { name: string; logo_url: string | null; color: string | null } | null } | null;
  assignee?: { full_name: string | null; nickname?: string | null; avatar_url: string | null; color?: string | null } | null;
  comment_count?: number;
};

const DEFAULT_STATUS_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer" },
  { slug: "em_andamento", label: "Em Andamento" },
  { slug: "concluido", label: "Concluído" },
  { slug: "aprovado", label: "Aprovado" },
];

// Ordem das tarefas dentro de um dia: day_order (drag-and-drop) primeiro,
// depois horário, depois criação — sem day_order (null), fica sempre por
// último dentro do critério seguinte.
function compareDayOrder(a: TaskWithRelations, b: TaskWithRelations): number {
  if (a.day_order != null && b.day_order != null && a.day_order !== b.day_order) return a.day_order - b.day_order;
  if (a.day_order != null && b.day_order == null) return -1;
  if (a.day_order == null && b.day_order != null) return 1;
  if (a.due_time && b.due_time && a.due_time !== b.due_time) return a.due_time.localeCompare(b.due_time);
  if (a.due_time && !b.due_time) return -1;
  if (!a.due_time && b.due_time) return 1;
  return a.created_at.localeCompare(b.created_at);
}

export default function TaskCalendar() {
  const navigate = useNavigate();
  const { avatarUrl, user, canEdit } = useAuth();
  const { toast } = useToast();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [periodRange, setPeriodRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
  const { colorMode, setColorMode, getTaskColor: getTaskColorForMode } = useCalendarColorMode();
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const selectedProjectLogo = useMemo(() => {
    if (projectFilter === "all") return null;
    return tasks.find((t) => t.project_id === projectFilter)?.projects?.companies?.logo_url || null;
  }, [projectFilter, tasks]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyAccessUserIds, setCompanyAccessUserIds] = useState<string[]>([]);
  const [companyAccessProfiles, setCompanyAccessProfiles] = useState<
    Record<string, { full_name: string | null; nickname: string | null; avatar_url: string | null; color: string | null }>
  >({});
  const [statusColumns, setStatusColumns] = useState<{ slug: string; label: string }[]>(DEFAULT_STATUS_COLUMNS);

  // Nova tarefa direto do calendário
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{ date?: Date; companyId?: string; projectId?: string; personal?: boolean }>({});

  const handleCompanyChange = (value: string) => {
    setCompanyFilter(value);
    setProjectFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
  };

  const handleProjectChange = (value: string) => {
    setProjectFilter(value);
    setStatusFilter("all");
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (companyFilter === "all") {
      setCompanyAccessUserIds([]);
      setCompanyAccessProfiles({});
      return;
    }
    loadCompanyAccess(companyFilter);
  }, [companyFilter]);

  useEffect(() => {
    loadStatusColumns();
  }, [projectFilter, companyFilter, tasks]);


  function openNewTaskDialog(date: Date, personal?: boolean) {
    const prefillProject = projectFilter !== "all" ? projectFilter : undefined;
    setNewTaskDefaults({ date, projectId: personal ? undefined : prefillProject, personal });
    setNewTaskOpen(true);
  }

  async function loadCompanyAccess(companyId: string) {
    const { data } = await supabase
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", companyId);
    const ids = Array.from(new Set((data || []).map((r: any) => r.user_id)));
    setCompanyAccessUserIds(ids);
    if (ids.length === 0) {
      setCompanyAccessProfiles({});
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, nickname, avatar_url, color")
      .in("id", ids);
    const map: Record<string, { full_name: string | null; nickname: string | null; avatar_url: string | null; color: string | null }> = {};
    (profiles || []).forEach((p: any) => {
      map[p.id] = { full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url, color: p.color };
    });
    setCompanyAccessProfiles(map);
  }

  async function loadStatusColumns() {
    let projectIds: string[] = [];
    if (projectFilter !== "all") {
      projectIds = [projectFilter];
    } else if (companyFilter !== "all") {
      const ids = new Set<string>();
      tasks.forEach((t) => {
        if (t.projects?.company_id === companyFilter) ids.add(t.project_id);
      });
      projectIds = Array.from(ids);
    }

    if (projectIds.length === 0) {
      setStatusColumns(DEFAULT_STATUS_COLUMNS);
      return;
    }

    const { data } = await supabase
      .from("project_columns")
      .select("slug, label, position")
      .in("project_id", projectIds)
      .order("position", { ascending: true });

    if (!data || data.length === 0) {
      setStatusColumns(DEFAULT_STATUS_COLUMNS);
      return;
    }

    const map = new Map<string, string>();
    (data as any[]).forEach((c) => {
      if (!map.has(c.slug)) map.set(c.slug, c.label);
    });
    setStatusColumns(Array.from(map.entries()).map(([slug, label]) => ({ slug, label })));
  }

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, due_time, priority, assigned_to, assignee_name, project_id, created_by, status, color, day_order, created_at, parent_task_id, projects(name, company_id, color, companies(name, logo_url, color))")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const assigneeIds = Array.from(new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean)));
    let assigneeMap: Record<string, { full_name: string | null; nickname: string | null; avatar_url: string | null; color: string | null }> = {};
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url, color")
        .in("id", assigneeIds);
      (profiles || []).forEach((p: any) => {
        assigneeMap[p.id] = { full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url, color: p.color };
      });
    }

    const taskIds = (data || []).map((t: any) => t.id);
    let commentCounts: Record<string, number> = {};
    if (taskIds.length > 0) {
      const { data: cData } = await supabase
        .from("task_comments")
        .select("task_id")
        .in("task_id", taskIds);
      (cData || []).forEach((c: any) => {
        commentCounts[c.task_id] = (commentCounts[c.task_id] || 0) + 1;
      });
    }

    const enriched = (data || []).map((t: any) => ({
      ...t,
      assignee: t.assigned_to ? assigneeMap[t.assigned_to] || null : null,
      comment_count: commentCounts[t.id] || 0,
    }));
    setTasks(enriched as TaskWithRelations[]);
    setLoading(false);
  }

  async function toggleTaskDone(task: TaskWithRelations, e?: React.MouseEvent) {
    e?.stopPropagation();
    const nextStatus = task.status === "concluido" ? "a_fazer" : "concluido";
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
    if (error) {
      setTasks(previous);
      toast({ title: "Não foi possível atualizar a tarefa", description: error.message, variant: "destructive" });
    }
  }

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      const c = t.projects?.companies;
      const id = t.projects?.company_id;
      if (id && c?.name) map.set(id, c.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (companyFilter !== "all" && t.projects?.company_id !== companyFilter) return;
      if (t.project_id && t.projects?.name) map.set(t.project_id, t.projects.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks, companyFilter]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { name: string; avatar_url: string | null }>();
    const freeSet = new Map<string, string>();
    let hasUnassigned = false;
    const relevantTasks =
      companyFilter === "all" ? tasks : tasks.filter((t) => t.projects?.company_id === companyFilter);
    relevantTasks.forEach((t) => {
      if (!t.assigned_to) {
        if (t.assignee_name && t.assignee_name.trim()) {
          const key = t.assignee_name.trim().toLowerCase();
          if (!freeSet.has(key)) freeSet.set(key, t.assignee_name.trim());
        } else {
          hasUnassigned = true;
        }
        return;
      }
      const name = (t.assignee as any)?.nickname?.trim() || t.assignee?.full_name || "Sem nome";
      map.set(t.assigned_to, { name, avatar_url: t.assignee?.avatar_url ?? null });
    });
    if (companyFilter !== "all") {
      companyAccessUserIds.forEach((id) => {
        if (!map.has(id)) {
          const p = companyAccessProfiles[id];
          const name = p?.nickname?.trim() || p?.full_name || "Sem nome";
          map.set(id, { name, avatar_url: p?.avatar_url ?? null });
        }
      });
    }
    const list = Array.from(map.entries()).map(([id, v]) => ({ id, name: v.name, avatar_url: v.avatar_url }));
    const freeNames = Array.from(freeSet.values()).sort((a, b) => a.localeCompare(b));
    return { list, hasUnassigned, freeNames };
  }, [tasks, companyFilter, companyAccessUserIds, companyAccessProfiles]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (companyFilter !== "all" && t.projects?.company_id !== companyFilter) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (assigneeFilter === "all") return true;
      if (assigneeFilter === "none") return !t.assigned_to && !t.assignee_name;
      if (assigneeFilter.startsWith("name:")) {
        const target = assigneeFilter.slice(5).toLowerCase();
        return !t.assigned_to && (t.assignee_name || "").trim().toLowerCase() === target;
      }
      return t.assigned_to === assigneeFilter;
    });
  }, [tasks, companyFilter, projectFilter, assigneeFilter, statusFilter]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    filteredTasks.forEach((t) => {
      const key = t.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    map.forEach((list) => list.sort(compareDayOrder));
    return map;
  }, [filteredTasks]);

  // Só quem pode editar arrasta tarefa de projeto; tarefa pessoal só o
  // próprio autor (mesmo sendo redundante com a RLS, que já só deixa o
  // autor ver a própria tarefa pessoal — fica explícito aqui também).
  const canDragCalendarTask = (t: TaskWithRelations) => {
    if (!t.project_id) return t.created_by === user?.id;
    return canEdit;
  };

  // Reverte uma jogada de arrastar (usado pelo "Desfazer" do toast e por
  // erro de gravação) — volta o estado local e regrava no banco os valores
  // anteriores de day_order/due_date de cada tarefa afetada.
  async function revertCalendarMove(updatedIds: string[], previous: TaskWithRelations[]) {
    setTasks(previous);
    for (const id of updatedIds) {
      const prevTask = previous.find((t) => t.id === id);
      if (!prevTask) continue;
      await supabase.from("tasks").update({ day_order: prevTask.day_order, due_date: prevTask.due_date } as any).eq("id", id);
    }
  }

  // Drag-and-drop do calendário: no mesmo dia, só reordena (day_order); em
  // outro dia, muda due_date preservando due_time e zerando
  // reminder_sent_at. Otimista, com reversão + toast se der erro; se der
  // certo e mudar de dia, toast "Movida para dd/MM" com Desfazer, e um
  // registro em task_history (mesmo padrão do TaskDetail: "Editou tarefa" +
  // details.changes).
  async function onCalendarDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const dragged = tasks.find((t) => t.id === draggableId);
    if (!dragged) return;

    const sourceDay = source.droppableId;
    const destDay = destination.droppableId;
    const sameDay = sourceDay === destDay;

    const destList = (tasksByDay.get(destDay) || []).filter((t) => t.id !== draggableId);
    destList.splice(destination.index, 0, dragged);

    const updates = destList.map((t, idx) => ({
      id: t.id,
      day_order: idx,
      ...(t.id === draggableId && !sameDay ? { due_date: destDay, reminder_sent_at: null as string | null } : {}),
    }));

    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        if (!u) return t;
        return { ...t, day_order: u.day_order, ...(u.due_date ? { due_date: u.due_date, reminder_sent_at: null } : {}) };
      }),
    );

    try {
      for (const u of updates) {
        const { id, ...payload } = u;
        const { error } = await supabase.from("tasks").update(payload as any).eq("id", id);
        if (error) throw error;
      }
    } catch (err: any) {
      setTasks(previous);
      toast({ title: "Não foi possível mover a tarefa", description: err.message, variant: "destructive" });
      return;
    }

    if (!sameDay) {
      const updatedIds = updates.map((u) => u.id);
      await supabase.from("task_history").insert({
        task_id: draggableId,
        user_id: user?.id,
        action: "Editou tarefa",
        details: { changes: ["Prazo atualizado"] },
      });
      toast({
        title: `Movida para ${format(new Date(`${destDay}T00:00:00`), "dd/MM")}`,
        action: (
          <ToastAction altText="Desfazer" onClick={() => revertCalendarMove(updatedIds, previous)}>
            Desfazer
          </ToastAction>
        ),
      });
    }
  }

  const hasFilters =
    companyFilter !== "all" || projectFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all";
  const activeFilterCount = [companyFilter, projectFilter, assigneeFilter, statusFilter].filter((f) => f !== "all").length;

  const getTaskColor = (task: TaskWithRelations): string =>
    getTaskColorForMode({
      manualColor: task.color,
      companyId: task.projects?.company_id || "pessoal",
      companyColor: task.projects?.companies?.color,
      assignedTo: task.assigned_to,
      assigneeColor: task.assignee?.color,
      assigneeName: task.assignee_name,
    });

  const periodTasks = useMemo(() => {
    return filteredTasks.filter((t) => isWithinInterval(new Date(t.due_date + "T00:00:00"), periodRange));
  }, [filteredTasks, periodRange]);

  const legendItems = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    periodTasks.forEach((t) => {
      if (colorMode === "empresa") {
        const companyId = t.projects?.company_id;
        if (!companyId) return;
        if (!map.has(companyId)) {
          map.set(companyId, {
            label: t.projects?.companies?.name || "Empresa",
            color: getEntityColor(companyId, t.projects?.companies?.color ?? null, PROJECT_COLOR_PALETTE),
          });
        }
      } else {
        const key = t.assigned_to || (t.assignee_name ? `nome:${t.assignee_name.trim().toLowerCase()}` : "sem-responsavel");
        if (!map.has(key)) {
          const label = t.assigned_to
            ? (t.assignee?.nickname?.trim() || t.assignee?.full_name || "Sem nome")
            : (t.assignee_name?.trim() || "Sem responsável");
          const color = t.assigned_to
            ? getEntityColor(t.assigned_to, t.assignee?.color ?? null, TEAM_COLOR_PALETTE)
            : t.assignee_name
              ? getEntityColor(t.assignee_name.trim().toLowerCase(), null, TEAM_COLOR_PALETTE)
              : "#94a3b8";
          map.set(key, { label, color });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [periodTasks, colorMode]);

  const renderTaskMeta = (task: TaskWithRelations) => (
    <>
      {task.projects && (
        <span className="flex items-center gap-1">
          <FolderKanban className="h-3 w-3" />
          {task.projects.name}
        </span>
      )}
      {task.projects?.companies && (
        <span className="flex items-center gap-1">
          {task.projects.companies.logo_url ? (
            <img
              src={task.projects.companies.logo_url}
              alt={task.projects.companies.name}
              className="h-3.5 w-3.5 rounded-full object-cover"
            />
          ) : (
            <Building2 className="h-3 w-3" />
          )}
          {task.projects.companies.name}
        </span>
      )}
      {colorMode === "responsavel" && (task.assignee || task.assignee_name) && (
        <TaskAssigneeChip assignee={task.assignee} assigneeName={task.assignee_name} className="ml-auto" />
      )}
      {(task.comment_count || 0) > 0 && (
        <span
          className={cn("flex items-center gap-1", !(colorMode === "responsavel" && (task.assignee || task.assignee_name)) && "ml-auto")}
          title="Comentários"
        >
          <MessageSquare className="h-3 w-3" />
          {task.comment_count}
        </span>
      )}
    </>
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto p-0 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Calendário de Tarefas</h1>
          <p className="hidden sm:block text-sm text-muted-foreground">
            Visualize todas as tarefas com prazo das empresas que você tem acesso
          </p>
        </div>
        {projectFilter !== "all" && selectedProjectLogo && (
          <img src={selectedProjectLogo} alt="" className="h-10 w-10 rounded-full object-cover border shrink-0" />
        )}
      </div>

      <TaskCalendarView
        tasks={filteredTasks}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        getTaskColor={getTaskColor}
        onOpenTask={(t) => setSelectedTaskId(t.id)}
        onCreate={(d) => openNewTaskDialog(d)}
        onToggleComplete={toggleTaskDone}
        onMoveTask={onCalendarDragEnd}
        canEdit={canEdit}
        canDragTask={canDragCalendarTask}
        renderTaskMeta={renderTaskMeta}
        storageKey="calendar-view-mode"
        loading={loading}
        onPeriodChange={setPeriodRange}
        filters={
          <>
            {/* Filters */}
            <div className="md:hidden">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setFiltersOpen((v) => !v)}>
                <Filter className="h-4 w-4" /> Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                )}
              </Button>
            </div>
            <div className={cn("flex-col lg:flex-row lg:flex-wrap gap-3 items-stretch lg:items-center", filtersOpen ? "flex" : "hidden md:flex")}>
        <Select value={companyFilter} onValueChange={handleCompanyChange}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companyOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={handleProjectChange}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-full lg:w-[200px] gap-2">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <AssigneeAvatar placeholder="all" />
                Todos os responsáveis
              </span>
            </SelectItem>
            {assigneeOptions.hasUnassigned && (
              <SelectItem value="none">
                <span className="flex items-center gap-2">
                  <AssigneeAvatar placeholder="none" />
                  Sem responsável
                </span>
              </SelectItem>
            )}
            {assigneeOptions.list.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  <AssigneeAvatar url={a.avatar_url} name={a.name} />
                  {a.name}
                </span>
              </SelectItem>
            ))}
            {assigneeOptions.freeNames.length > 0 && (
              <>
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Nomes livres</div>
                {assigneeOptions.freeNames.map((n) => (
                  <SelectItem key={`name:${n}`} value={`name:${n}`}>
                    <span className="flex items-center gap-2">
                      <AssigneeAvatar name={n} />
                      {n}
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusColumns.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCompanyFilter("all");
              setProjectFilter("all");
              setAssigneeFilter("all");
              setStatusFilter("all");
            }}
          >
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
            </div>
          </>
        }
      />

      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-1 text-xs text-muted-foreground">
          {legendItems.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Nova Tarefa */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        defaultDate={newTaskDefaults.date}
        defaultCompanyId={newTaskDefaults.companyId}
        defaultProjectId={newTaskDefaults.projectId}
        defaultPersonal={newTaskDefaults.personal}
        onCreated={() => loadTasks()}
      />

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => { setSelectedTaskId(null); loadTasks(); }}
          onTaskDeleted={() => { setSelectedTaskId(null); loadTasks(); }}
        />
      )}
    </div>
  );
}
