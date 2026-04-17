import {
  LayoutDashboard, Building2, FolderKanban, Users, Bell, LogOut, Sun, Moon, Settings, CalendarDays,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const { app_name, logo_url } = useAppSettings();
  const collapsed = state === "collapsed";

  const baseItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Empresas", url: "/empresas", icon: Building2 },
    { title: "Projetos", url: "/projetos", icon: FolderKanban },
    { title: "Calendário", url: "/calendario", icon: CalendarDays },
  ];

  const managerItems = isAdmin
    ? [
        { title: "Usuários", url: "/admin/usuarios", icon: Users },
        { title: "Notificações", url: "/notificacoes", icon: Bell },
        { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
      ]
    : [{ title: "Notificações", url: "/notificacoes", icon: Bell }];

  const items = [...baseItems, ...managerItems];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            {logo_url ? (
              <img src={logo_url} alt="Logo" className="h-5 w-5 object-contain rounded" />
            ) : (
              <LayoutDashboard className="h-4 w-4" />
            )}
            {!collapsed && <span className="font-bold text-base">{app_name}</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
