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
import { LayoutGrid, List, CalendarDays, FolderKanban, ChevronLeft, ChevronRight, Filter, CheckSquare, User } from "lucide-react";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { cn } from "@/lib/utils";
import {
  format, isSameDay, isSameMonth, isToday, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, addMonths, addWeeks, addDays,
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
  assigned_to: string | null;
  project_id: string;
  position: number;
  projects: { name: string; company_id: string; companies: { name: string } | null } | null;
};

type Profile = { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null };

const STATUS_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer", color: "#94a3b8" },
  { slug: "em_andamento", label: "Em Andamento", color: "#3B82F6" },
  { slug: "em_revisao", label: "Em Revisão", color: "#a855f7" },
  { slug: "concluido", label: "Concluído", color: "#22c55e" },
];

const PRIORITY_COLOR: Record<string, string> = {
  baixa: "bg-blue-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  urgente: "bg-red-500",
};
const PRIORITY_BORDER: Record<string, string> = {
  baixa: "border-blue-500",
  media: "border-yellow-500",
  alta: "border-orange-500",
  urgente: "border-red-500",
};
const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

type ViewMode = "cards" | "lista" | "calendario";
type CalMode = "mes" | "semana" | "dia";

export default function MyTasks() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem("mytasks-view") as ViewMode) || "cards");
  const [calMode, setCalMode] = useState<CalMode>(() => (localStorage.getItem("mytasks-cal") as CalMode) || "mes");
  const [cursor, setCursor] = useState<Date>(new Date());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(user?.id || "");

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");

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
      .select("id, title, description, status, priority, due_date, assigned_to, project_id, position, projects(name, company_id, companies(name))")
      .eq("assigned_to", uid)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro ao carregar tarefas", variant: "destructive" });
    }
    setTasks((data || []) as any);
    setLoading(false);
  }

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

  const TaskMini = ({ task }: { task: Task }) => (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${task.project_id}`); }}
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded text-xs flex items-center gap-1 bg-card hover:bg-accent border-l-2 truncate",
        PRIORITY_BORDER[task.priority],
      )}
      title={task.title}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_COLOR[task.priority])} />
      <span className="truncate">{task.title}</span>
    </button>
  );

  const selectedMember = members.find((m) => m.id === selectedUser);
  const selectedLabel = selectedUser === user?.id
    ? "Minhas tarefas"
    : `Tarefas de ${selectedMember?.nickname || selectedMember?.full_name || "usuário"}`;

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

        {isAdmin && (
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[260px] gap-2">
              <SelectValue placeholder="Ver tarefas de..." />
            </SelectTrigger>
            <SelectContent>
              {user && (
                <SelectItem value={user.id}>
                  <span className="flex items-center gap-2">
                    {(() => {
                      const me = members.find((m) => m.id === user.id);
                      return (
                        <AssigneeAvatar
                          url={me?.avatar_url}
                          name={me?.nickname || me?.full_name || "Eu"}
                        />
                      );
                    })()}
                    Eu mesmo
                  </span>
                </SelectItem>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {STATUS_COLUMNS.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.slug);
                  return (
                    <Droppable droppableId={col.slug} key={col.slug}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.droppableProps}
                          className="bg-muted/30 rounded-lg p-2 flex flex-col gap-2 min-h-[200px]"
                        >
                          <div className="flex items-center gap-2 px-1 pb-1 border-b">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                            <span className="text-sm font-medium">{col.label}</span>
                            <Badge variant="secondary" className="ml-auto">{colTasks.length}</Badge>
                          </div>
                          {colTasks.map((t, idx) => (
                            <Draggable key={t.id} draggableId={t.id} index={idx}>
                              {(p) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  onClick={() => navigate(`/projetos/${t.project_id}`)}
                                  className={cn(
                                    "p-3 rounded-md border bg-card cursor-pointer hover:border-primary transition-colors border-l-4",
                                    PRIORITY_BORDER[t.priority],
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      checked={t.status === "concluido"}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={(v) => toggleComplete(t, !!v)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-sm font-medium leading-tight", t.status === "concluido" && "line-through text-muted-foreground")}>
                                        {t.title}
                                      </p>
                                      {t.description && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                                        {t.projects?.name && (
                                          <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                            <FolderKanban className="h-3 w-3" />
                                            {t.projects.name}
                                          </span>
                                        )}
                                        {t.due_date && (
                                          <span>{format(parseISO(t.due_date), "dd MMM", { locale: ptBR })}</span>
                                        )}
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          <span className={cn("h-1.5 w-1.5 rounded-full mr-1", PRIORITY_COLOR[t.priority])} />
                                          {PRIORITY_LABEL[t.priority]}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {prov.placeholder}
                          {colTasks.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>
                          )}
                        </div>
                      )}
                    </Droppable>
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
                  <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
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
                      onClick={() => navigate(`/projetos/${t.project_id}`)}
                      className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 items-center hover:bg-accent/40 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={t.status === "concluido"}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(v) => toggleComplete(t, !!v)}
                      />
                      <span className={cn("truncate", t.status === "concluido" && "line-through text-muted-foreground")}>{t.title}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.projects?.name || "—"}</span>
                      <span className="text-xs">{t.due_date ? format(parseISO(t.due_date), "dd/MM/yy") : "—"}</span>
                      <Badge variant="outline" className="text-[11px] w-fit">
                        <span className={cn("h-1.5 w-1.5 rounded-full mr-1", PRIORITY_COLOR[t.priority])} />
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px] w-fit">{STATUS_COLUMNS.find(s => s.slug === t.status)?.label || t.status}</Badge>
                    </div>
                  ))}
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm font-medium min-w-[180px] text-center capitalize">{periodLabel}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
                </div>
              </div>

              {calMode === "mes" && <MonthGrid cursor={cursor} getDayTasks={getDayTasks} TaskMini={TaskMini} onDayClick={(d) => { setCursor(d); changeCalMode("dia"); }} />}
              {calMode === "semana" && <WeekGrid cursor={cursor} getDayTasks={getDayTasks} TaskMini={TaskMini} onDayClick={(d) => { setCursor(d); changeCalMode("dia"); }} />}
              {calMode === "dia" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base capitalize">{format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getDayTasks(cursor).length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</p>
                    ) : (
                      <div className="space-y-2">
                        {getDayTasks(cursor).map((t) => (
                          <div key={t.id} onClick={() => navigate(`/projetos/${t.project_id}`)}
                            className={cn("p-3 border rounded-lg hover:bg-accent/50 cursor-pointer border-l-4", PRIORITY_BORDER[t.priority])}>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={t.status === "concluido"} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => toggleComplete(t, !!v)} />
                              <span className={cn("font-medium text-sm flex-1", t.status === "concluido" && "line-through text-muted-foreground")}>{t.title}</span>
                              <Badge variant="outline">{PRIORITY_LABEL[t.priority]}</Badge>
                            </div>
                            {t.projects?.name && <p className="text-xs text-muted-foreground mt-1 ml-6">{t.projects.name}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MonthGrid({ cursor, getDayTasks, TaskMini, onDayClick }: any) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 bg-muted/40 border-b">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const dayTasks = getDayTasks(day);
          const visible = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[110px] border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-accent/30 transition-colors",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map((t: Task) => <TaskMini key={t.id} task={t} />)}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">+{overflow} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, getDayTasks, TaskMini, onDayClick }: any) {
  const ws = startOfWeek(cursor, { weekStartsOn: 0 });
  const we = endOfWeek(cursor, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: ws, end: we });
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const today = isToday(day);
          const dayTasks = getDayTasks(day);
          return (
            <div key={day.toISOString()} className="border-r last:border-r-0 flex flex-col min-h-[500px]">
              <button
                onClick={() => onDayClick(day)}
                className={cn("px-2 py-2 border-b text-left hover:bg-accent/30", today && "bg-primary/5")}
              >
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{format(day, "EEE", { locale: ptBR })}</div>
                <div className={cn("text-lg font-semibold inline-flex h-7 min-w-7 px-1 items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </div>
              </button>
              <div className="p-1.5 flex flex-col gap-1 flex-1 overflow-y-auto">
                {dayTasks.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground text-center mt-4">—</span>
                ) : dayTasks.map((t: Task) => <TaskMini key={t.id} task={t} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
