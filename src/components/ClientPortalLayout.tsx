import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut } from "lucide-react";

export function ClientPortalLayout() {
  const { signOut, user } = useAuth();
  const { app_name, logo_url } = useAppSettings();

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="h-14 flex items-center justify-between border-b bg-background px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2">
          {logo_url ? (
            <img src={logo_url} alt="Logo" className="h-7 w-7 object-contain rounded" />
          ) : (
            <LayoutDashboard className="h-6 w-6 text-primary" />
          )}
          <span className="font-semibold text-base">{app_name}</span>
        </div>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[220px]">
              {user.email}
            </span>
          )}
          <Button variant="ghost" size="sm" className="gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
