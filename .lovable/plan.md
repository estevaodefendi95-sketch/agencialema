

## Plano: Campo Responsável visível no dialog "Nova Tarefa"

O campo Responsável já existe no estado (`newAssignedTo`) e na lógica de salvar do `KanbanBoard.tsx`, mas aparentemente não está renderizado (ou não está visível) no formulário do dialog "Nova Tarefa".

### Mudança

No `KanbanBoard.tsx`, dentro do `<Dialog>` de criação de tarefa, adicionar/garantir um campo `Select` "Responsável":

- Label: **"Responsável"**
- Populado por `projectMembers` filtrados por `status === 'ativo'` (apenas membros ativos)
- Cada opção mostra avatar + nome (ou e-mail) do membro
- Opção "Nenhum" no topo (valor `none`) — padrão
- Vinculado ao estado `newAssignedTo`
- Posicionado entre os campos Prioridade/Coluna e Prazo

Ao salvar, manter a lógica atual: se `newAssignedTo === 'none'` → grava `null`, senão grava o `user_id` selecionado.

### Resumo

| Mudança | Onde |
|---------|------|
| Renderizar Select Responsável no dialog Nova Tarefa | `KanbanBoard.tsx` |

Sem alterações no banco de dados.

