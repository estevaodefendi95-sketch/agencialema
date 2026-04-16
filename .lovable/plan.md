

## Plano: Aba Calendário de Tarefas

### Visão geral
Criar uma nova página "Calendário" acessível pelo sidebar, exibindo todas as tarefas com prazo (`due_date`) em um calendário mensal. A visualização respeita automaticamente as permissões do usuário via RLS (só vê tarefas de empresas permitidas).

### 1. Nova página `src/pages/TaskCalendar.tsx`

- Buscar todas as tarefas com `due_date` não nulo, junto com dados do projeto (`projects.name`, `projects.company_id`) e empresa (`companies.name`)
- RLS já filtra por empresas permitidas, sem lógica extra necessária
- Usar o componente `Calendar` (react-day-picker) já existente para navegação mensal
- Abaixo/ao lado do calendário, marcar os dias que têm tarefas com indicadores visuais (dots coloridos por prioridade)
- Ao clicar em um dia, listar as tarefas daquele dia com: título, projeto, empresa, prioridade, responsável
- Clicar na tarefa navega para o kanban do projeto (`/projetos/:projectId`)

### 2. Rota e sidebar

- Adicionar rota `/calendario` em `App.tsx`
- Adicionar item "Calendário" no sidebar (`AppSidebar.tsx`) com ícone `Calendar`, entre Projetos e os itens de admin

### 3. Layout do calendário

- Calendário mensal grande ocupando a largura da página
- Dias com tarefas exibem pequenos dots coloridos (cor da prioridade ou do projeto)
- Painel lateral ou seção abaixo mostra detalhes das tarefas do dia selecionado
- Cards de tarefa mostram: título, badge de prioridade, nome do projeto, nome da empresa, avatar do responsável

### Resumo

| Mudança | Onde |
|---------|------|
| Nova página calendário | `src/pages/TaskCalendar.tsx` |
| Rota `/calendario` | `App.tsx` |
| Item no sidebar | `AppSidebar.tsx` |

Nenhuma migração SQL necessária - RLS existente já garante a filtragem por empresa.

