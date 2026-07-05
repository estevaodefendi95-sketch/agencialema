import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  FolderKanban,
  CheckSquare,
  Clock,
  AlertTriangle,
  AlertCircle,
  Activity,
  MessageSquare,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  FilePlus2,
  Undo2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type PendingTask = {
  id: string;
  title: string;
  due_date: string | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  project_id: string;
  projects: { name: string } | null;
};

type ActivityItem = {
  id: string;
  kind: "task" | "project";
  action: string;
  actorName: string;
  label: string;
  created_at: string;
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

const PROJECT_ACTION_LABELS: Record<string, string> = {
  create: "criou o projeto",
  update: "atualizou o projeto",
  archive: "arquivou o projeto",
  unarchive: "desarquivou o projeto",
  delete: "excluiu o projeto",
  undo: "desfez uma alteração no projeto",
};

function getActivityIcon(kind: "task" | "project", action: string) {
  const a = action.toLowerCase();
  if (a.includes("coment")) return MessageSquare;
  if (kind === "project") {
    if (a === "create") return FilePlus2;
    if (a === "archive") return Archive;
    if (a === "unarchive") return ArchiveRestore;
    if (a === "delete") return Trash2;
    if (a === "undo") return Undo2;
    return Pencil;
  }
  if (a.includes("edit")) return Pencil;
  if (a.includes("exclu")) return Trash2;
  return CheckSquare;
}

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ companies: 0, projects: 0, tasks: 0, pendingUsers: 0, overdue: 0 });
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [companies, projects, tasksCount, overdueCount, pendingUsersRes] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .lt("due_date", today)
          .not("status", "in", "(aprovado,concluido)"),
        isAdmin
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pendente")
          : Promise.resolve({ count: 0 } as any),
      ]);

      setStats({
        companies: companies.count || 0,
        projects: projects.count || 0,
        tasks: tasksCount.count || 0,
        pendingUsers: pendingUsersRes.count || 0,
        overdue: overdueCount.count || 0,
      });
    };
    load();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;

    const loadPending = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, status, project_id, projects(name)")
        .eq("assigned_to", user.id)
        .or(`due_date.lt.${today},priority.eq.urgente`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);

      const filtered = ((data || []) as any[])
        .filter((t) => t.status !== "aprovado" && t.status !== "concluido")
        .slice(0, 5);
      setPendingTasks(filtered as PendingTask[]);
    };
    loadPending();
  }, [user]);

  useEffect(() => {
    const loadActivity = async () => {
      const [taskHistoryRes, projectHistoryRes] = await Promise.all([
        supabase
          .from("task_history")
          .select("id, action, created_at, tasks(title), profiles:user_id(full_name, nickname)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("project_history")
          .select("id, action, created_at, projects(name), profiles:user_id(full_name, nickname)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const taskItems: ActivityItem[] = ((taskHistoryRes.data || []) as any[]).map((h) => ({
        id: `task-${h.id}`,
        kind: "task",
        action: h.action,
        actorName: h.profiles?.nickname?.trim() || h.profiles?.full_name || "Alguém",
        label: `${h.action}${h.tasks?.title ? ` "${h.tasks.title}"` : ""}`,
        created_at: h.created_at,
      }));

      const projectItems: ActivityItem[] = ((projectHistoryRes.data || []) as any[]).map((p) => ({
        id: `project-${p.id}`,
        kind: "project",
        action: p.action,
        actorName: p.profiles?.nickname?.trim() || p.profiles?.full_name || "Alguém",
        label: `${PROJECT_ACTION_LABELS[p.action] || p.action}${p.projects?.name ? ` "${p.projects.name}"` : ""}`,
        created_at: p.created_at,
      }));

      const merged = [...taskItems, ...projectItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
      setActivity(merged);
    };
    loadActivity();
  }, []);

  const cards = [
    ...(isAdmin ? [{ title: "Empresas", value: stats.companies, icon: Building2, color: "text-primary", link: "/empresas" }] : []),
    { title: "Projetos", value: stats.projects, icon: FolderKanban, color: "text-primary", link: "/projetos" },
    { title: "Tarefas", value: stats.tasks, icon: CheckSquare, color: "text-primary", link: "/projetos" },
    ...(isAdmin ? [{ title: "Aguardando Aprovação", value: stats.pendingUsers, icon: Clock, color: "text-warning", link: "/admin/usuarios?tab=pendentes" }] : []),
    { title: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-destructive", link: "/projetos" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {isAdmin ? "Painel do Administrador" : "Meus Projetos"}
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(card.link)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-destructive" /> Minhas pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Você está em dia! 🎉</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/projetos/${t.project_id}`)}
                    className="w-full text-left p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{t.title}</span>
                      <Badge variant="outline" className="shrink-0">
                        <span className={cn("h-2 w-2 rounded-full mr-1.5", priorityColor[t.priority])} />
                        {priorityLabel[t.priority]}
                      </Badge>
                    </div>
                    {t.projects?.name && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {t.projects.name}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" /> Atividade recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-3">
                {activity.map((a) => {
                  const Icon = getActivityIcon(a.kind, a.action);
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 text-sm">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate">
                          <span className="font-medium">{a.actorName}</span>{" "}
                          <span className="text-muted-foreground">{a.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
