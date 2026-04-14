

## Plano: Branding no Cabeçalho para Clientes + Visualização em Lista

### 1. Cabeçalho com marca da agência (já funciona parcialmente)

O sistema já carrega logo/nome da agência no cabeçalho via `useAppSettings` para quem tem `agency_id`. O admin da agência já pode editar isso em Configurações. Preciso verificar e garantir que:
- Clientes (`role: cliente`) tenham `agency_id` preenchido no perfil — isso deve ser definido ao aprovar o usuário
- Na tela de aprovação de usuários (`AdminUsers.tsx`), ao aprovar um cliente, vincular automaticamente o `agency_id` do admin que está aprovando

**Mudança**: No `AdminUsers.tsx`, ao aprovar um usuário, setar `agency_id` do perfil com o `agency_id` do admin logado.

### 2. Visualização em Lista no Kanban

Adicionar um toggle Kanban/Lista no canto superior da página de projeto, ao lado do botão "Nova Tarefa".

**Modo Lista**: Tabela com colunas: Status (badge colorido), Título, Prioridade, Prazo, Mídia (ícone). Clicável para abrir `TaskDetail`.

**Persistência**: Salvar a preferência no `localStorage` com chave `view-mode-{projectId}`. Ao abrir o projeto, carregar a última escolha do usuário.

**Mudanças**:
- `KanbanBoard.tsx`: Adicionar estado `viewMode` ("kanban" | "lista"), toggle com ícones `LayoutGrid` / `List`, renderizar condicionalmente o grid kanban ou a tabela
- Componente de tabela inline usando `Table` do shadcn/ui

### Resumo

| Mudança | Arquivo |
|---------|---------|
| Vincular `agency_id` ao aprovar usuário | `AdminUsers.tsx` |
| Toggle Kanban/Lista + tabela de tarefas | `KanbanBoard.tsx` |
| Persistência da preferência via localStorage | `KanbanBoard.tsx` |

