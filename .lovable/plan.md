

## Plano: Cor das subcategorias + Cor dos cards + Mídia e descrição na lista

### 1. Seletor de cor para subcategorias (colunas)

No cabeçalho de cada coluna (card e lista), ao clicar na cor ou em um ícone de paleta, abrir um popover com cores pré-definidas. Ao selecionar, atualizar `project_columns.color` no banco.

Cores disponíveis: cinza, azul, verde, amarelo, vermelho, roxo, rosa, laranja (~8 opções).

### 2. Cor individual por card (tarefa)

- **Migração SQL**: adicionar coluna `color` (text, nullable) na tabela `tasks`
- No card (modo kanban), aplicar a cor como borda lateral esquerda (`border-l-4`) ou como faixa sutil no topo
- Na lista, aplicar como bolinha colorida ou borda esquerda
- Para definir a cor: popover com as mesmas cores pré-definidas, acessível via clique direito ou ícone discreto no card

### 3. Indicador de mídia + descrição na lista

Na visualização lista, entre o título e a prioridade:
- Se a tarefa tem mídia (`taskMedia[task.id]`), exibir ícone `ImageIcon` com o count
- Exibir a descrição truncada (1 linha) no centro da linha

### Resumo

| Mudança | Detalhe |
|---------|---------|
| Cor da subcategoria | Popover com paleta no header da coluna |
| Cor do card | Migração `tasks.color` + borda colorida + popover |
| Mídia na lista | Ícone `ImageIcon` + count inline |
| Descrição na lista | Texto truncado entre título e badges |

