

## Plano: Renomear/Excluir/Arquivar projetos + Histórico de versões

### 1. Migração SQL

- Adicionar coluna `archived` (boolean, default false) na tabela `projects`
- Criar tabela `project_history` para registrar alterações:
  - `id` uuid PK
  - `project_id` uuid NOT NULL
  - `action` text NOT NULL (ex: "rename", "archive", "update_description", "update_due_date")
  - `previous_data` jsonb (snapshot do estado anterior)
  - `new_data` jsonb (novo estado)
  - `user_id` uuid
  - `created_at` timestamptz default now()
- RLS na `project_history`: mesmas regras de acesso do projeto (admin, agency_admin, editor view, client view)

### 2. Renomear projeto (`Projects.tsx`)

- Adicionar ícone de edição (Pencil) nos cards e linhas da lista de projetos
- Ao clicar, abrir dialog simples com campo de nome editável
- Ao salvar: gravar no banco + inserir registro em `project_history` com `previous_data` e `new_data`
- Somente admin/editor pode renomear

### 3. Excluir ou Arquivar projeto (`Projects.tsx`)

- Adicionar menu de ações (dropdown ou ícones) em cada projeto com:
  - **Arquivar**: seta `archived = true`, projeto some da listagem principal
  - **Excluir**: confirmação via AlertDialog, depois deleta o projeto e tarefas associadas
- Filtro para mostrar/esconder projetos arquivados (toggle ou aba)
- Opção de desarquivar projetos arquivados

### 4. Histórico do projeto (`KanbanBoard.tsx` ou nova seção)

- Adicionar aba/seção "Histórico" na página do projeto (KanbanBoard)
- Listar registros de `project_history` em ordem cronológica reversa
- Cada entrada mostra: ação, dados anteriores, quem fez, quando
- Botão "Desfazer" em cada entrada: restaura `previous_data` no projeto e registra nova entrada de histórico

### 5. Registrar alterações automaticamente

- Toda alteração no projeto (nome, descrição, prazo, arquivamento) grava em `project_history` antes de aplicar

### Resumo

| Mudança | Onde |
|---------|------|
| Coluna `archived` em `projects` | Migration SQL |
| Tabela `project_history` + RLS | Migration SQL |
| Renomear projeto inline | `Projects.tsx` |
| Arquivar/Excluir com confirmação | `Projects.tsx` |
| Filtro de arquivados | `Projects.tsx` |
| Seção histórico + desfazer | `KanbanBoard.tsx` |

