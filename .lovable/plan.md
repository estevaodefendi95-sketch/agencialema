

## Plano: Excluir colunas + Layout horizontal fixo + Remover select de status na lista

### 1. Excluir coluna (`KanbanBoard.tsx`)

- Adicionar ícone `Trash2` no cabeçalho de cada coluna (card e lista), visível ao hover
- Ao clicar, exibir confirmação (AlertDialog): "Excluir coluna X? As tarefas serão movidas para a primeira coluna."
- Ao confirmar: mover todas as tarefas da coluna excluída para a primeira coluna restante, depois deletar a coluna do banco
- Não permitir excluir se restar apenas 1 coluna

### 2. Layout horizontal dos cards (modo Kanban)

- Atualmente o grid usa `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`, o que quebra em linhas quando há mais de 4 colunas
- Trocar para `flex overflow-x-auto` com largura fixa por coluna (`min-w-[280px] w-[280px]`), criando scroll horizontal estilo Trello
- O botão "Adicionar coluna" também fica inline no final do flex

### 3. Remover select de status na lista

- Remover o `Select` de status que aparece em cada linha da lista (linhas 342-358)
- O usuário já pode arrastar para mudar de coluna, então o campo é redundante

### Resumo

| Mudança | Detalhe |
|---------|---------|
| Excluir coluna com confirmação | `KanbanBoard.tsx` — AlertDialog + migração de tarefas |
| Layout horizontal scroll | `KanbanBoard.tsx` — flex + overflow-x-auto no modo card |
| Remover select status na lista | `KanbanBoard.tsx` — limpar linhas 342-358 |

