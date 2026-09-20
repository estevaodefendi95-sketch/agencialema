import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, CalendarDays, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Minhas Tarefas", url: "/minhas-tarefas", icon: CheckSquare },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 min-h-[56px] border-t bg-background/95 backdrop-blur flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map((item) => {
        const active = isActive(item.url);
        return (
          <Link
            key={item.url}
            to={item.url}
            className={cn(
              "flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            <span className="text-[11px] leading-none">{item.title}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[11px] leading-none">Menu</span>
      </button>
    </nav>
  );
}
