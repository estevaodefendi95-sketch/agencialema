import { useEffect, useMemo, useState } from "react";
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
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarTask = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  project_id: string;
  projectName: string;
};

const DEFAULT_STATUS_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer" },
  { slug: "em_andamento", label: "Em Andamento" },
  { slug: "concluido", label: "Concluído" },
  { slug: "aprovado", label: "Aprovado" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ClientCalendar() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [columnLabels, setColumnLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      .select("id, name, company_id")
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
        .select("id, title, due_date, status, project_id")
        .in("project_id", projectIds)
        .not("due_date", "is", null),
      supabase.from("project_columns").select("project_id, slug, label").in("project_id", projectIds),
    ]);

    const projectNameMap = new Map((projectsData || []).map((p: any) => [p.id, p.name as string]));
    const labelMap = new Map<string, string>();
    (columnsData || []).forEach((c: any) => labelMap.set(`${c.project_id}:${c.slug}`, c.label));
    setColumnLabels(labelMap);

    const enriched: CalendarTask[] = (tasksData || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      project_id: t.project_id,
      projectName: projectNameMap.get(t.project_id) || "Projeto",
    }));
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
  const selectedDayTasks = selectedDate ? getTasksForDay(selectedDate) : [];

  const periodLabel = format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  const navPrev = () => setCursor((c) => subMonths(c, 1));
  const navNext = () => setCursor((c) => addMonths(c, 1));
  const goToday = () => {
    setCursor(new Date());
    setSelectedDate(new Date());
  };

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

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
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="grid grid-cols-7 bg-muted/40 border-b">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const today = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayTasks = getTasksForDay(day);
              const visible = dayTasks.slice(0, 3);
              const overflow = dayTasks.length - visible.length;
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[100px] border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-accent/30 transition-colors",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                    isSelected && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full",
                      today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((t) => (
                      <div
                        key={t.id}
                        className="w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    ))}
                    {overflow > 0 && <span className="text-[10px] text-muted-foreground px-1.5">+{overflow} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base capitalize">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedDayTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <FolderKanban className="h-3 w-3" /> {t.projectName}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{statusLabelFor(t)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
