

## Plano: Filtros no Calendário (empresa e responsável)

Adicionar dois selects no header da página `TaskCalendar.tsx`:

### 1. Filtro por Empresa
- Select populado com as empresas únicas extraídas das tarefas carregadas (`task.projects.companies`)
- Opção "Todas as empresas" como padrão

### 2. Filtro por Responsável
- Select populado com os responsáveis únicos extraídos das tarefas (`task.assignee`)
- Opção "Todos os responsáveis" como padrão
- Incluir opção "Sem responsável" para tarefas sem `assigned_to`

### 3. Lógica de filtragem
- Aplicar os filtros via `useMemo` antes de calcular `tasksByDate`, `datesWithTasks` e `selectedTasks`
- Os indicadores (dots) no calendário e a lista lateral refletem os filtros ativos
- Botão "Limpar filtros" quando algum filtro estiver aplicado

### Layout
- Linha de filtros entre o título da página e o grid do calendário
- Em telas pequenas, selects empilham verticalmente

### Resumo

| Mudança | Onde |
|---------|------|
| 2 selects (empresa, responsável) | `TaskCalendar.tsx` header |
| Filtragem com `useMemo` | `TaskCalendar.tsx` |
| Botão limpar filtros | `TaskCalendar.tsx` |

Sem alterações no banco de dados.

