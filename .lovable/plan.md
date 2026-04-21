

## 1) Toggle de mídia nos cards do Kanban (olho aberto/fechado)

Hoje, quando uma tarefa tem mídia, o thumbnail (h-28) aparece sempre no topo do card, ocupando bastante espaço. Vou adicionar um botão de olho que **mostra/oculta a prévia da mídia sem precisar abrir a tarefa**.

### Comportamento
- Pequeno botão `Eye` / `EyeOff` (ícone lucide) no canto superior direito do card, visível apenas quando `taskMedia[task.id]` existe.
- Estado **por tarefa**, persistido em `localStorage` na chave `task-media-visible-${projectId}` como `Record<taskId, boolean>`.
- Padrão inicial: **mídia oculta** (mais limpo). Usuário clica no olho fechado → mídia aparece. Clica de novo → some.
- Ao ocultar, o card vira só o título + meta (sem o bloco de imagem h-28). Quando visível, mantém o thumbnail atual com badge "+N".
- Na **view de lista**, o ícone `ImageIcon` com a contagem que já existe vira clicável: ao clicar, expande uma linha extra abaixo com o thumbnail (mesmo estado/persistência).
- O clique no botão usa `e.stopPropagation()` para não disparar o `setSelectedTask`.

### Mudanças em `src/pages/KanbanBoard.tsx`
- Importar `Eye`, `EyeOff` de `lucide-react`.
- Novo estado `visibleMedia: Record<string, boolean>` + load/save no `localStorage`.
- Helper `toggleMediaVisible(taskId)`.
- No card Kanban (linhas ~1033-1048): renderizar o bloco de mídia só se `visibleMedia[task.id]`. Adicionar botão de olho posicionado absoluto no canto do card (ou inline ao lado do título).
- Na view lista (linhas ~895-899): tornar o `ImageIcon` clicável; quando aberto, renderizar uma linha de prévia abaixo do item (thumbnail pequeno 80x80 ou inline 200px).

### Resultado
Cards mais compactos por padrão; usuário escolhe quais tarefas mostram a mídia inline, sem precisar abrir o modal.

---

## 2) Calendário estilo Asana (Mês / Semana / Dia)

Hoje `/calendario` mostra um mini-calendário à esquerda + lista de tarefas do dia à direita. Vou **manter essa visão** e adicionar um **seletor de modo** com 3 opções: **Mês**, **Semana**, **Dia** (estilo Asana, ocupando a tela toda com as tarefas dentro das células).

### Layout

```text
[ Mês | Semana | Dia ]   [ ‹ ›  Abril 2026  Hoje ]   [filtros existentes]
─────────────────────────────────────────────────────
MÊS:   grid 7 col × 5/6 linhas, cada célula com header do dia
       e tarefas empilhadas (até 3 + "more"); cor por prioridade
SEMANA: grid 7 col × 1 linha, célula maior, mostra todas as tarefas
DIA:    1 coluna larga, lista vertical das tarefas do dia (igual hoje, mas tela cheia)
```

Quando o usuário clica num dia (Mês/Semana) → muda para modo **Dia** focado nele. Quando clica numa tarefa → navega para `/projetos/{id}` (já é o comportamento atual).

### Estrutura da página

- Cabeçalho da página: título + filtros (empresa/responsável) **mantidos**.
- Nova **toolbar do calendário**:
  - `Tabs` shadcn com 3 valores: `mes` | `semana` | `dia` (default `mes`, persistido em `localStorage` como `calendar-view-mode`).
  - Navegação: botões `‹` `›` para avançar/retroceder no período, label central com o período corrente (ex.: "Abril 2026" / "21–27 Abr 2026" / "Terça, 21 Abr 2026"), botão "Hoje" para resetar.
- **Mês**: grid `grid-cols-7`. Cada célula: número do dia (cinza se fora do mês, destaque se hoje, ring se selecionado). Lista até 3 tarefas com `bg-primary/10 text-xs truncate`, dot de prioridade colorido. Se houver mais, "+N mais" abre popover/sheet com a lista completa daquele dia.
- **Semana**: grid `grid-cols-7` com células altas (`min-h-[400px]`), header com dia da semana + número, scroll vertical interno mostrando todas as tarefas em pills.
- **Dia**: card único ocupando toda a largura, lista das tarefas do dia (reaproveita o componente atual de cartão de tarefa, com avatar/empresa/projeto/prioridade/comentários).

### Detalhes de UI
- Pill de tarefa (Mês/Semana): `<button className="w-full text-left px-1.5 py-0.5 rounded text-xs flex items-center gap-1 bg-card hover:bg-accent border-l-2" style={{ borderLeftColor: priorityHex[priority] }}>` mostrando título truncado.
- Pílula clicável navega para `/projetos/{project_id}`.
- Hoje destacado com `bg-primary/10 ring-1 ring-primary/30`.
- Dias vazios continuam clicáveis para abrir o modo Dia daquele dia.
- Filtros de empresa/responsável seguem aplicáveis em todos os modos.

### Mudanças em `src/pages/TaskCalendar.tsx`
- Adicionar `Tabs`/`ToggleGroup` para o modo de visualização (`mes` | `semana` | `dia`).
- Estado: `viewMode`, `cursor: Date` (data de referência do período exibido).
- Helpers com `date-fns` (já instalado): `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `addMonths`, `addWeeks`, `addDays`, `isSameMonth`, `isToday`.
- 3 sub-componentes inline: `MonthView`, `WeekView`, `DayView` que recebem `tasks` filtradas.
- Persistência do `viewMode` em `localStorage` (`calendar-view-mode`).
- Manter o mini-calendário lateral apenas no modo **Dia** (ajuda a navegar). Nos modos Mês/Semana ele fica oculto e o calendário ocupa toda a largura disponível (`grid-cols-1`).

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | Toggle olho/olho-fechado por card (Kanban + Lista), persistido em localStorage |
| `src/pages/TaskCalendar.tsx` | Toolbar Mês/Semana/Dia + 3 visualizações estilo Asana, mantendo filtros |

### Resultado
- Cards do Kanban mais limpos, com prévia de mídia opcional por clique no olho.
- Calendário com 3 modos de visualização full-width estilo Asana, mantendo a lista de detalhes do dia atual no modo Dia.

