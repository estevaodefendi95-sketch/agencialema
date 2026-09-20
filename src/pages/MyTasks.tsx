import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { LayoutGrid, List, CalendarDays, FolderKanban, ChevronLeft, ChevronRight, Filter, CheckSquare, User, Plus, GripVertical, Clock, CornerDownRight, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { REMINDER_OPTIONS, formatDueTime } from "@/lib/taskReminders";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import TaskDetail from "@/components/TaskDetail";
import { CalendarTaskPill } from "@/components/CalendarTaskPill";
import { TaskCardMini } from "@/components/TaskCardMini";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { CalendarColorToggle } from "@/components/CalendarColorToggle";
import { CalendarMonthGrid, CalendarWeekGrid } from "@/components/CalendarMonthWeekDay";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getEntityColor, PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";
import { useCalendarColorMode } from "@/hooks/useCalendarColorMode";
import {
  format, isSameDay,
  startOfWeek, endOfWeek, addMonths, addWeeks, addDays,
  subMonths, subWeeks, isAfter, isBefore, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "baixa" | "media" | "alta" | "urgente";
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  project_id: string | null;
  created_by: string | null;
  parent_task_id: string | null;
  position: number;
  color: string | null;
  projects: { name: string; company_id: string; color: string | null; companies: { name: string } | null } | null;
};

type Profile = { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null };

type StatusColumn = { slug: string; label: string; color: string; position: number };

// Fallback usado apenas se a busca de project_columns falhar ou vier vazia
const DEFAULT_STATUS_COLUMNS: StatusColumn[] = [
  { slug: "a_fazer", label: "A Fazer", color: "#94a3b8", position: 0 },
  { slug: "em_andamento", label: "Em Andamento", color: "#3B82F6", position: 1 },
  { slug: "em_revisao", label: "Em Revisão", color: "#a855f7", position: 2 },
  { slug: "concluido", label: "Concluído", color: "#22c55e", position: 3 },
];

// Tarefas pessoais não têm project_columns (não pertencem a nenhum projeto),
// então usam sempre este conjunto fixo de 4 colunas.
const PERSONAL_STATUS_COLUMNS: StatusColumn[] = [
  { slug: "a_fazer", label: "A Fazer", color: "#94a3b8", position: 0 },
  { slug: "em_andamento", label: "Em Andamento", color: "#3B82F6", position: 1 },
  { slug: "concluido", label: "Concluído", color: "#22c55e", position: 2 },
  { slug: "aprovado", label: "Aprovado", color: "#a855f7", position: 3 },
];

const PRIORITY_COLOR: Record<string, string> = {
  baixa: "bg-blue-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  urgente: "bg-red-500",
};
// Mesmo mapa de PRIORITY_COLORS do KanbanBoard.tsx, usado só no badge de
// prioridade da visão Cards pra bater com o card do Kanban.
const PRIORITY_BADGE_BG: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/20 text-primary",
  alta: "bg-warning/20 text-warning",
  urgente: "bg-destructive/20 text-destructive",
};
const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type ViewMode = "cards" | "lista" | "calendario";
type CalMode = "mes" | "semana" | "dia";

export default function MyTasks() {
  const { user, isAdmin, canEdit, avatarUrl } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem("mytasks-view") as ViewMode) || "cards");
  const [calMode, setCalMode] = useState<CalMode>(() => (localStorage.getItem("mytasks-cal") as CalMode) || "mes");
  const [cursor, setCursor] = useState<Date>(new Date());
  const { colorMode, setColorMode, getTaskColor: getTaskColorForMode } = useCalendarColorMode();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusColumns, setStatusColumns] = useState<StatusColumn[]>(DEFAULT_STATUS_COLUMNS);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(user?.id || "");

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");

  // Nova tarefa
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string; company_id: string }[]>([]);
  const [projectMembers, setProjectMembers] = useState<Profile[]>([]);
  const [openNewTask, setOpenNewTask] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ntCompany, setNtCompany] = useState<string>("");
  const [ntProject, setNtProject] = useState<string>("");
  const [ntTitle, setNtTitle] = useState("");
  const [ntDesc, setNtDesc] = useState("");
  const [ntPriority, setNtPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [ntDue, setNtDue] = useState("");
  const [ntHasDueTime, setNtHasDueTime] = useState(false);
  const [ntDueTime, setNtDueTime] = useState("");
  const [ntReminderMinutes, setNtReminderMinutes] = useState("none");
  const [ntAssignees, setNtAssignees] = useState<string[]>([]);
  const [ntStatus, setNtStatus] = useState<string | null>(null);
  const [isPersonal, setIsPersonal] = useState(false);
  const [ntRecurrence, setNtRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [ntRecurrenceDays, setNtRecurrenceDays] = useState<number[]>([]);

  const changeView = (v: ViewMode) => {
    if (!v) return;
    setView(v);
    localStorage.setItem("mytasks-view", v);
  };
  const changeCalMode = (m: CalMode) => {
    if (!m) return;
    setCalMode(m);
    localStorage.setItem("mytasks-cal", m);
  };

  useEffect(() => {
    if (user) setSelectedUser(user.id);
  }, [user]);

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedUser) loadTasks(selectedUser);
  }, [selectedUser]);

  useEffect(() => {
    if (canEdit) {
      loadAllProjects();
      loadAllCompanies();
    }
  }, [canEdit]);

  useEffect(() => {
    if (ntProject) loadProjectMembers(ntProject);
    else setProjectMembers([]);
  }, [ntProject]);

  async function loadAllCompanies() {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    setAllCompanies((data || []) as any);
  }

  async function loadAllProjects() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, company_id")
      .eq("archived", false)
      .order("name");
    setAllProjects((data || []) as any);
  }

  async function loadProjectMembers(projectId: string) {
    const { data: proj } = await supabase.from("projects").select("company_id").eq("id", projectId).maybeSingle();
    if (!(proj as any)?.company_id) {
      setProjectMembers([]);
      return;
    }
    const [{ data: accessRows }, { data: adminProfiles }] = await Promise.all([
      (supabase.from as any)("user_company_access")
        .select("user_id, profiles(id, full_name, nickname, avatar_url, status)")
        .eq("company_id", (proj as any).company_id),
      (supabase.rpc as any)("get_admin_profiles"),
    ]);
    const byId: Record<string, Profile> = {};
    (accessRows || []).forEach((r: any) => {
      const p = r.profiles;
      if (p && p.status === "aprovado") {
        byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
      }
    });
    (adminProfiles || []).forEach((p: any) => {
      byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
    });
    setProjectMembers(Object.values(byId));
  }

  async function createTask() {
    if (!ntTitle.trim() || !user) return;
    if (!isPersonal && !ntProject) return;
    setCreating(true);
    // Status inicial: usa a coluna pré-selecionada (ex: "+" de uma coluna específica
    // no board), senão cai na primeira coluna do projeto (ou "a_fazer" pra pessoal).
    let initialStatus = ntStatus;
    if (!initialStatus) {
      if (isPersonal) {
        initialStatus = "a_fazer";
      } else {
        const { data: cols } = await supabase
          .from("project_columns")
          .select("slug")
          .eq("project_id", ntProject)
          .order("position", { ascending: true })
          .limit(1);
        initialStatus = cols?.[0]?.slug || "a_fazer";
      }
    }

    const primaryAssignee = isPersonal ? user.id : (ntAssignees[0] || user.id);
    const extraAssignees = isPersonal ? [] : ntAssignees.slice(1).filter((id) => id !== primaryAssignee);

    const { data: created, error } = await supabase.from("tasks").insert({
      project_id: isPersonal ? null : ntProject,
      title: ntTitle.trim(),
      description: ntDesc.trim() || null,
      priority: isPersonal ? "media" : ntPriority,
      due_date: ntDue || null,
      due_time: ntHasDueTime && ntDueTime ? ntDueTime : null,
      reminder_minutes_before: ntHasDueTime && ntDueTime && ntReminderMinutes !== "none" ? parseInt(ntReminderMinutes, 10) : null,
      assigned_to: primaryAssignee,
      status: initialStatus,
      created_by: user.id,
      position: 0,
      ...(isPersonal ? {
        recurrence_type: ntRecurrence,
        recurrence_days: ntRecurrence === "weekly" ? ntRecurrenceDays : null,
      } : {}),
    } as any).select().single();

    if (error) {
      setCreating(false);
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
      return;
    }

    if (created) {
      if (isPersonal) {
        const { error: assigneeError } = await (supabase.from as any)("task_assignees").insert({
          task_id: created.id, user_id: user.id, added_by: user.id,
        });
        if (assigneeError) {
          toast({ title: "Tarefa criada, mas houve erro ao registrar responsável", description: assigneeError.message, variant: "destructive" });
        }
      } else if (extraAssignees.length > 0) {
        const { error: extraError } = await (supabase.from as any)("task_assignees").insert(
          extraAssignees.map((uid) => ({ task_id: created.id, user_id: uid, added_by: user.id })),
        );
        if (extraError) {
          toast({ title: "Tarefa criada, mas houve erro ao adicionar responsáveis extras", description: extraError.message, variant: "destructive" });
        }
      }
    }

    setCreating(false);
    toast({ title: isPersonal ? "Tarefa pessoal criada" : "Tarefa criada" });
    setOpenNewTask(false);
    setNtCompany(""); setNtProject(""); setNtTitle(""); setNtDesc(""); setNtPriority("media");
    setNtDue(""); setNtHasDueTime(false); setNtDueTime(""); setNtReminderMinutes("none");
    setNtAssignees([]); setNtStatus(null); setIsPersonal(false);
    setNtRecurrence("none"); setNtRecurrenceDays([]);
    if (selectedUser) loadTasks(selectedUser);
  }

  function openNewTaskDialog(prefillDate?: Date, statusSlug?: string, personal?: boolean) {
    if (prefillDate) setNtDue(format(prefillDate, "yyyy-MM-dd"));
    else setNtDue("");
    setNtStatus(statusSlug ?? null);
    setIsPersonal(!!personal);
    setNtAssignees(user ? [user.id] : []);
    if (personal) { setNtCompany(""); setNtProject(""); }
    setNtRecurrence("none"); setNtRecurrenceDays([]);
    setOpenNewTask(true);
  }

  function NewTaskMenu({ prefillDate, statusSlug, iconOnly }: { prefillDate?: Date; statusSlug?: string; iconOnly?: boolean }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {iconOnly ? (
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
              title="Nova tarefa"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Button className="gap-2" size="sm">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openNewTaskDialog(prefillDate, statusSlug, false)}>
            <FolderKanban className="h-4 w-4 mr-2" /> Tarefa de projeto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openNewTaskDialog(prefillDate, statusSlug, true)}>
            <User className="h-4 w-4 mr-2" /> Tarefa pessoal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  async function saveTaskColor(taskId: string, color: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, color } : t)));
    await supabase.from("tasks").update({ color }).eq("id", taskId);
  }

  async function loadMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nickname, avatar_url, status")
      .eq("status", "aprovado")
      .order("full_name");
    setMembers((data || []) as Profile[]);
  }

  async function loadTasks(uid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, due_time, assigned_to, created_by, parent_task_id, project_id, position, color, projects(name, company_id, color, companies(name))")
      .eq("assigned_to", uid)
      .not("project_id", "is", null)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro ao carregar tarefas", variant: "destructive" });
    }

    // Tarefas onde o usuário é responsável adicional (não o principal).
    let extraTasks: Task[] = [];
    const { data: extraIds } = await (supabase.from as any)("task_assignees").select("task_id").eq("user_id", uid);
    const extraTaskIds = ((extraIds || []) as any[]).map((r) => r.task_id);
    if (extraTaskIds.length > 0) {
      const { data: extraData, error: extraError } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, due_time, assigned_to, created_by, parent_task_id, project_id, position, color, projects(name, company_id, color, companies(name))")
        .in("id", extraTaskIds)
        .not("project_id", "is", null);
      if (extraError) console.error(extraError);
      extraTasks = (extraData || []) as any as Task[];
    }

    // Tarefas pessoais (sem projeto) só existem e são visíveis para quem criou,
    // então só entram na lista quando o próprio usuário logado está sendo exibido.
    let personalTasks: Task[] = [];
    if (user && uid === user.id) {
      const { data: personalData, error: personalError } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, due_time, assigned_to, created_by, parent_task_id, project_id, position, color")
        .is("project_id", null)
        .eq("created_by", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (personalError) console.error(personalError);
      personalTasks = ((personalData || []) as any[]).map((t) => ({ ...t, projects: null })) as Task[];
    }

    const byId = new Map<string, Task>();
    [...((data || []) as any as Task[]), ...extraTasks, ...personalTasks].forEach((t) => byId.set(t.id, t));
    const taskList = Array.from(byId.values()).sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    setTasks(taskList);
    await loadStatusColumns(taskList);
    setLoading(false);
  }

  async function toggleTaskDone(task: Task, e?: React.MouseEvent) {
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

  // Colunas reais dos projetos das tarefas carregadas (cada projeto tem as suas em project_columns,
  // que podem divergir do conjunto padrão do Kanban — inclusive colunas personalizadas).
  async function loadStatusColumns(taskList: Task[]) {
    const hasPersonalTasks = taskList.some((t) => !t.project_id);
    const projectIds = Array.from(new Set(taskList.map((t) => t.project_id).filter((id): id is string => !!id)));

    const bySlug = new Map<string, StatusColumn>();

    if (projectIds.length > 0) {
      const { data } = await supabase
        .from("project_columns")
        .select("project_id, slug, label, color, position")
        .in("project_id", projectIds);

      // Combina por slug: se dois projetos compartilham o mesmo slug (ex: "a_fazer"), mantém
      // só o registro de menor position; slugs exclusivos (colunas personalizadas) entram à parte.
      (data as any[] || []).forEach((c) => {
        const existing = bySlug.get(c.slug);
        if (!existing || c.position < existing.position) {
          bySlug.set(c.slug, { slug: c.slug, label: c.label, color: c.color, position: c.position });
        }
      });
    }

    if (bySlug.size === 0) {
      DEFAULT_STATUS_COLUMNS.forEach((c) => bySlug.set(c.slug, c));
    }

    if (hasPersonalTasks) {
      // Tarefas pessoais não têm project_columns — garante que as 4 colunas
      // padrão delas sempre existam, sem sobrescrever colunas reais.
      let nextPos = Math.max(-1, ...Array.from(bySlug.values()).map((c) => c.position)) + 1;
      PERSONAL_STATUS_COLUMNS.forEach((c) => {
        if (!bySlug.has(c.slug)) {
          bySlug.set(c.slug, { ...c, position: nextPos++ });
        }
      });
    }

    setStatusColumns(Array.from(bySlug.values()).sort((a, b) => a.position - b.position));
  }

  const statusLabel = (slug: string) => statusColumns.find((s) => s.slug === slug)?.label || slug;

  // Filters
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.projects?.name) map.set(t.project_id, t.projects.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = addDays(today, 7);

    return tasks.filter((t) => {
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (dueFilter !== "all") {
        if (dueFilter === "no_date") return !t.due_date;
        if (!t.due_date) return false;
        const d = parseISO(t.due_date);
        if (dueFilter === "today") return isSameDay(d, today);
        if (dueFilter === "week") return !isBefore(d, today) && !isAfter(d, weekEnd);
        if (dueFilter === "overdue") return isBefore(d, today) && t.status !== "concluido";
      }
      return true;
    });
  }, [tasks, projectFilter, priorityFilter, dueFilter]);

  // Toggle complete
  async function toggleComplete(t: Task, done: boolean) {
    const newStatus = done ? "concluido" : "a_fazer";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)));
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", t.id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
    }
  }

  // DnD: change status by column
  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", draggableId);
  }

  // Calendar helpers
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      if (!t.due_date) return;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
    });
    return map;
  }, [filteredTasks]);
  const getDayTasks = (d: Date) => tasksByDay.get(format(d, "yyyy-MM-dd")) || [];

  const periodLabel = useMemo(() => {
    if (calMode === "mes") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (calMode === "semana") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(ws, "d MMM", { locale: ptBR })} – ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  }, [cursor, calMode]);

  const navPrev = () => {
    if (calMode === "mes") setCursor((c) => subMonths(c, 1));
    else if (calMode === "semana") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => addDays(c, -1));
  };
  const navNext = () => {
    if (calMode === "mes") setCursor((c) => addMonths(c, 1));
    else if (calMode === "semana") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };

  // Tarefas em Minhas Tarefas são todas do mesmo responsável (selectedUser),
  // então "Por Responsável" acaba dando a mesma cor pra tudo — ainda assim
  // mantém o toggle pra ficar consistente com os outros calendários.
  const getTaskColor = (task: Task) =>
    getTaskColorForMode({
      manualColor: task.color,
      projectId: task.project_id || "pessoal",
      projectColor: task.projects?.color,
      assignedTo: task.assigned_to,
    });

  const TaskMini = ({ task }: { task: Task }) => (
    <CalendarTaskPill
      task={task as any}
      color={getTaskColor(task)}
      colorMode={colorMode}
      priorityColor={PRIORITY_COLOR}
      onOpen={(t) => setSelectedTaskId(t.id)}
      onToggleDone={toggleTaskDone}
    />
  );

  const selectedMember = members.find((m) => m.id === selectedUser);
  const selectedLabel = selectedUser === user?.id
    ? "Minhas tarefas"
    : `Tarefas de ${selectedMember?.nickname || selectedMember?.full_name || "usuário"}`;
  // Todo card da lista é do mesmo responsável (selectedUser), então o avatar
  // ao lado da cor é sempre o dele — vindo do próprio perfil quando é "Eu".
  const viewedAvatarUrl = selectedUser === user?.id ? avatarUrl : selectedMember?.avatar_url || null;
  const viewedName = selectedUser === user?.id ? "Eu" : (selectedMember?.nickname || selectedMember?.full_name || null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{selectedLabel}</h1>
            <p className="text-sm text-muted-foreground">
              {filteredTasks.length} {filteredTasks.length === 1 ? "tarefa" : "tarefas"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && <NewTaskMenu />}
          {isAdmin && (
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[260px] gap-2">
              <SelectValue placeholder="Ver tarefas de..." />
            </SelectTrigger>
            <SelectContent>
              {user && (() => {
                const me = members.find((m) => m.id === user.id);
                const myName = me?.nickname || me?.full_name || "Eu";
                return (
                  <SelectItem value={user.id}>
                    <span className="flex items-center gap-2">
                      <AssigneeAvatar url={me?.avatar_url} name={myName} />
                      {myName}
                    </span>
                  </SelectItem>
                );
              })()}
              {members.filter((m) => m.id !== user?.id).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    <AssigneeAvatar url={m.avatar_url} name={m.nickname || m.full_name} />
                    {m.nickname || m.full_name || m.id.slice(0, 8)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-card">
        <ToggleGroup type="single" value={view} onValueChange={(v) => changeView(v as ViewMode)} variant="outline" size="sm">
          <ToggleGroupItem value="cards" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> Cards</ToggleGroupItem>
          <ToggleGroupItem value="lista" className="gap-1.5"><List className="h-4 w-4" /> Lista</ToggleGroupItem>
          <ToggleGroupItem value="calendario" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendário</ToggleGroupItem>
        </ToggleGroup>

        <div className="h-6 w-px bg-border" />

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projectOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={dueFilter} onValueChange={setDueFilter}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Próximos 7 dias</SelectItem>
            <SelectItem value="overdue">Atrasadas</SelectItem>
            <SelectItem value="no_date">Sem data</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* === CARDS / KANBAN === */}
          {view === "cards" && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-proximity scrollbar-hide px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {statusColumns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.slug);
                  return (
                    <div key={col.slug} className="group rounded-lg p-3 min-h-[200px] min-w-[280px] w-[280px] shrink-0 snap-start flex flex-col" style={{ backgroundColor: `${col.color}10` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: col.color }} />
                          <h3 className="font-semibold text-sm">{col.label}</h3>
                        </div>
                        <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                      </div>
                      <Droppable droppableId={col.slug}>
                        {(prov) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.droppableProps}
                            className={cn(
                              "space-y-2 min-h-[100px] flex flex-col",
                              colTasks.length === 0 && "flex-1 items-center justify-center",
                            )}
                          >
                            {colTasks.map((t, idx) => (
                              <Draggable key={t.id} draggableId={t.id} index={idx}>
                                {(p, snapshot) => (
                                  <div
                                    ref={p.innerRef}
                                    {...p.draggableProps}
                                    className={cn(
                                      "bg-card rounded-lg border overflow-hidden shadow-sm transition-shadow",
                                      snapshot.isDragging ? "shadow-lg" : "hover:shadow-md",
                                    )}
                                    style={{
                                      ...p.draggableProps.style,
                                      borderLeft: `4px solid ${t.color || getEntityColor(t.project_id || "pessoal", t.projects?.color ?? null, PROJECT_COLOR_PALETTE)}`,
                                    }}
                                  >
                                    <div className="p-3">
                                      <div className="flex items-start gap-2">
                                        <div {...p.dragHandleProps} className="mt-0.5 cursor-grab">
                                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <TaskCardMini
                                            title={t.title}
                                            isSubtask={!!t.parent_task_id}
                                            completed={t.status === "concluido"}
                                            onTitleClick={() => setSelectedTaskId(t.id)}
                                            description={t.description}
                                            badgesRow={
                                              <>
                                                {t.project_id ? (
                                                  t.projects?.name && (
                                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                      <FolderKanban className="h-3 w-3" />
                                                      {t.projects.name}
                                                    </span>
                                                  )
                                                ) : (
                                                  <Badge variant="outline" className="text-[10px]">Pessoal</Badge>
                                                )}
                                                <Badge className={`text-xs ${PRIORITY_BADGE_BG[t.priority] || ""}`} variant="secondary">
                                                  {PRIORITY_LABEL[t.priority]}
                                                </Badge>
                                                {t.due_date && (
                                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {format(parseISO(t.due_date), "dd MMM", { locale: ptBR })}
                                                    {t.due_time && ` ${formatDueTime(t.due_time)}`}
                                                  </span>
                                                )}
                                                {canEdit && (
                                                  <ColorSwatchPicker
                                                    value={t.color}
                                                    onChange={(c) => saveTaskColor(t.id, c)}
                                                    allowNone
                                                    triggerClassName="h-3.5 w-3.5 rounded-full shrink-0 border border-border ml-auto"
                                                  />
                                                )}
                                              </>
                                            }
                                            assignee={viewedName ? { avatarUrl: viewedAvatarUrl, name: viewedName } : null}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {prov.placeholder}
                            {colTasks.length === 0 && canEdit && (
                              <NewTaskMenu statusSlug={col.slug} iconOnly />
                            )}
                          </div>
                        )}
                      </Droppable>
                      {canEdit && colTasks.length > 0 && (
                        <div className="flex justify-center mt-1">
                          <NewTaskMenu statusSlug={col.slug} iconOnly />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          )}

          {/* === LISTA === */}
          {view === "lista" && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  <div className="grid grid-cols-[auto_2fr_1fr_110px_130px_150px] gap-3 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                    <span></span>
                    <span>Tarefa</span>
                    <span>Projeto</span>
                    <span>Prazo</span>
                    <span>Prioridade</span>
                    <span>Status</span>
                  </div>
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa</div>
                  ) : filteredTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="grid grid-cols-[auto_2fr_1fr_110px_130px_150px] gap-3 px-4 py-2.5 items-center hover:bg-accent/40 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={t.status === "concluido"}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(v) => toggleComplete(t, !!v)}
                      />
                      <span className={cn("flex items-center gap-1 min-w-0 truncate", t.status === "concluido" && "line-through text-muted-foreground")}>
                        {t.parent_task_id && (
                          <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                        )}
                        <span className="truncate">{t.title}</span>
                      </span>
                      {t.project_id ? (
                        <span className="text-xs text-muted-foreground truncate">{t.projects?.name || "—"}</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] w-fit">Pessoal</Badge>
                      )}
                      <span className="text-xs">
                        {t.due_date ? `${format(parseISO(t.due_date), "dd/MM/yy")}${t.due_time ? ` ${formatDueTime(t.due_time)}` : ""}` : "—"}
                      </span>
                      <Badge variant="outline" className="text-[11px] max-w-full truncate" title={PRIORITY_LABEL[t.priority]}>
                        <span className={cn("h-1.5 w-1.5 rounded-full mr-1 shrink-0", PRIORITY_COLOR[t.priority])} />
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px] max-w-full truncate" title={statusLabel(t.status)}>
                        {statusLabel(t.status)}
                      </Badge>
                    </div>
                  ))}
                  {canEdit && (
                    <button
                      onClick={() => openNewTaskDialog()}
                      className="w-full px-4 py-3 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Adicionar tarefa
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* === CALENDÁRIO === */}
          {view === "calendario" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg bg-card">
                <ToggleGroup type="single" value={calMode} onValueChange={(v) => changeCalMode(v as CalMode)} variant="outline" size="sm">
                  <ToggleGroupItem value="mes">Mês</ToggleGroupItem>
                  <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
                  <ToggleGroupItem value="dia">Dia</ToggleGroupItem>
                </ToggleGroup>
                <CalendarColorToggle colorMode={colorMode} onChange={setColorMode} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm font-medium min-w-[180px] text-center lowercase">{periodLabel}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
                  {canEdit && <NewTaskMenu />}
                </div>
              </div>

              {calMode === "mes" && (
                <CalendarMonthGrid
                  cursor={cursor}
                  getDayTasks={getDayTasks}
                  ItemComponent={TaskMini}
                  getTaskKey={(t) => t.id}
                  onDayClick={(d) => { setCursor(d); changeCalMode("dia"); }}
                  onAddDay={canEdit ? (d: Date) => openNewTaskDialog(d) : undefined}
                />
              )}
              {calMode === "semana" && (
                <CalendarWeekGrid
                  cursor={cursor}
                  getDayTasks={getDayTasks}
                  ItemComponent={TaskMini}
                  getTaskKey={(t) => t.id}
                  onDayClick={(d) => { setCursor(d); changeCalMode("dia"); }}
                  onAddDay={canEdit ? (d: Date) => openNewTaskDialog(d) : undefined}
                  renderDayFooterAction={canEdit ? (d) => <NewTaskMenu prefillDate={d} iconOnly /> : undefined}
                />
              )}
              {calMode === "dia" && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base lowercase">{format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR })}</CardTitle>
                    {canEdit && <NewTaskMenu prefillDate={cursor} />}
                  </CardHeader>
                  <CardContent className="group">
                    {getDayTasks(cursor).length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</p>
                    ) : (
                      <div className="space-y-2">
                        {getDayTasks(cursor).map((t) => {
                          const color = getTaskColor(t);
                          const done = t.status === "concluido";
                          return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTaskId(t.id)}
                            className="w-full text-left p-3 rounded-lg border border-l-4 transition-colors"
                            style={{ borderLeftColor: color, backgroundColor: `${color}15` }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-medium text-sm flex items-center gap-1.5">
                                <span
                                  role="button"
                                  onClick={(e) => toggleTaskDone(t, e)}
                                  className={cn(
                                    "h-4 w-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                                    done ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary",
                                  )}
                                  title={done ? "Marcar como não concluída" : "Marcar como concluída"}
                                >
                                  {done && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                                </span>
                                {t.parent_task_id && (
                                  <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                                )}
                                <span className={cn("line-clamp-2 leading-snug break-words", done && "line-through opacity-60")}>{t.title}</span>
                              </h3>
                              <div className="flex items-center gap-2 shrink-0">
                                {t.due_time && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {formatDueTime(t.due_time)}
                                  </span>
                                )}
                                <Badge variant="outline" className="shrink-0">
                                  <span className={cn("h-2 w-2 rounded-full mr-1.5", PRIORITY_COLOR[t.priority])} />
                                  {PRIORITY_LABEL[t.priority]}
                                </Badge>
                              </div>
                            </div>
                            {t.project_id ? (
                              t.projects?.name && <p className="text-xs text-muted-foreground ml-6">{t.projects.name}</p>
                            ) : (
                              <Badge variant="outline" className="text-[10px] ml-6">Pessoal</Badge>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex justify-center mt-1">
                        <NewTaskMenu prefillDate={cursor} iconOnly />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialog: Nova Tarefa */}
      <Dialog open={openNewTask} onOpenChange={setOpenNewTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isPersonal ? "Nova Tarefa Pessoal" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!isPersonal && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">Empresa *</Label>
                  <Select value={ntCompany} onValueChange={(v) => { setNtCompany(v); setNtProject(""); setNtAssignees(user ? [user.id] : []); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma empresa..." /></SelectTrigger>
                    <SelectContent>
                      {allCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Projeto *</Label>
                  <Select value={ntProject} onValueChange={(v) => { setNtProject(v); setNtAssignees(user ? [user.id] : []); }} disabled={!ntCompany}>
                    <SelectTrigger><SelectValue placeholder={ntCompany ? "Selecione um projeto..." : "Escolha uma empresa primeiro"} /></SelectTrigger>
                    <SelectContent>
                      {allProjects.filter((p) => p.company_id === ntCompany).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">Título *</Label>
              <Input value={ntTitle} onChange={(e) => setNtTitle(e.target.value)} placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descrição</Label>
              <Textarea value={ntDesc} onChange={(e) => setNtDesc(e.target.value)} rows={3} />
            </div>
            <div className={cn("grid gap-3", isPersonal ? "grid-cols-1" : "grid-cols-2")}>
              {!isPersonal && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Prioridade</Label>
                  <Select value={ntPriority} onValueChange={(v) => setNtPriority(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">Prazo</Label>
                <Input type="date" value={ntDue} onChange={(e) => setNtDue(e.target.value)} />
              </div>
            </div>
            {isPersonal && (
              <div className="space-y-1.5">
                <Label className="text-sm">Recorrência</Label>
                <Select
                  value={ntRecurrence}
                  onValueChange={(v) => {
                    setNtRecurrence(v as typeof ntRecurrence);
                    if (v !== "weekly") setNtRecurrenceDays([]);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não repetir</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPersonal && ntRecurrence === "weekly" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Repetir nos dias</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNtRecurrenceDays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx])}
                      className={cn(
                        "h-8 w-8 rounded-full text-xs font-medium border transition-colors",
                        ntRecurrenceDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Definir horário</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ntHasDueTime}
                  onCheckedChange={(checked) => {
                    setNtHasDueTime(checked);
                    if (!checked) { setNtDueTime(""); setNtReminderMinutes("none"); }
                  }}
                />
                {ntHasDueTime && (
                  <Input type="time" value={ntDueTime} onChange={(e) => setNtDueTime(e.target.value)} className="h-9 w-32" />
                )}
              </div>
            </div>
            {ntHasDueTime && ntDueTime && (
              <div className="space-y-1.5">
                <Label className="text-sm">Notificar</Label>
                <Select value={ntReminderMinutes} onValueChange={setNtReminderMinutes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isPersonal && (
              <div className="space-y-1.5">
                <Label className="text-sm">Responsáveis</Label>
                <AssigneeMultiSelect
                  profiles={projectMembers}
                  selected={ntAssignees}
                  onChange={setNtAssignees}
                  currentUserId={user?.id}
                  disabled={!ntProject}
                  placeholder={ntProject ? "Selecione um ou mais responsáveis..." : "Escolha um projeto primeiro"}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewTask(false)}>Cancelar</Button>
            <Button
              onClick={createTask}
              disabled={(!isPersonal && (!ntCompany || !ntProject)) || !ntTitle.trim() || creating}
            >
              {creating ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => { setSelectedTaskId(null); if (selectedUser) loadTasks(selectedUser); }}
          onTaskDeleted={() => { setSelectedTaskId(null); if (selectedUser) loadTasks(selectedUser); }}
        />
      )}
    </div>
  );
}

