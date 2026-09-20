import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setNotifications(data || []);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  };

  const openNotification = (n: Notification) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notificações</h2>
        <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
          <Check className="h-4 w-4" /> Marcar todas como lidas
        </Button>
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              n.read ? "bg-card" : "bg-primary/5 border-primary/20"
            }`}
            onClick={() => openNotification(n)}
          >
            <Bell className={`h-5 w-5 mt-0.5 ${n.read ? "text-muted-foreground" : "text-primary"}`} />
            <div className="flex-1">
              <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>{n.title}</p>
              {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma notificação</p>
          </div>
        )}
      </div>
    </div>
  );
}
