import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import PendingApproval from "@/pages/PendingApproval";
import Dashboard from "@/pages/Dashboard";
import Companies from "@/pages/Companies";
import Projects from "@/pages/Projects";
import KanbanBoard from "@/pages/KanbanBoard";
import TaskCalendar from "@/pages/TaskCalendar";
import AdminUsers from "@/pages/AdminUsers";
import AdminSettings from "@/pages/AdminSettings";
import AdminAgencies from "@/pages/AdminAgencies";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function RequireAuth() {
  const { user, loading, status } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (status === "pendente" || status === "bloqueado") return <PendingApproval />;

  return <Outlet />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Companies />} />
          <Route path="/projetos" element={<Projects />} />
          <Route path="/projetos/:id" element={<KanbanBoard />} />
          <Route path="/calendario" element={<TaskCalendar />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/admin/configuracoes" element={<AdminSettings />} />
          <Route path="/admin/agencias" element={<AdminAgencies />} />
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
