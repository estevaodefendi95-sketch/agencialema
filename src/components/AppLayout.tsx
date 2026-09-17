import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex w-full" style={{ minHeight: "100dvh" }}>
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header
            className="h-14 flex items-center border-b px-4 gap-4 shrink-0"
            style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
          >
            <SidebarTrigger />
            <div className="flex-1 flex justify-center">
              <GlobalSearch />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
