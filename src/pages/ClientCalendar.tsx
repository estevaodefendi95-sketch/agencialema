import { useEffect, useMemo, useState } from "react";
import {
  format,
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarDays, ChevronLeft, ChevronRight, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEntityColor, PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { CalendarMonthGrid, CalendarWeekGrid } from "@/components/CalendarMonthWeekDay";

type CalendarTask = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  project_id: string;
  projectName: string;
  color: string;
  assigned_to: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
};

const DEFAULT_STATUS_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer" },
  { slug: "em_andamento", label: "Em Andamento" },
  { slug: "concluido", label: "Concluído" },
  { slug: "aprovado", label: "Aprovado" },
];

type ViewMode = "mes" | "semana" | "dia";

export default function ClientCalendar() {
  const { user, avatarUrl } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [columnLabels, setColumnLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [cursor, setCursor] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("client-calendar-view-mode") as ViewMode) || "mes";
  });

  const changeViewMode = (m: ViewMode) => {
    if (!m) return;
    setViewMode(m);
    localStorage.setItem("client-calendar-view-mode", m);
  };

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
      setLoading(false);
      return;
    }

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, company_id, color")
      .in("company_id", companyIds)
      .eq("archived", false)
      .order("name");
    const projectIds = (projectsData || []).map((p: any) => p.id);
    setProjects((projectsData || []).map((p: any) => ({ id: p.id, name: p.name })));

    if (projectIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const [{ data: tasksData }, { data: columnsData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, due_date, status, project_id, color, assigned_to")
        .in("project_id", projectIds)
        .not("due_date", "is", null),
      supabase.from("project_columns").select("project_id, slug, label").in("project_id", projectIds),
    ]);

    const assigneeIds = Array.from(new Set((tasksData || []).map((t: any) => t.assigned_to).filter(Boolean)));
    let profileMap = new Map<string, { full_name: string | null; nickname: string | null; avatar_url: string | null }>();
    if (assigneeIds.length > 0) {
      const { data: profiles } = await (supabase.rpc as any)("get_profiles_by_ids", { _ids: assigneeIds });
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    const projectNameMap = new Map((projectsData || []).map((p: any) => [p.id, p.name as string]));
    const projectColorMap = new Map((projectsData || []).map((p: any) => [p.id, p.color as string | null]));
    const labelMap = new Map<string, string>();
    (columnsData || []).forEach((c: any) => labelMap.set(`${c.project_id}:${c.slug}`, c.label));
    setColumnLabels(labelMap);

    const enriched: CalendarTask[] = (tasksData || []).map((t: any) => {
      const isSelf = t.assigned_to && t.assigned_to === user.id;
      const profile = t.assigned_to ? profileMap.get(t.assigned_to) : null;
      return {
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        project_id: t.project_id,
        projectName: projectNameMap.get(t.project_id) || "Projeto",
        color: t.color || getEntityColor(t.project_id, projectColorMap.get(t.project_id) ?? null, PROJECT_COLOR_PALETTE),
        assigned_to: t.assigned_to,
        assigneeName: isSelf ? "Eu" : (profile?.nickname?.trim() || profile?.full_name || null),
        assigneeAvatarUrl: isSelf ? avatarUrl : (profile?.avatar_url ?? null),
      };
    });
    setTasks(enriched);
    setLoading(false);
  }

  function statusLabelFor(t: CalendarTask) {
    return (
      columnLabels.get(`${t.project_id}:${t.status}`) ||
      DEFAULT_STATUS_COLUMNS.find((d) => d.slug === t.status)?.label ||
      t.status
    );
  }

  const filteredTasks = useMemo(
    () => (projectFilter === "all" ? tasks : tasks.filter((t) => t.project_id === projectFilter)),
    [tasks, projectFilter],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    filteredTasks.forEach((t) => {
      const key = t.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTasks]);

  const getTasksForDay = (d: Date) => tasksByDay.get(format(d, "yyyy-MM-dd")) || [];
  const dayTasks = getTasksForDay(cursor);

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
  const goToday = () => setCursor(new Date());

  const openDayInDayView = (d: Date) => {
    setCursor(d);
    changeViewMode("dia");
  };

  const TaskPill = ({ task }: { task: CalendarTask }) => (
    <div
      className="w-full truncate rounded border-l-4 px-1.5 py-0.5 text-[11px] flex items-center gap-1"
      style={{ borderLeftColor: task.color, backgroundColor: `${task.color}15` }}
      title={task.title}
    >
      {(task.assigned_to || task.assigneeName) && (
        <AssigneeAvatar url={task.assigneeAvatarUrl} name={task.assigneeName} className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{task.title}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
          <p className="text-sm text-muted-foreground mt-1">Veja os prazos das tarefas dos seus projetos.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
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
          <span className="text-sm font-medium min-w-[160px] text-center lowercase">{periodLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
            Hoje
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {viewMode === "mes" && (
            <CalendarMonthGrid
              cursor={cursor}
              getDayTasks={getTasksForDay}
              ItemComponent={TaskPill}
              getTaskKey={(t) => t.id}
              onDayClick={openDayInDayView}
            />
          )}
          {viewMode === "semana" && (
            <CalendarWeekGrid
              cursor={cursor}
              getDayTasks={getTasksForDay}
              ItemComponent={TaskPill}
              getTaskKey={(t) => t.id}
              onDayClick={openDayInDayView}
            />
          )}
          {viewMode === "dia" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa neste dia</p>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-l-4 p-3" style={{ borderLeftColor: t.color, backgroundColor: `${t.color}15` }}>
                        <div className="flex items-center gap-2 min-w-0">
                          {(t.assigned_to || t.assigneeName) && (
                            <AssigneeAvatar url={t.assigneeAvatarUrl} name={t.assigneeName} className="h-5 w-5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <FolderKanban className="h-3 w-3" /> {t.projectName}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{statusLabelFor(t)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
