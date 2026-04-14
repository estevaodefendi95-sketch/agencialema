

## Plano: Drag-and-drop na Lista + Subcategorias customizáveis

### 1. Drag-and-drop na visualização Lista (`KanbanBoard.tsx`)

Envolver as tarefas da lista no mesmo `DragDropContext` já usado no modo card. Cada subcategoria de status será um `Droppable`, e cada linha da lista será um `Draggable` com um `GripVertical` no canto esquerdo (igual ao card).

### 2. Botão "+" compacto

Substituir o botão "Nova tarefa" por apenas um ícone `+` discreto abaixo de cada subcategoria.

### 3. Subcategorias customizáveis por projeto

Atualmente as colunas são um array hardcoded com enum `task_status`. Para permitir editar nomes e criar novas subcategorias, preciso:

**Mudança no banco**:
- Criar tabela `project_columns` (`id`, `project_id`, `slug` text, `label` text, `color` text, `position` int)
- Alterar `tasks.status` de enum para `text` (para aceitar qualquer slug customizado)
- Dropar o enum `task_status`
- Inserir colunas padrão ao criar projeto (via seed ou na criação)
- RLS: mesmas regras de acesso do projeto

**Mudança no código**:
- Carregar colunas do banco ao invés do `COLUMNS` hardcoded
- Ao abrir um projeto pela primeira vez (sem colunas), criar as 4 padrão automaticamente
- No cabeçalho de cada subcategoria, permitir editar o nome (click para inline edit)
- Botão "+ Adicionar coluna" no final das subcategorias (card e lista)
- Atualizar o dialog de nova tarefa para usar colunas dinâmicas

### Resumo

| Mudança | Onde |
|---------|------|
| Drag-and-drop na lista com GripVertical | `KanbanBoard.tsx` |
| Botão "+" compacto | `KanbanBoard.tsx` |
| Tabela `project_columns` + migração status → text | Migration SQL |
| Carregar/editar/criar colunas dinamicamente | `KanbanBoard.tsx` |

