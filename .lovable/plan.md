

## Plano

### 1. Calendário: incluir nomes livres no filtro de responsável
Hoje em `src/pages/TaskCalendar.tsx`, o `assigneeOptions` só lista perfis cadastrados (via `assigned_to`) e a opção "Sem responsável". Tarefas com `assignee_name` (nome livre, ex: "João Cliente") ficam invisíveis ao filtrar.

**Mudança em `assigneeOptions` (useMemo, ~linha 99-113):**
- Coletar também `assignee_name` único (case-insensitive) das tarefas onde `assigned_to` é nulo.
- Retornar duas listas: `members` (com id/nome) e `freeNames` (strings).

**Mudança no `<Select>` de responsável (~linha 156-170):**
- Renderizar grupo "Membros" com `members`.
- Renderizar grupo "Nomes livres" com prefixo `name:João Cliente` como `value`.
- Manter "Sem responsável" e "Todos".

**Mudança em `filteredTasks` (~linha 116-123):**
- Se `assigneeFilter` começa com `name:`, comparar `t.assignee_name === <nome>`.
- Demais casos continuam iguais.

### 2. Modal de tarefa: comentários começam minimizados
Em `src/components/TaskDetail.tsx`:
- Trocar `useState(true)` para `useState(false)` na linha 75 (`commentsOpen`). O painel abre fechado; o usuário expande quando quiser ver/escrever.

### 3. Comentário persistente após postar
A lógica já está correta (optimistic update sem `load()` destrutivo), mas vou reforçar:
- **Auto-expandir o painel** quando o usuário clicar em "Comentar" e o painel estiver fechado, para que ele veja o comentário recém-postado aparecer na lista. 
- Em `addComment` (linha 145), no início: `if (!commentsOpen) setCommentsOpen(true);`.
- Garantir que `setComments((prev) => [...prev, ...])` adicione o item — já está. Confirmado que ao reabrir a tarefa, `load()` busca de `task_comments` e exibe — comentário fica salvo no banco.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/pages/TaskCalendar.tsx` | Filtro de responsável passa a incluir nomes livres (`assignee_name`); ajusta `assigneeOptions` e `filteredTasks` |
| `src/components/TaskDetail.tsx` | `commentsOpen` inicia `false`; ao postar comentário, auto-expande o painel |

### Resultado
- Calendário lista e permite filtrar tanto perfis cadastrados quanto nomes livres atribuídos a tarefas.
- Ao abrir tarefa, comentários ficam minimizados (mais espaço para o conteúdo).
- Ao postar comentário, painel expande automaticamente e o comentário aparece e fica salvo (visível ao reabrir a tarefa).

