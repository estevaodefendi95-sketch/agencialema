// Funções do Fluxo Operacional de uma empresa (company_workflow_roles.role_key).
// Lista central pra poder incluir outras funções no futuro sem mexer em
// cada tela que usa isso.
export interface WorkflowRoleDef {
  key: string;
  label: string;
}

export const WORKFLOW_ROLES: WorkflowRoleDef[] = [
  { key: "planejamento", label: "Planejamento" },
  { key: "copy", label: "Copy" },
  { key: "postagem_feed", label: "Postagem Feed" },
  { key: "postagem_story", label: "Postagem Story" },
];

export function workflowRoleLabel(key: string): string {
  return WORKFLOW_ROLES.find((r) => r.key === key)?.label || key;
}
