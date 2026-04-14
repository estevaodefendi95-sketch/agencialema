

## Plano: Corrigir migração e restaurar funcionalidade

A migração anterior estava incompleta — ela apenas removeu o enum `task_status` com CASCADE, o que provavelmente removeu a coluna `status` da tabela `tasks`. A tabela `project_columns` também não foi criada. Preciso corrigir isso.

### 1. Migração SQL

Executar uma migração que:
- Adiciona a coluna `status` (text, default `'a_fazer'`) de volta à tabela `tasks` (se não existir)
- Cria a tabela `project_columns` com colunas: `id`, `project_id` (FK → projects), `slug`, `label`, `color`, `position`
- Habilita RLS em `project_columns` com as mesmas políticas de acesso dos projetos (super admin, agency admin, clientes, editores)

### 2. Código (`KanbanBoard.tsx`)

O código atual já está correto — usa `project_columns`, edição inline de nomes, criação de colunas, drag-and-drop em card e lista. Não precisa de alteração.

### 3. O que o usuário pediu

O usuário quer manter os **cards** (modo kanban) como estão, apenas com a capacidade de renomear subcategorias e criar novas (estilo Trello). Isso já está implementado no código atual — só faltava a migração correta no banco.

### Resumo

| Mudança | Onde |
|---------|------|
| Recriar coluna `status` text em `tasks` | Migration SQL |
| Criar tabela `project_columns` + RLS | Migration SQL |
| Nenhuma mudança de código necessária | — |

