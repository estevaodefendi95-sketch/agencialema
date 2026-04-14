import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FolderKanban, CheckSquare, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ companies: 0, projects: 0, tasks: 0, pending: 0, overdue: 0 });

  useEffect(() => {
    const load = async () => {
      const [companies, projects, tasks] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("*"),
      ]);

      const allTasks = tasks.data || [];
      const pending = allTasks.filter((t) => t.status === "concluido").length;
      const today = new Date().toISOString().split("T")[0];
      const overdue = allTasks.filter((t) => t.due_date && t.due_date < today && t.status !== "aprovado" && t.status !== "concluido").length;

      setStats({
        companies: companies.count || 0,
        projects: projects.count || 0,
        tasks: allTasks.length,
        pending,
        overdue,
      });
    };
    load();
  }, []);

  const cards = [
    ...(isAdmin ? [{ title: "Empresas", value: stats.companies, icon: Building2, color: "text-primary", link: "/empresas" }] : []),
    { title: "Projetos", value: stats.projects, icon: FolderKanban, color: "text-primary", link: "/projetos" },
    { title: "Tarefas", value: stats.tasks, icon: CheckSquare, color: "text-primary", link: "/projetos" },
    { title: "Aguardando Aprovação", value: stats.pending, icon: Clock, color: "text-warning", link: "/projetos" },
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
    </div>
  );
}
