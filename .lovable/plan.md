

## Plano

Os comentários **já estão sendo salvos** no banco corretamente (verificado via consulta direta a `task_comments`). Ao reabrir a tarefa, eles voltam a aparecer dentro do modal. O que falta é **indicar visualmente no card** (sem precisar abrir o modal) que a tarefa possui comentários — por isso a sensação de que o comentário "sumiu" após fechar.

### Solução: badge com contador de comentários nos cards

**1. Kanban board (`src/pages/KanbanBoard.tsx`)** — visão Kanban + visão Lista
- Na query principal de `tasks`, agregar a contagem de comentários: usar `task_comments(count)` no select do Supabase.
  ```ts
  .select("*, task_comments(count)")
  ```
- No render do card (e da linha da lista), se `task.task_comments[0].count > 0`, mostrar um pequeno badge no rodapé do card:
  - Ícone `MessageSquare` (lucide-react) + número.
  - Posicionar junto aos outros metadados existentes (responsável, prazo, prioridade).
  - Estilo discreto: `text-xs text-muted-foreground gap-1`.

**2. Calendário (`src/pages/TaskCalendar.tsx`)** — lista de tarefas do dia
- Mesma agregação na query: `task_comments(count)`.
- Na lista de tarefas do dia selecionado, renderizar `MessageSquare + count` ao lado do nome do responsável quando houver comentários.

**3. Atualização ao fechar o modal**
- Ambas as telas já recarregam tarefas via `onTaskDeleted` / re-fetch ao fechar o `TaskDetail`. Vou garantir que o handler de fechar (`onClose`) também dispare um refresh leve da lista, para que o badge apareça imediatamente após o usuário comentar e fechar.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | Adicionar `task_comments(count)` na query; renderizar badge `MessageSquare + N` nos cards e linhas da lista; refresh ao fechar modal |
| `src/pages/TaskCalendar.tsx` | Adicionar `task_comments(count)` na query; renderizar badge na lista de tarefas do dia; refresh ao fechar modal |

### Resultado
- O comentário continua salvo (já estava) e agora **fica visível como indicador no card** após o usuário fechar a tarefa, sem precisar reabrir.
- Kanban, Lista e Calendário mostram quantos comentários cada tarefa tem.

