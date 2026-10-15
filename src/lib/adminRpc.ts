import { supabase } from "@/integrations/supabase/client";

// Erros das funções/tabelas admin-only (Clientes & Contratos). As funções
// lançam "Acesso negado" quando quem chama não é admin — isso é erro de
// permissão e nunca deve ser tratado como "sem dados".
export type AdminErrorKind = "denied" | "missing" | "other";

export function classifyAdminError(error: { message?: string; code?: string } | null | undefined): AdminErrorKind {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("acesso negado") || error?.code === "42501") return "denied";
  // Função/tabela ainda não criada no banco (PostgREST / Postgres).
  if (
    ["PGRST202", "PGRST205", "42883", "42P01"].includes(error?.code || "") ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist")
  ) {
    return "missing";
  }
  return "other";
}

export function adminErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  switch (classifyAdminError(error)) {
    case "denied":
      return "Acesso negado — só administradores podem ver e editar isso.";
    case "missing":
      return "Recurso ainda não disponível no banco (função ou tabela não encontrada).";
    default:
      return error?.message || "Erro inesperado.";
  }
}

// ── Senha das observações confidenciais ──────────────────────────────────
// Senha única, compartilhada entre todos os admins. As funções de observação
// exigem a senha (p_password) e lançam "Senha incorreta" / "Senha de
// observações não configurada..." quando não confere.
// Funções recém-criadas, ainda fora dos tipos gerados.
type RpcError = { message?: string; code?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function isWrongNotesPassword(error: { message?: string } | null | undefined) {
  return (error?.message || "").toLowerCase().includes("senha incorreta");
}

export function isNotesPasswordUnset(error: { message?: string } | null | undefined) {
  return (error?.message || "").toLowerCase().includes("não configurada");
}

// Mensagem pra erros das funções de senha: as mensagens de senha vêm prontas
// do banco e têm prioridade sobre a classificação genérica.
export function notesErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (isWrongNotesPassword(error) || isNotesPasswordUnset(error)) return error?.message || "";
  return adminErrorMessage(error);
}

export function adminHasNotesPassword() {
  return db.rpc("admin_has_notes_password") as Promise<{ data: boolean | null; error: RpcError | null }>;
}

export function adminSetNotesPassword(newPassword: string) {
  return db.rpc("admin_set_notes_password", { p_new_password: newPassword }) as Promise<{ data: unknown; error: RpcError | null }>;
}

export function adminGetCompanyNotes(companyId: string, password: string) {
  return db.rpc("admin_get_company_notes", { p_company_id: companyId, p_password: password }) as Promise<{ data: string | null; error: RpcError | null }>;
}

export function adminSetCompanyNotes(companyId: string, notes: string, password: string) {
  return db.rpc("admin_set_company_notes", { p_company_id: companyId, p_notes: notes, p_password: password }) as Promise<{ data: unknown; error: RpcError | null }>;
}
