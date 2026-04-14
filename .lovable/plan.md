

## Plano: Agrupamento por subcategorias + Filtros de ordenação

### 1. Projetos (`Projects.tsx`) — Agrupar por empresa + filtros

**Agrupamento**: Em ambos os modos (card e lista), agrupar os projetos por empresa. Cada empresa vira uma seção com título (nome da empresa) e seus projetos abaixo.

**Filtros de ordenação**: Adicionar dois botões de sort no cabeçalho:
- **Empresa** (A-Z / Z-A) — ordena os grupos de empresa
- **Prazo** (mais próximo primeiro / mais distante primeiro)

Estado salvo em `localStorage` para persistência.

**Implementação**:
- Derivar `groupedProjects` a partir de `projects`, agrupando por `companies.name`
- Estado `sortField` ("empresa" | "prazo") e `sortDir` ("asc" | "desc")
- No modo card: renderizar seções com título da empresa + grid de cards
- No modo lista: renderizar rows com header de seção (empresa) usando `TableRow` com `colSpan`

### 2. Kanban/Projeto (`KanbanBoard.tsx`) — Agrupar lista por status + filtro prazo

**Modo Lista**: Agrupar tarefas por status (subcategorias). Cada status vira uma seção colapsável ou com título separador (ex: "A Fazer", "Em Andamento", etc.) com as tarefas daquele status abaixo.

**Filtro de prazo**: Botão toggle no cabeçalho para ordenar por prazo crescente/decrescente dentro de cada grupo de status.

**Implementação**:
- No modo lista, iterar sobre `COLUMNS` e renderizar um bloco por status com título + badge de contagem
- Dentro de cada bloco, listar as tarefas ordenadas por prazo conforme o filtro
- Estado `sortPrazo` ("asc" | "desc") com botão de toggle (ícone `ArrowUpDown`)

### Resumo

| Mudança | Arquivo |
|---------|---------|
| Agrupar projetos por empresa + sort empresa/prazo | `Projects.tsx` |
| Agrupar tarefas por status na lista + sort prazo | `KanbanBoard.tsx` |

