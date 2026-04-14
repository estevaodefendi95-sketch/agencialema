

## Plano: Editar e Excluir no Card e Mídias

### 1. Editar informações da tarefa no TaskDetail

Adicionar campos editáveis no topo do `TaskDetail.tsx`:
- Título e descrição passam a ser editáveis inline (clique para editar)
- Campos de prioridade, prazo e responsável editáveis
- Botão "Salvar" ao detectar mudanças
- Registrar alterações no `task_history`

### 2. Excluir tarefa

- Botão "Excluir Tarefa" com confirmação (AlertDialog) no `TaskDetail.tsx`
- Remove a tarefa e fecha o dialog
- Visível apenas para admin e editor (`canEdit`)

### 3. Excluir mídias individuais

- Botão X (já existe o ícone importado) sobre cada mídia no `TaskDetail.tsx`
- Remove do `task_media` e do storage
- Confirmação simples antes de deletar

### 4. Editar/excluir comentários

- Botão de excluir no comentário (apenas para o autor ou admin)
- Botão de editar que transforma o texto em textarea inline

### 5. Editar/excluir itens do checklist

- Botão X para remover item do checklist
- Clique no texto para editar inline

### 6. Migração: adicionar DELETE policies

Preciso adicionar políticas RLS de DELETE nas tabelas que ainda não permitem:
- `task_media` — admin e editors podem deletar
- `task_comments` — autor pode deletar, admin pode deletar
- `task_checklists` — admin e editors podem deletar
- `tasks` — admin e editors podem deletar

### Resumo Técnico

| Mudança | Arquivo |
|---------|---------|
| Edição inline de título/descrição/prioridade/prazo | `TaskDetail.tsx` |
| Botão excluir tarefa com confirmação | `TaskDetail.tsx` |
| Botão X para excluir mídias | `TaskDetail.tsx` |
| Editar/excluir comentários | `TaskDetail.tsx` |
| Editar/excluir checklist items | `TaskDetail.tsx` |
| DELETE RLS policies | Nova migration |

