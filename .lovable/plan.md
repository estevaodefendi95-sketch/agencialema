

## Plano: Equipe no projeto + Responsável na tarefa + Documentos no upload

### 1. Migração SQL: tabela `project_members`

Criar tabela `project_members` para gerenciar membros do projeto:
- `id` uuid PK
- `project_id` uuid NOT NULL
- `user_id` uuid NOT NULL
- `role` text DEFAULT 'membro' (ex: membro, responsável)
- `created_at` timestamptz
- UNIQUE(project_id, user_id)

RLS: admin/agency_admin/editor podem gerenciar; membros podem ver.

### 2. UI de equipe no projeto (`KanbanBoard.tsx`)

- Adicionar botão "Equipe" no header do projeto (ícone `Users`)
- Ao clicar, abrir Sheet/Dialog lateral listando membros atuais com opção de remover
- Campo para convidar por e-mail: busca na tabela `profiles` por e-mail, se encontrar adiciona em `project_members`
- Mostrar avatares dos membros no header do projeto

### 3. Campo "Responsável" na tarefa (`TaskDetail.tsx` + `KanbanBoard.tsx`)

- No detalhe da tarefa, adicionar campo Select "Responsável" (opcional)
- Listar membros do projeto (de `project_members` + profiles) como opções
- Salvar em `tasks.assigned_to` (coluna já existe)
- Exibir avatar/nome do responsável nos cards do kanban e na visualização lista

### 4. Expandir upload para documentos (`TaskDetail.tsx`)

- Alterar o `accept` do input de arquivo para incluir documentos: `image/*,video/mp4,video/webm,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt`
- Ajustar lógica de `file_type`: adicionar tipo "document" além de "image" e "video"
- Na exibição de mídia, para documentos mostrar ícone (FileText) + nome do arquivo com link de download em vez de preview de imagem
- Atualizar o texto do botão: "Adicionar mídias ou documentos"

### Resumo

| Mudança | Onde |
|---------|------|
| Tabela `project_members` + RLS | Migration SQL |
| UI equipe + convite por e-mail | `KanbanBoard.tsx` (Sheet) |
| Select responsável na tarefa | `TaskDetail.tsx` + cards |
| Upload de documentos | `TaskDetail.tsx` (accept + renderização) |

