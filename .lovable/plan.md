

## Plano

### 1. Comentário fixado e persistente
Hoje o painel de comentários é um `<details>` colapsável (fechado por padrão), por isso parece "sumir" após enviar. Vou voltar a deixá-lo **fixo e sempre visível** no rodapé do modal, e garantir que o comentário recém-postado permaneça na lista (sem reload destrutivo).

**Mudanças em `src/components/TaskDetail.tsx`:**
- Trocar `<details>` por `<div>` fixo no rodapé com header "Comentários (n)", textarea + botão e `ScrollArea h-[200px]`.
- Em `addComment`: manter optimistic update já existente, e **remover** o `.then(() => load())` após o insert do `task_history` (ele rebusca tudo e sobrescreve a lista local — causa o "sumiço"). Em vez disso, recarregar só o histórico (`task_history`), preservando `comments` local.
- Em `deleteComment` e `updateComment`: atualizar lista local em vez de chamar `load()` completo.

### 2. Apelido (nickname) no perfil de todos os usuários
Adicionar campo `nickname` em `profiles` e uma página `/perfil` acessível a qualquer usuário aprovado, onde edita nome completo e apelido. O apelido (quando presente) será exibido em **comentários** e **histórico de tarefas** no lugar do `full_name`.

**Banco (migração):**
- `ALTER TABLE profiles ADD COLUMN nickname text;`

**Novos/alterados arquivos:**
| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*` | Adiciona coluna `nickname` em `profiles` |
| `src/pages/Profile.tsx` (novo) | Página de perfil: editar `full_name` e `nickname` (input com max 30 chars, validação trim) |
| `src/App.tsx` | Rota `/perfil` dentro de `RequireAuth` + `AppLayout` |
| `src/components/AppSidebar.tsx` | Item "Meu Perfil" no menu, visível para todos |
| `src/components/TaskDetail.tsx` | Buscar `nickname` em `profiles(...)` nas queries de `task_comments` e `task_history`; render: `nickname || full_name || "Usuário"`. Também ajustar o `addComment` (fetch de profile inclui nickname) |
| `src/pages/KanbanBoard.tsx` | Incluir `nickname` em queries de `project_members` e mostrar `nickname || full_name` nos avatares/labels onde o nome aparece |
| `src/pages/TaskCalendar.tsx` | Incluir `nickname` na query de `profiles` e usar `nickname || full_name` no responsável |

### Resultado esperado
- Após enviar, o comentário aparece imediatamente, fica salvo (não some) e o painel de comentários permanece visível e rolável.
- Qualquer usuário pode acessar "Meu Perfil" no menu, definir um apelido, e este aparece em todos os registros de tarefas/comentários.

