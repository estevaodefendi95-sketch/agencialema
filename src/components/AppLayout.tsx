import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAppSettings } from "@/hooks/useAppSettings";

export function AppLayout() {
  const { app_name, logo_url } = useAppSettings();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              {logo_url && <img src={logo_url} alt="Logo" className="h-7 w-7 object-contain rounded" />}
              <h1 className="text-lg font-semibold">{app_name}</h1>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
