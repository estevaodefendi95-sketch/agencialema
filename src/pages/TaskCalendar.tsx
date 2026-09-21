import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  addWeeks,
  addDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { CalendarDays, Building2, FolderKanban, X, MessageSquare, ChevronLeft, ChevronRight, Plus, Clock, CornerDownRight, Check, Filter } from "lucide-react";
import TaskDetail from "@/components/TaskDetail";
import { formatDueTime } from "@/lib/taskReminders";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { CalendarTaskPill } from "@/components/CalendarTaskPill";
import { TaskAssigneeChip } from "@/components/TaskAssigneeChip";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { CalendarColorToggle } from "@/components/CalendarColorToggle";
import { CalendarMonthGrid, CalendarWeekGrid, CalendarDayList } from "@/components/CalendarMonthWeekDay";
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
  project_id: string;
  status: string;
  color: string | null;
  day_order: number | null;
  created_at: string;
  parent_task_id: string | null;
  projects: { name: string; company_id: string; color: string | null; companies: { name: string; logo_url: string | null } | null } | null;
  assignee?: { full_name: string | null; nickname?: string | null; avatar_url: string | null; color?: string | null } | null;
  comment_count?: number;
};

type ViewMode = "mes" | "semana" | "dia";

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

const priorityBorder: Record<string, string> = {
  baixa: "border-blue-500",
  media: "border-yellow-500",
  alta: "border-orange-500",
  urgente: "border-red-500",
};

const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [cursor, setCursor] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("calendar-view-mode") as ViewMode) || "mes";
  });
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

  const changeViewMode = (m: ViewMode) => {
    if (!m) return;
    setViewMode(m);
    localStorage.setItem("calendar-view-mode", m);
  };

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
      .select("id, title, due_date, due_time, priority, assigned_to, assignee_name, project_id, status, color, day_order, created_at, parent_task_id, projects(name, company_id, color, companies(name, logo_url))")
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

  const getTasksForDay = (d: Date) => tasksByDay.get(format(d, "yyyy-MM-dd")) || [];

  // Drag-and-drop do calendário: no mesmo dia, só reordena (day_order); em
  // outro dia, muda due_date preservando due_time e zerando
  // reminder_sent_at. Otimista, com reversão + toast se der erro.
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
    }
  }

  const datesWithTasks = useMemo(
    () => filteredTasks.map((t) => new Date(t.due_date + "T00:00:00")),
    [filteredTasks],
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return filteredTasks.filter((t) => isSameDay(new Date(t.due_date + "T00:00:00"), selectedDate));
  }, [filteredTasks, selectedDate]);

  const hasFilters =
    companyFilter !== "all" || projectFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all";
  const activeFilterCount = [companyFilter, projectFilter, assigneeFilter, statusFilter].filter((f) => f !== "all").length;

  const getTaskColor = (task: TaskWithRelations): string =>
    getTaskColorForMode({
      manualColor: task.color,
      projectId: task.project_id,
      projectColor: task.projects?.color,
      assignedTo: task.assigned_to,
      assigneeColor: task.assignee?.color,
      assigneeName: task.assignee_name,
    });

  // Range of dates actually rendered by the current view, used to scope the legend.
  const periodRange = useMemo(() => {
    if (viewMode === "mes") {
      return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) };
    }
    if (viewMode === "semana") {
      return { start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) };
    }
    return { start: cursor, end: cursor };
  }, [viewMode, cursor]);

  const periodTasks = useMemo(() => {
    return filteredTasks.filter((t) => isWithinInterval(new Date(t.due_date + "T00:00:00"), periodRange));
  }, [filteredTasks, periodRange]);

  const legendItems = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    periodTasks.forEach((t) => {
      if (colorMode === "projeto") {
        if (!t.project_id) return;
        if (!map.has(t.project_id)) {
          map.set(t.project_id, {
            label: t.projects?.name || "Projeto",
            color: getEntityColor(t.project_id, t.projects?.color ?? null, PROJECT_COLOR_PALETTE),
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

  // Period label + nav
  const periodLabel = useMemo(() => {
    if (viewMode === "mes") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(ws, "d 'de' MMM", { locale: ptBR })} – ${format(we, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [cursor, viewMode]);

  const navPrev = () => {
    if (viewMode === "mes") setCursor((c) => subMonths(c, 1));
    else if (viewMode === "semana") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => addDays(c, -1));
  };
  const navNext = () => {
    if (viewMode === "mes") setCursor((c) => addMonths(c, 1));
    else if (viewMode === "semana") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };
  const goToday = () => {
    setCursor(new Date());
    setSelectedDate(new Date());
  };


  // Pill
  const TaskPill = ({ task }: { task: TaskWithRelations }) => (
    <CalendarTaskPill
      task={task}
      color={getTaskColor(task)}
      colorMode={colorMode}
      priorityColor={priorityColor}
      onOpen={(t) => setSelectedTaskId(t.id)}
      onToggleDone={toggleTaskDone}
    />
  );

  // Botão único "Nova Tarefa" com escolha de tipo (projeto ou pessoal)
  // O tipo (projeto/pessoal) agora só se escolhe dentro do próprio
  // NewTaskDialog (aba Tarefa de projeto / Tarefa pessoal) — este botão só
  // abre o diálogo direto, sempre começando na aba de projeto.
  const NewTaskMenu = ({ day, iconOnly }: { day: Date; iconOnly?: boolean }) => (
    iconOnly ? (
      <button
        onClick={(e) => { e.stopPropagation(); openNewTaskDialog(day, false); }}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
        title="Nova tarefa"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    ) : (
      <Button className="gap-2" size="sm" onClick={() => openNewTaskDialog(day, false)}>
        <Plus className="h-4 w-4" /> Nova Tarefa
      </Button>
    )
  );

  // ========== Day View (uses existing detailed cards) ==========
  const DayView = () => {
    const dayTasks = getTasksForDay(cursor);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={cursor}
              onSelect={(d) => d && setCursor(d)}
              locale={ptBR}
              modifiers={{ hasTasks: datesWithTasks }}
              modifiersClassNames={{
                hasTasks:
                  "relative font-bold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
              }}
              className="pointer-events-auto"
            />
            <div className="mt-3 px-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Prioridade</p>
              {Object.entries(priorityLabel).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className={cn("h-2 w-2 rounded-full", priorityColor[key])} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">
                {format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {dayTasks.length} {dayTasks.length === 1 ? "tarefa" : "tarefas"}
              </p>
            </div>
            {canEdit && <NewTaskMenu day={cursor} />}
          </CardHeader>
          <CardContent className="group" onClick={() => canEdit && openNewTaskDialog(cursor)}>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : dayTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</div>
            ) : (
              <ScrollArea className="max-h-[500px] pr-3">
                <Droppable droppableId={format(cursor, "yyyy-MM-dd")} type="CALENDAR_TASK">
                  {(dropProvided) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-2">
                      {dayTasks.map((task, idx) => {
                        const color = getTaskColor(task);
                        const done = task.status === "concluido";
                        return (
                        <Draggable key={task.id} draggableId={task.id} index={idx} isDragDisabled={!canEdit}>
                          {(dragProvided, snapshot) => (
                    <button
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                      className={cn("w-full text-left p-3 rounded-lg border border-l-4 transition-colors", snapshot.isDragging && "opacity-80")}
                      style={{ borderLeftColor: color, backgroundColor: `${color}15` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-sm flex items-center gap-1.5">
                          <span
                            role="button"
                            onClick={(e) => toggleTaskDone(task, e)}
                            className={cn(
                              "h-4 w-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                              done ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary",
                            )}
                            title={done ? "Marcar como não concluída" : "Marcar como concluída"}
                          >
                            {done && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                          </span>
                          {task.parent_task_id && (
                            <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                          )}
                          <span className={cn("line-clamp-2 leading-snug break-words", done && "line-through opacity-60")}>{task.title}</span>
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.due_time && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDueTime(task.due_time)}
                            </span>
                          )}
                          <Badge variant="outline" className="shrink-0">
                            <span className={cn("h-2 w-2 rounded-full mr-1.5", priorityColor[task.priority])} />
                            {priorityLabel[task.priority]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                      </div>
                    </button>
                          )}
                        </Draggable>
                        );
                      })}
                      {dropProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </ScrollArea>
            )}
            {canEdit && (
              <div className="flex justify-center mt-1" onClick={(e) => e.stopPropagation()}>
                <NewTaskMenu day={cursor} iconOnly />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

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

        <CalendarColorToggle colorMode={colorMode} onChange={setColorMode} className="ml-0 lg:ml-auto" />
      </div>

      {/* Calendar toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => changeViewMode(v as ViewMode)}
          className="border rounded-md p-0.5 bg-muted/40"
        >
          <ToggleGroupItem value="mes" className="h-8 px-3 text-xs data-[state=on]:bg-background">Mês</ToggleGroupItem>
          <ToggleGroupItem value="semana" className="h-8 px-3 text-xs data-[state=on]:bg-background">Semana</ToggleGroupItem>
          <ToggleGroupItem value="dia" className="h-8 px-3 text-xs data-[state=on]:bg-background">Dia</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2 w-full">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium flex-1 min-w-0 truncate text-center lowercase">{periodLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
            Hoje
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onCalendarDragEnd}>
        {viewMode === "mes" && (
          <CalendarMonthGrid
            cursor={cursor}
            getDayTasks={getTasksForDay}
            ItemComponent={TaskPill}
            getTaskKey={(t) => t.id}
            onDayClick={(d) => openNewTaskDialog(d)}
            onAddDay={canEdit ? openNewTaskDialog : undefined}
            getTaskColor={getTaskColor}
            dragEnabled={canEdit}
            renderOverflow={(day, dayTasks, overflow) => (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-muted-foreground hover:text-foreground text-left px-1.5"
                  >
                    +{overflow} mais
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium mb-2">{format(day, "d 'de' MMM", { locale: ptBR })}</p>
                  <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                    {dayTasks.map((t) => (
                      <TaskPill key={t.id} task={t} />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          />
        )}
        {viewMode === "semana" && (
          <CalendarWeekGrid
            cursor={cursor}
            getDayTasks={getTasksForDay}
            ItemComponent={TaskPill}
            getTaskKey={(t) => t.id}
            onDayClick={(d) => openNewTaskDialog(d)}
            onAddDay={canEdit ? openNewTaskDialog : undefined}
            getTaskColor={getTaskColor}
            dragEnabled={canEdit}
            renderDayFooterAction={canEdit ? (d) => <NewTaskMenu day={d} iconOnly /> : undefined}
          />
        )}
        {viewMode === "dia" && <DayView />}
      </DragDropContext>

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
