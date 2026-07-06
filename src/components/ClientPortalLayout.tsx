import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, LayoutGrid, CheckSquare, CalendarDays, LogOut } from "lucide-react";

const PORTAL_TABS = [
  { title: "Visão Geral", to: "/portal", icon: LayoutGrid, end: true },
  { title: "Tarefas", to: "/portal/tarefas", icon: CheckSquare, end: false },
  { title: "Calendário", to: "/portal/calendario", icon: CalendarDays, end: false },
];

export function ClientPortalLayout() {
  const { signOut, user } = useAuth();
  const { app_name, logo_url } = useAppSettings();

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="h-14 flex items-center justify-between border-b bg-background px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center shrink-0 overflow-hidden rounded-md bg-muted h-8 w-8">
            {logo_url ? (
              <img src={logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <LayoutDashboard className="h-5 w-5 text-primary" />
            )}
          </div>
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
      <nav className="border-b bg-background px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-1 -mb-px">
          {PORTAL_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent hover:text-foreground transition-colors"
              activeClassName="text-primary border-primary"
            >
              <tab.icon className="h-4 w-4" />
              {tab.title}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
