import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex w-full" style={{ minHeight: "100dvh" }}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 flex items-center border-b px-4 gap-4 shrink-0"
            style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
          >
            <SidebarTrigger />
            <div className="flex-1 flex justify-center">
              <GlobalSearch />
            </div>
          </header>
          <main
            className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-x-clip"
            style={{
              paddingBottom: isMobile
                ? "calc(4.5rem + env(safe-area-inset-bottom))"
                : "max(1.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <Outlet />
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
