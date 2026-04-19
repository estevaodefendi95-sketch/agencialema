

Usuário quer 2 coisas no Kanban/Lista:
1. Mostrar o nome do responsável no card de forma minimalista (hoje só mostra avatar).
2. No filtro "Equipe" permitir filtrar por responsável (membros do projeto).

Preciso ver KanbanBoard.tsx para entender estrutura atual de filtros e card.

## Plano

### 1. Card de tarefa — exibir nome do responsável (minimalista)
Em `src/pages/KanbanBoard.tsx`, no render do card (Kanban) e da linha (Lista):
- Ao lado do avatar do responsável, exibir o primeiro nome (ou apelido) em `text-xs text-muted-foreground truncate max-w-[80px]`.
- Fonte da informação:
  - Membro cadastrado: `profile.nickname || primeira palavra de full_name`.
  - Nome livre: `assignee_name` (primeira palavra).
- Se não houver responsável, não mostra nada (mantém comportamento atual).
- Layout: `avatar + nome` agrupados em um único `flex items-center gap-1`.

### 2. Filtro "Equipe" por responsável
Hoje o filtro Equipe (em KanbanBoard) provavelmente filtra por membro do projeto de forma genérica. Ajuste:
- Popular o select/dropdown de Equipe com a lista de **membros do projeto** (via `project_members` + `profiles`) já carregados na página.
- Incluir também opção "Sem responsável".
- Ao selecionar um membro, `filteredTasks` deve manter apenas tarefas onde `task.assigned_to === selectedMemberId`.
- Manter "Todos" como default.
- Persistir comportamento dos demais filtros (status, prioridade, prazo).

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | Card/Lista mostram nome curto do responsável ao lado do avatar; filtro Equipe lista membros do projeto e filtra por `assigned_to` |

### Resultado
- Cards exibem nome do responsável de forma compacta junto ao avatar.
- Filtro Equipe permite isolar tarefas por responsável cadastrado no projeto.

