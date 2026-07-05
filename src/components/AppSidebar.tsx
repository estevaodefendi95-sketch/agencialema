import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, FolderKanban, Users, Bell, LogOut, Sun, Moon, Settings, CalendarDays, UserCircle, ChevronRight, CheckSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";

type SectionItem = { title: string; url: string; icon: typeof LayoutDashboard };
type Section = { label: string; items: SectionItem[]; defaultOpen: boolean };

const STORAGE_KEY = "sidebar-sections-open";

export function AppSidebar() {
  const { isAdmin, canEdit, signOut, avatarUrl, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const { app_name, logo_url } = useAppSettings();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const sections: Section[] = [
    {
      label: "Principal",
      defaultOpen: true,
      items: [
        { title: "Dashboard", url: "/", icon: LayoutDashboard },
        { title: "Minhas Tarefas", url: "/minhas-tarefas", icon: CheckSquare },
        { title: "Calendário", url: "/calendario", icon: CalendarDays },
      ],
    },
    {
      label: "Gestão",
      defaultOpen: false,
      items: [
        { title: "Empresas", url: "/empresas", icon: Building2 },
        { title: "Projetos", url: "/projetos", icon: FolderKanban },
        ...(canEdit ? [{ title: "Equipe", url: "/equipe", icon: Users }] : []),
      ],
    },
    ...(isAdmin
      ? [{
          label: "Admin",
          defaultOpen: false,
          items: [
            { title: "Usuários", url: "/admin/usuarios", icon: Users },
            { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
          ],
        } as Section]
      : []),
    {
      label: "Conta",
      defaultOpen: false,
      items: [
        { title: "Notificações", url: "/notificacoes", icon: Bell },
        { title: "Meu Perfil", url: "/perfil", icon: UserCircle },
      ],
    },
  ];

  const isItemActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    let stored: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {}
    const initial: Record<string, boolean> = {};
    for (const s of sections) {
      initial[s.label] = stored[s.label] ?? s.defaultOpen;
    }
    return initial;
  });

  // Auto-abrir seção da rota ativa
  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of sections) {
        if (s.items.some((i) => isItemActive(i.url)) && !next[s.label]) {
          next[s.label] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isAdmin]);

  const handleOpenChange = (label: string, open: boolean) => {
    setOpenMap((prev) => {
      const next = { ...prev, [label]: open };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const renderMenu = (items: SectionItem[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const isProfile = item.url === "/perfil";
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                end={item.url === "/"}
                className="hover:bg-sidebar-accent/50"
                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
              >
                {isProfile ? (
                  <AssigneeAvatar
                    url={avatarUrl}
                    name={user?.email || "Eu"}
                    className="mr-2 h-4 w-4"
                  />
                ) : (
                  <item.icon className="mr-2 h-4 w-4" />
                )}
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          {logo_url ? (
            <img src={logo_url} alt="Logo" className="h-6 w-6 object-contain rounded shrink-0" />
          ) : (
            <LayoutDashboard className="h-5 w-5 shrink-0" />
          )}
          {!collapsed && <span className="font-bold text-base truncate">{app_name}</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => {
          // Modo colapsado: sem agrupamento visual, só ícones
          if (collapsed) {
            return (
              <SidebarGroup key={section.label}>
                <SidebarGroupContent>{renderMenu(section.items)}</SidebarGroupContent>
              </SidebarGroup>
            );
          }

          const open = openMap[section.label] ?? section.defaultOpen;
          return (
            <Collapsible
              key={section.label}
              open={open}
              onOpenChange={(o) => handleOpenChange(section.label, o)}
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground flex items-center justify-between w-full transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>{renderMenu(section.items)}</SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="space-y-1 p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && (theme === "light" ? "Modo escuro" : "Modo claro")}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
