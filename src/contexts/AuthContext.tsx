import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "agency_admin" | "editor" | "visualizador" | "cliente" | null;
type UserStatus = "pendente" | "aprovado" | "bloqueado" | null;

const MASTER_EMAIL = "estevaodefendi95@gmail.com";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  status: UserStatus;
  agencyId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isAgencyAdmin: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [status, setStatus] = useState<UserStatus>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserMeta = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, agency_id")
      .eq("id", userId)
      .single();
    setStatus((profile?.status as UserStatus) ?? null);
    setAgencyId(profile?.agency_id ?? null);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    setRole((roleData?.role as UserRole) ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserMeta(session.user.id), 0);
        } else {
          setRole(null);
          setStatus(null);
          setAgencyId(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserMeta(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setStatus(null);
    setAgencyId(null);
  };

  const isSuperAdmin = user?.email === MASTER_EMAIL;
  const isAgencyAdmin = role === "agency_admin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const isEditor = role === "editor";
  const isViewer = role === "visualizador";
  const canEdit = isAdmin || isAgencyAdmin || isEditor;

  return (
    <AuthContext.Provider
      value={{ user, session, role, status, agencyId, loading, signIn, signUp, signOut, isSuperAdmin, isAgencyAdmin, isAdmin, isEditor, isViewer, canEdit }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
