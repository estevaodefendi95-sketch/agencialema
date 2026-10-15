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
