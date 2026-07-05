import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { Users, AlertTriangle, Zap } from "lucide-react";

type Member = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  tarefas_ativas: number;
  tarefas_aprovadas: number;
  tarefas_atrasadas: number;
  tarefas_urgentes: number;
};

export default function Team() {
  const { canEdit } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canEdit) return;
    load();
  }, [canEdit]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("team_workload")
      .select("*")
      .order("tarefas_ativas", { ascending: false });
    setMembers((data || []) as Member[]);
    setLoading(false);
  }

  if (!canEdit) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Equipe</h2>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum membro da equipe encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.user_id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <AssigneeAvatar url={m.avatar_url} name={m.full_name || m.email} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{m.full_name || m.email || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Tarefas ativas</span>
                  <span className="text-2xl font-bold">{m.tarefas_ativas}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{m.tarefas_aprovadas} aprovadas</Badge>
                  {m.tarefas_atrasadas > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {m.tarefas_atrasadas} atrasadas
                    </Badge>
                  )}
                  {m.tarefas_urgentes > 0 && (
                    <Badge className="gap-1 border-transparent bg-warning text-warning-foreground hover:bg-warning/80">
                      <Zap className="h-3 w-3" /> {m.tarefas_urgentes} urgentes
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
