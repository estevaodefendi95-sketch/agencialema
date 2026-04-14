

## Plano: Logo do cliente nos Projetos + Nome do cliente no Kanban + Mover tarefas na lista

### 1. Logo do cliente na página de Projetos (`Projects.tsx`)

- Alterar a query para incluir `companies(name, logo_url)`
- Atualizar interface `Project` para incluir `logo_url` na relação
- No cabeçalho de cada grupo (empresa), exibir a logo ao lado do nome (substituir o ícone `Building2` pela imagem quando disponível)
- No modo card, substituir o ícone `FolderKanban` pela logo da empresa quando disponível

### 2. Nome do cliente discreto no Kanban (`KanbanBoard.tsx`)

- Alterar a query do projeto para incluir `companies(name)` via join: `projects.select("name, company_id, companies(name)")`
- Exibir o nome da empresa em texto pequeno e discreto acima do título do projeto (ex: `text-xs text-muted-foreground`)

### 3. Mover tarefas na visualização Lista (`KanbanBoard.tsx`)

- Adicionar uma coluna "Status" na tabela com um `Select` inline (dropdown)
- Ao alterar o status no dropdown, atualizar no banco e recarregar as tarefas
- Isso permite mover tarefas entre colunas sem precisar arrastar no modo card

### Resumo

| Mudança | Arquivo |
|---------|---------|
| Logo da empresa nos grupos e cards | `Projects.tsx` |
| Nome da empresa discreto acima do título | `KanbanBoard.tsx` |
| Select de status na tabela lista | `KanbanBoard.tsx` |

