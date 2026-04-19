

## Plano

Adicionar **avatar/badge do responsável** no cabeçalho do modal de tarefa (ao lado do título), com possibilidade de:
- Selecionar um perfil já cadastrado no projeto (já funciona via `assigned_to`).
- Ou digitar um **nome livre** (texto simples, ex: "João Cliente"), para casos em que o responsável não tem cadastro no sistema.

### 1. Banco — nova coluna em `tasks`
Migration:
```sql
ALTER TABLE public.tasks ADD COLUMN assignee_name text;
```
- `assigned_to` (uuid) continua para perfis cadastrados.
- `assignee_name` (text) usado quando não há perfil — pode coexistir só um dos dois (preferência: `assigned_to` se preenchido).

### 2. Cabeçalho do modal (`src/components/TaskDetail.tsx`)
No `DialogHeader`, abaixo/à direita do título adicionar uma linha "Responsável" clicável:
- **Visualização**: `Avatar` (iniciais) + nome — `displayName(assignedProfile)` se `assigned_to`, senão `task.assignee_name`, senão "Sem responsável" (italico).
- **Edição (Popover)** ao clicar: 
  - Campo de busca/seleção dos `projectMembers` (lista filtrável).
  - Opção "Sem responsável".
  - Separador "ou usar nome livre" + `Input` de texto + botão "Aplicar".
  - Selecionar um membro: `setEditAssignedTo(userId)` + limpa `assignee_name`.
  - Aplicar nome livre: limpa `assigned_to` + define `assignee_name`.
- Marcar `hasChanges = true` para reaproveitar o botão "Salvar" existente.

### 3. Salvar (`saveTaskEdits`)
- Incluir `assignee_name` no diff junto com `assigned_to` (já existe a lógica para `assigned_to`).
- Garantir mutua exclusão: se `assigned_to` definido, salvar `assignee_name = null`; e vice-versa.
- Adicionar entrada em `task_history` com nome legível.

### 4. Remover seleção duplicada do corpo
A seleção atual de "Responsável" dentro do grid de Prioridade/Prazo (linhas 330-345) será **removida**, pois o cabeçalho passa a ser o único ponto de edição (evita confusão).

### 5. Refletir em outras telas (apenas leitura)
- `KanbanBoard.tsx`: nos cards/lista, quando exibir o responsável, usar fallback `assignee_name` se não houver `assigned_to`. Avatar mostra inicial do nome livre.
- `TaskCalendar.tsx`: mesmo fallback na lista de tarefas do dia.
- `src/integrations/supabase/types.ts`: regenerado automaticamente.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*` | Adiciona coluna `assignee_name text` em `tasks` |
| `src/components/TaskDetail.tsx` | Header com avatar+nome do responsável + Popover (membro do projeto OU nome livre); remove seletor antigo do corpo; ajusta `saveTaskEdits` |
| `src/pages/KanbanBoard.tsx` | Exibir `assignee_name` como fallback no responsável |
| `src/pages/TaskCalendar.tsx` | Exibir `assignee_name` como fallback na lista do dia |

### Resultado
Cabeçalho mostra claramente quem é o responsável. Editor escolhe entre membro cadastrado (avatar real, vinculado a perfil) ou digita um nome livre (uso pontual para clientes/externos).

