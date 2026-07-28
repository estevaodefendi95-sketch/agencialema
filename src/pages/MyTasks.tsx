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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { LayoutGrid, List, CalendarDays, FolderKanban, ChevronLeft, ChevronRight, Filter, CheckSquare, User, Plus, GripVertical, Clock, CornerDownRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { REMINDER_OPTIONS, formatDueTime } from "@/lib/taskReminders";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
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
  const [ntAssignee, setNtAssignee] = useState<string>("");
  const [ntStatus, setNtStatus] = useState<string | null>(null);
  const [isPersonal, setIsPersonal] = useState(false);

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
    const { data } = await supabase
      .from("project_members")
      .select("user_id, status, profiles(id, full_name, nickname, avatar_url)")
      .eq("project_id", projectId)
      .eq("status", "ativo");
    const list: Profile[] = ((data || []) as any[])
      .filter((m) => m.user_id && m.profiles)
      .map((m) => ({
        id: m.user_id,
        full_name: m.profiles.full_name,
        nickname: m.profiles.nickname,
        avatar_url: m.profiles.avatar_url,
      }));
    setProjectMembers(list);
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

    const { error } = await supabase.from("tasks").insert({
      project_id: isPersonal ? null : ntProject,
      title: ntTitle.trim(),
      description: ntDesc.trim() || null,
      priority: ntPriority,
      due_date: ntDue || null,
      due_time: ntHasDueTime && ntDueTime ? ntDueTime : null,
      reminder_minutes_before: ntHasDueTime && ntDueTime && ntReminderMinutes !== "none" ? parseInt(ntReminderMinutes, 10) : null,
      assigned_to: isPersonal ? user.id : (ntAssignee || user.id),
      status: initialStatus,
      created_by: user.id,
      position: 0,
    } as any);

    setCreating(false);
    if (error) {
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isPersonal ? "Tarefa pessoal criada" : "Tarefa criada" });
    setOpenNewTask(false);
    setNtCompany(""); setNtProject(""); setNtTitle(""); setNtDesc(""); setNtPriority("media");
    setNtDue(""); setNtHasDueTime(false); setNtDueTime(""); setNtReminderMinutes("none");
    setNtAssignee(""); setNtStatus(null); setIsPersonal(false);
    if (selectedUser) loadTasks(selectedUser);
  }

  function openNewTaskDialog(prefillDate?: Date, statusSlug?: string, personal?: boolean) {
    if (prefillDate) setNtDue(format(prefillDate, "yyyy-MM-dd"));
    else setNtDue("");
    setNtStatus(statusSlug ?? null);
    setIsPersonal(!!personal);
    if (personal) { setNtCompany(""); setNtProject(""); setNtAssignee(""); }
    setOpenNewTask(true);
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

    const taskList = [...((data || []) as any as Task[]), ...personalTasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    setTasks(taskList);
    await loadStatusColumns(taskList);
    setLoading(false);
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

  const TaskMini = ({ task }: { task: Task }) => {
    const color = getTaskColor(task);
    const assigneeProfile: { avatar_url: string | null; nickname?: string | null; full_name?: string | null; name?: string } | undefined =
      task.assigned_to === user?.id
        ? { avatar_url: avatarUrl, name: "Eu" }
        : members.find((m) => m.id === task.assigned_to);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (task.project_id) navigate(`/projetos/${task.project_id}`); }}
        className="w-full text-left px-1.5 py-0.5 rounded text-xs flex items-center gap-1 border-l-4 truncate"
        style={{ borderLeftColor: color, backgroundColor: `${color}15` }}
        title={task.title}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_COLOR[task.priority])} />
        {colorMode === "responsavel" && assigneeProfile && (
          <AssigneeAvatar
            url={assigneeProfile.avatar_url}
            name={assigneeProfile.nickname || assigneeProfile.full_name || assigneeProfile.name}
            className="h-4 w-4 shrink-0"
          />
        )}
        {task.parent_task_id && (
          <span title="Subtarefa"><CornerDownRight className="h-3 w-3 shrink-0" /></span>
        )}
        <span className="truncate min-w-0 flex-1">{task.title}</span>
      </button>
    );
  };

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
          {canEdit && (
            <Button onClick={() => openNewTaskDialog()} className="gap-2" size="sm">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => openNewTaskDialog(undefined, undefined, true)} variant="outline" className="gap-2" size="sm">
              <Plus className="h-4 w-4" /> Tarefa pessoal
            </Button>
          )}
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
                          <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-2 min-h-[100px]">
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
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <AssigneeAvatar url={viewedAvatarUrl} name={viewedName} className="h-5 w-5 shrink-0" />
                                            {t.parent_task_id && (
                                              <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                                            )}
                                            <p
                                              className={cn(
                                                "font-medium text-sm truncate",
                                                t.status === "concluido" && "line-through text-muted-foreground",
                                                t.project_id && "cursor-pointer hover:text-primary",
                                              )}
                                              onClick={() => { if (t.project_id) navigate(`/projetos/${t.project_id}`); }}
                                            >
                                              {t.title}
                                            </p>
                                          </div>
                                          {t.description && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                                          )}
                                          <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {prov.placeholder}
                          </div>
                        )}
                      </Droppable>
                      {canEdit && (
                        <div className="flex justify-center mt-auto pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openNewTaskDialog(undefined, col.slug)}
                            title="Nova tarefa nesta coluna"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
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
                      onClick={() => { if (t.project_id) navigate(`/projetos/${t.project_id}`); }}
                      className={cn("grid grid-cols-[auto_2fr_1fr_110px_130px_150px] gap-3 px-4 py-2.5 items-center hover:bg-accent/40 text-sm", t.project_id && "cursor-pointer")}
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
                  {canEdit && (
                    <Button size="sm" className="gap-1" onClick={() => openNewTaskDialog()}>
                      <Plus className="h-4 w-4" /> Nova
                    </Button>
                  )}
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
                />
              )}
              {calMode === "dia" && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base lowercase">{format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR })}</CardTitle>
                    {canEdit && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openNewTaskDialog(cursor)}>
                        <Plus className="h-4 w-4" /> Nova tarefa
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {getDayTasks(cursor).length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</p>
                    ) : (
                      <div className="space-y-2">
                        {getDayTasks(cursor).map((t) => {
                          const color = getTaskColor(t);
                          return (
                          <div key={t.id} onClick={() => { if (t.project_id) navigate(`/projetos/${t.project_id}`); }}
                            className={cn("p-3 border rounded-lg hover:bg-accent/50 border-l-4", t.project_id && "cursor-pointer")}
                            style={{ borderLeftColor: color, backgroundColor: `${color}15` }}>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={t.status === "concluido"} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => toggleComplete(t, !!v)} />
                              {colorMode === "responsavel" && (
                                <AssigneeAvatar url={viewedAvatarUrl} name={viewedName} className="h-5 w-5 shrink-0" />
                              )}
                              {t.parent_task_id && (
                                <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                              )}
                              <span className={cn("font-medium text-sm flex-1", t.status === "concluido" && "line-through text-muted-foreground")}>{t.title}</span>
                              <Badge variant="outline">{PRIORITY_LABEL[t.priority]}</Badge>
                            </div>
                            {t.project_id ? (
                              t.projects?.name && <p className="text-xs text-muted-foreground mt-1 ml-6">{t.projects.name}</p>
                            ) : (
                              <Badge variant="outline" className="text-[10px] ml-6 mt-1">Pessoal</Badge>
                            )}
                          </div>
                          );
                        })}
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
                  <Select value={ntCompany} onValueChange={(v) => { setNtCompany(v); setNtProject(""); setNtAssignee(""); }}>
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
                  <Select value={ntProject} onValueChange={(v) => { setNtProject(v); setNtAssignee(""); }} disabled={!ntCompany}>
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
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label className="text-sm">Prazo</Label>
                <Input type="date" value={ntDue} onChange={(e) => setNtDue(e.target.value)} />
              </div>
            </div>
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
                <Label className="text-sm">Responsável</Label>
                <Select value={ntAssignee || (user?.id ?? "")} onValueChange={setNtAssignee} disabled={!ntProject}>
                  <SelectTrigger>
                    <SelectValue placeholder={ntProject ? "Selecione" : "Escolha um projeto primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {user && (
                      <SelectItem value={user.id}>
                        <span className="flex items-center gap-2">
                          <AssigneeAvatar name="Eu" />
                          Eu mesmo
                        </span>
                      </SelectItem>
                    )}
                    {projectMembers.filter((m) => m.id !== user?.id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <AssigneeAvatar url={m.avatar_url} name={m.nickname || m.full_name} />
                          {m.nickname || m.full_name || m.id.slice(0, 8)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
    </div>
  );
}

