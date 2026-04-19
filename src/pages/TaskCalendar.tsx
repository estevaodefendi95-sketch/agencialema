import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, Building2, FolderKanban, X } from "lucide-react";
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
};

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

export default function TaskCalendar() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

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

    const enriched = (data || []).map((t: any) => ({
      ...t,
      assignee: t.assigned_to ? assigneeMap[t.assigned_to] || null : null,
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
    const map = new Map<string, string>();
    const freeSet = new Map<string, string>(); // lower -> original
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
      map.set(t.assigned_to, name);
    });
    const list = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
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

  const datesWithTasks = useMemo(
    () => filteredTasks.map((t) => new Date(t.due_date + "T00:00:00")),
    [filteredTasks],
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return filteredTasks.filter((t) => isSameDay(new Date(t.due_date + "T00:00:00"), selectedDate));
  }, [filteredTasks, selectedDate]);

  const hasFilters = companyFilter !== "all" || assigneeFilter !== "all";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Calendário de Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Visualize todas as tarefas com prazo das empresas que você tem acesso
          </p>
        </div>
      </div>

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
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {assigneeOptions.hasUnassigned && (
              <SelectItem value="none">Sem responsável</SelectItem>
            )}
            {assigneeOptions.list.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCompanyFilter("all"); setAssigneeFilter("all"); }}
          >
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              modifiers={{ hasTasks: datesWithTasks }}
              modifiersClassNames={{
                hasTasks: "relative font-bold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
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
              {selectedDate
                ? format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
                : "Selecione um dia"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedTasks.length} {selectedTasks.length === 1 ? "tarefa" : "tarefas"}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : selectedTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma tarefa neste dia
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-3">
                <div className="space-y-2">
                  {selectedTasks.map((task) => (
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
                              {task.assignee?.avatar_url && (
                                <AvatarImage src={task.assignee.avatar_url} />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {(((task.assignee as any)?.nickname?.trim() || task.assignee?.full_name || task.assignee_name) || "?")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{(task.assignee as any)?.nickname?.trim() || task.assignee?.full_name || task.assignee_name}</span>
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
    </div>
  );
}
