

## Botões "+" rápidos para criar tarefas em cada visualização

A página **Minhas Tarefas** já tem o botão "Nova Tarefa" no header e o diálogo completo. A ideia é adicionar **atalhos "+"** dentro de cada visualização (Cards/Kanban, Lista, Calendário) que abrem o **mesmo diálogo**, já com contexto pré-preenchido quando fizer sentido.

### Onde colocar cada botão

**1) Visão Cards (Kanban) — `MyTasks.tsx` ~linha 429**
- Em cada coluna de status (`A Fazer`, `Em Andamento`, etc.), adicionar um botão `+` discreto no header da coluna, à direita do badge de contagem.
- Ao clicar: abre o diálogo. Como não há "status inicial customizado" no formulário (o status hoje vem da primeira coluna do projeto), o botão `+` da coluna apenas abre o diálogo padrão. (Manter simples — não tentar forçar status pois o dialog não suporta hoje.)

**2) Visão Lista — `MyTasks.tsx` ~linha 497**
- Adicionar uma linha/footer no final da tabela com botão `+ Adicionar tarefa` (estilo "ghost", largura total) que abre o diálogo.
- Também colocar um botão `+` pequeno no canto superior direito do header da Card (ao lado do título da seção). Como a Card não tem header hoje, adicionar um header simples "Tarefas" + botão `+`.

**3) Visão Calendário — `MyTasks.tsx` ~linha 539-580**
- **Toolbar do calendário (header)**: adicionar botão `+` ao lado do "Hoje".
- **Mês (`MonthGrid`)**: em cada célula de dia, mostrar um botão `+` minúsculo no canto superior direito (visível em hover) → abre o diálogo já com **prazo = aquele dia** (`ntDue` pré-preenchido).
- **Semana (`WeekGrid`)**: mesmo padrão, botão `+` no header de cada coluna de dia → pré-preenche `ntDue`.
- **Dia**: botão `+ Nova tarefa neste dia` no header do `Card` → pré-preenche `ntDue` com `cursor`.

### Nova função utilitária

```ts
function openNewTaskDialog(prefillDate?: Date) {
  if (prefillDate) setNtDue(format(prefillDate, "yyyy-MM-dd"));
  setOpenNewTask(true);
}
```

Passar essa função para `MonthGrid` e `WeekGrid` como prop `onAddDay(day)`.

### Restrições (regras já existentes)

- Todos os botões `+` só aparecem se `canEdit` (mesma regra do botão do header).
- Diálogo, RLS e fluxo de criação não mudam.

### Não muda

- Diálogo de criação atual permanece idêntico (mesmos campos: Projeto, Título, Descrição, Prioridade, Prazo, Responsável).
- Não cria status customizado por coluna do Kanban (o status sempre vem da primeira coluna do projeto escolhido).
- Comportamento de drag-and-drop, filtros, listagem.

### Resultado

O usuário poderá criar uma nova tarefa de qualquer ponto da tela:
- **Kanban** → `+` por coluna
- **Lista** → `+ Adicionar tarefa` no rodapé + `+` no header
- **Calendário** → `+` por dia (com prazo já preenchido) + `+` no toolbar

