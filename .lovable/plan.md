

## Plano: Formulário completo na criação de tarefa + Responsável + Comentários no histórico

### 1. Expandir o dialog "Nova Tarefa" (`KanbanBoard.tsx`)

O dialog atual tem: Título, Descrição, Prioridade, Coluna, Prazo.

Adicionar:
- **Responsável(is)**: campo Select com membros do projeto (`projectMembers`), igual ao que já existe no `TaskDetail.tsx`
- **Checklist**: campo para adicionar itens iniciais de checklist
- **Upload de mídias/documentos**: input de arquivo igual ao do `TaskDetail`
- **Cor da tarefa**: seletor de cor (paleta já existente)

Ao criar a tarefa, salvar também: `assigned_to`, criar itens de checklist e fazer upload de mídias associadas.

Adicionar estado `newAssignedTo` e resetar ao fechar.

### 2. Comentários visíveis no histórico (`TaskDetail.tsx`)

Atualmente comentários e histórico são seções separadas. Os comentários já são registrados no `task_history` com action "Comentou".

Ajuste: na seção Histórico, exibir os comentários inline junto com as ações, mostrando o conteúdo do comentário (de `details.content`) em destaque, para que todos vejam o fluxo completo de atividade da tarefa.

Alternativamente, mesclar comentários e histórico em uma única timeline unificada ordenada por `created_at`.

### Resumo

| Mudança | Onde |
|---------|------|
| Adicionar campo Responsável no dialog Nova Tarefa | `KanbanBoard.tsx` |
| Adicionar checklist, upload e cor no dialog Nova Tarefa | `KanbanBoard.tsx` |
| Salvar assigned_to + checklist + mídia ao criar | `KanbanBoard.tsx` |
| Unificar comentários + histórico em timeline | `TaskDetail.tsx` |

