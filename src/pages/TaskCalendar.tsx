import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Building2, FolderKanban, X, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { cn } from "@/lib/utils";

type TaskWithRelations = {
  id: string;
  title: string;
  due_date: string;
  priority: "baixa" | "media" | "alta" | "urgente";
  assigned_to: string | null;
  assignee_name: string | null;
  project_id: string;
  projects: { name: string; company_id: string; companies: { name: string; logo_url: string | null } | null } | null;
  assignee?: { full_name: string | null; nickname?: string | null; avatar_url: string | null } | null;
  comment_count?: number;
};

type ViewMode = "mes" | "semana" | "dia";

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

export default function TaskCalendar() {
  const navigate = useNavigate();
  const { avatarUrl, user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [cursor, setCursor] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("calendar-view-mode") as ViewMode) || "mes";
  });
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const changeViewMode = (m: ViewMode) => {
    if (!m) return;
    setViewMode(m);
    localStorage.setItem("calendar-view-mode", m);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, assigned_to, assignee_name, project_id, projects(name, company_id, companies(name, logo_url))")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const assigneeIds = Array.from(new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean)));
    let assigneeMap: Record<string, { full_name: string | null; nickname: string | null; avatar_url: string | null }> = {};
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url")
        .in("id", assigneeIds);
      (profiles || []).forEach((p: any) => {
        assigneeMap[p.id] = { full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
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

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      const c = t.projects?.companies;
      const id = t.projects?.company_id;
      if (id && c?.name) map.set(id, c.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { name: string; avatar_url: string | null }>();
    const freeSet = new Map<string, string>();
    let hasUnassigned = false;
    tasks.forEach((t) => {
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
    const list = Array.from(map.entries()).map(([id, v]) => ({ id, name: v.name, avatar_url: v.avatar_url }));
    const freeNames = Array.from(freeSet.values()).sort((a, b) => a.localeCompare(b));
    return { list, hasUnassigned, freeNames };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (companyFilter !== "all" && t.projects?.company_id !== companyFilter) return false;
      if (assigneeFilter === "all") return true;
      if (assigneeFilter === "none") return !t.assigned_to && !t.assignee_name;
      if (assigneeFilter.startsWith("name:")) {
        const target = assigneeFilter.slice(5).toLowerCase();
        return !t.assigned_to && (t.assignee_name || "").trim().toLowerCase() === target;
      }
      return t.assigned_to === assigneeFilter;
    });
  }, [tasks, companyFilter, assigneeFilter]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    filteredTasks.forEach((t) => {
      const key = t.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTasks]);

  const getTasksForDay = (d: Date) => tasksByDay.get(format(d, "yyyy-MM-dd")) || [];

  const datesWithTasks = useMemo(
    () => filteredTasks.map((t) => new Date(t.due_date + "T00:00:00")),
    [filteredTasks],
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return filteredTasks.filter((t) => isSameDay(new Date(t.due_date + "T00:00:00"), selectedDate));
  }, [filteredTasks, selectedDate]);

  const hasFilters = companyFilter !== "all" || assigneeFilter !== "all";

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

  const openDayInDayView = (d: Date) => {
    setCursor(d);
    setSelectedDate(d);
    changeViewMode("dia");
  };

  // Pill
  const TaskPill = ({ task }: { task: TaskWithRelations }) => (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${task.project_id}`); }}
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded text-xs flex items-center gap-1 bg-card hover:bg-accent border-l-2 truncate",
        priorityBorder[task.priority],
      )}
      title={task.title}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityColor[task.priority])} />
      <span className="truncate">{task.title}</span>
    </button>
  );

  // ========== Month View ==========
  const MonthView = () => {
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
            <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            const dayTasks = getTasksForDay(day);
            const visible = dayTasks.slice(0, 3);
            const overflow = dayTasks.length - visible.length;
            return (
              <div
                key={day.toISOString()}
                onClick={() => openDayInDayView(day)}
                className={cn(
                  "min-h-[110px] border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-accent/30 transition-colors",
                  !inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full",
                      today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {visible.map((t) => (
                    <TaskPill key={t.id} task={t} />
                  ))}
                  {overflow > 0 && (
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== Week View ==========
  const WeekView = () => {
    const ws = startOfWeek(cursor, { weekStartsOn: 0 });
    const we = endOfWeek(cursor, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: ws, end: we });

    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const today = isToday(day);
            const dayTasks = getTasksForDay(day);
            return (
              <div
                key={day.toISOString()}
                className="border-r last:border-r-0 flex flex-col min-h-[500px]"
              >
                <button
                  onClick={() => openDayInDayView(day)}
                  className={cn(
                    "px-2 py-2 border-b text-left hover:bg-accent/30 transition-colors",
                    today && "bg-primary/5",
                  )}
                >
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold inline-flex h-7 min-w-7 px-1 items-center justify-center rounded-full",
                      today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </button>
                <div className="p-1.5 flex flex-col gap-1 flex-1 overflow-y-auto">
                  {dayTasks.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground text-center mt-4">—</span>
                  ) : (
                    dayTasks.map((t) => <TaskPill key={t.id} task={t} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
          <CardHeader>
            <CardTitle className="text-lg">
              {format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {dayTasks.length} {dayTasks.length === 1 ? "tarefa" : "tarefas"}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : dayTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</div>
            ) : (
              <ScrollArea className="h-[500px] pr-3">
                <div className="space-y-2">
                  {dayTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => navigate(`/projetos/${task.project_id}`)}
                      className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-sm">{task.title}</h3>
                        <Badge variant="outline" className="shrink-0">
                          <span className={cn("h-2 w-2 rounded-full mr-1.5", priorityColor[task.priority])} />
                          {priorityLabel[task.priority]}
                        </Badge>
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
                        {(task.assignee || task.assignee_name) && (
                          <span className="flex items-center gap-1.5 ml-auto">
                            <Avatar className="h-5 w-5">
                              {task.assignee?.avatar_url && <AvatarImage src={task.assignee.avatar_url} />}
                              <AvatarFallback className="text-[10px]">
                                {(((task.assignee as any)?.nickname?.trim() || task.assignee?.full_name || task.assignee_name) || "?")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {(task.assignee as any)?.nickname?.trim() || task.assignee?.full_name || task.assignee_name}
                            </span>
                          </span>
                        )}
                        {(task.comment_count || 0) > 0 && (
                          <span
                            className={cn("flex items-center gap-1", !(task.assignee || task.assignee_name) && "ml-auto")}
                            title="Comentários"
                          >
                            <MessageSquare className="h-3 w-3" />
                            {task.comment_count}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Calendário de Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Visualize todas as tarefas com prazo das empresas que você tem acesso
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companyOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-full sm:w-[240px] gap-2">
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

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setCompanyFilter("all"); setAssigneeFilter("all"); }}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Calendar toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center capitalize">{periodLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
            Hoje
          </Button>
        </div>
      </div>

      {viewMode === "mes" && <MonthView />}
      {viewMode === "semana" && <WeekView />}
      {viewMode === "dia" && <DayView />}
    </div>
  );
}
