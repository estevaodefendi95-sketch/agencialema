

## Plano

### 1. Comentário aparecer instantaneamente
Hoje em `TaskDetail.tsx`, `addComment` faz insert e chama `load()` que rebusca tudo. Vou fazer **optimistic update**: adicionar o comentário na lista local imediatamente após o insert (ou antes, com rollback em caso de erro), sem esperar o reload completo.

**Mudanças em `src/components/TaskDetail.tsx` (`addComment`):**
- Inserir com `.select("*, profiles(full_name)").single()` para retornar o registro já com o nome do autor.
- Atualizar `setComments(prev => [...prev, novo])` direto, e limpar o textarea instantaneamente.
- Rodar o insert do `task_history` em paralelo (sem bloquear UI).
- Recarregar histórico em background (sem travar exibição do comentário).

### 2. Logo do cliente no calendário
No `TaskCalendar.tsx`, cada item da lista mostra `Building2` + nome da empresa. Trocar por logo da empresa quando existir.

**Mudanças em `src/pages/TaskCalendar.tsx`:**
- Atualizar query: `companies(name, logo_url)`.
- Atualizar tipo `TaskWithRelations` para incluir `logo_url`.
- No render (linha ~247-252): se `logo_url` existir, renderizar `<img>` redondo (~14px); senão, fallback `Building2`.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/components/TaskDetail.tsx` | `addComment` com optimistic update — comentário aparece instantâneo |
| `src/pages/TaskCalendar.tsx` | Buscar `logo_url` e renderizar logo da empresa em cada tarefa |

