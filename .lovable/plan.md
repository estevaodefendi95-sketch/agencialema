

## Visão geral

Vou implementar **3 grandes módulos** complementares ao app atual:

1. **Minhas Tarefas** — visão pessoal cross-project (Kanban / Lista / Calendário) com filtros e drag-and-drop.
2. **Apresentação ao Cliente** — aba dentro de cada projeto com builder de blocos (texto, imagens, preview Instagram, planejamento de posts).
3. **Landing Page pública do cliente** — rota externa por projeto, liberada manualmente pela equipe, sem login.

Vou aproveitar o que já existe: tabela `tasks` (com `assigned_to`, `priority`, `status`, `due_date`, `project_id`), bucket `attachments`, sistema de roles (`admin`/`editor`/`visualizador`/`cliente`), e os componentes Kanban/Calendar já construídos.

---

## 1) Minhas Tarefas (`/minhas-tarefas`)

### Rota e navegação
- Nova rota `/minhas-tarefas` em `App.tsx`.
- Novo item no `AppSidebar` na seção **Principal**: "Minhas Tarefas" (ícone `CheckSquare`), abaixo de Dashboard.

### Página `src/pages/MyTasks.tsx`
Carrega `tasks` com join leve em `projects(id, name, company_id)` filtradas por `assigned_to = auth.uid()`.

**Filtro de usuário (admin)**: se `isAdmin`, mostra um `Select` no topo "Ver tarefas de:" listando todos os profiles aprovados. Padrão = eu mesmo. Usuários comuns não veem o seletor.

**Toolbar**:
- ToggleGroup: **Cards** | **Lista** | **Calendário** (persiste em `localStorage` `mytasks-view`).
- Filtros: Projeto (Select multi), Prioridade (baixa/média/alta/urgente), Prazo (Hoje / Esta semana / Atrasadas / Sem data / Todas).
- Botão "Marcar concluída" disponível inline em cada item (checkbox que muda `status` para `concluido`).

**Visualizações**:
- **Cards (Kanban)**: 4 colunas fixas por status (`a_fazer`, `em_andamento`, `em_revisao`, `concluido`). Drag-and-drop entre colunas atualiza `status` da task (mesmo padrão do `KanbanBoard` atual usando `@hello-pangea/dnd`). Cada card mostra título, projeto (badge), prioridade (dot colorido), data, descrição truncada.
- **Lista**: tabela densa com colunas Título / Projeto / Status / Prioridade / Prazo / ✓. Clicar abre o `TaskDetail` modal já existente.
- **Calendário**: reusa os componentes `MonthView`/`WeekView`/`DayView` já criados em `TaskCalendar.tsx` — vou extrair para `src/components/calendar/` para compartilhar.

### Permissões (RLS já cobre)
A policy "Users view their tasks" usa `has_company_access`, então um admin que tem acesso a todas as empresas naturalmente vê todas as tarefas. Vou apenas filtrar no client-side por `assigned_to` selecionado.

---

## 2) Aba "Apresentação ao Cliente" no projeto

### UI
Dentro de `KanbanBoard.tsx` (página do projeto) já existem abas (Kanban/Lista). Vou adicionar uma terceira aba **"Apresentação ao Cliente"** que renderiza um novo componente `ProjectPresentationBuilder`.

### Componente Builder (`src/components/presentation/`)
- **PresentationBuilder.tsx** — container com lista vertical de blocos editáveis + barra "Adicionar bloco".
- Tipos de bloco (`block_type`):
  - `header` — logo cliente + logo agência + título
  - `text` — texto rico simples (textarea com markdown leve)
  - `image` — upload único, alt, legenda
  - `gallery` — múltiplas imagens em grid
  - `instagram_preview` — mockup iPhone com feed (seção 3.2)
  - `posts_plan` — lista de posts (seção 3.3)
- Cada bloco: drag handle (reordenar via `@hello-pangea/dnd`), botão editar (abre painel lateral), botão deletar.
- Toolbar superior: **Status** (`rascunho` / `publicado`), **Visualizar** (preview da landing), **Copiar link público** (visível só se publicado E liberado).

### Persistência
Salvamento automático (debounce 800ms) na tabela `project_presentations` (ver migrations).

---

## 3) Landing Page pública do cliente

### Rota pública
- `/c/:slug` em `App.tsx`, **fora** do `RequireAuth` e do `AppLayout` (sem sidebar).
- Componente `src/pages/ClientLanding.tsx`.
- Lê `project_presentations` por slug usando o cliente Supabase normal — RLS abaixo libera SELECT público apenas quando `status = 'publicado' AND released = true`.

### Layout da landing
1. **Hero** — logo cliente (esquerda) + logo agência (direita) + descrição do projeto/campanha. Tipografia grande, fundo limpo.
2. **Preview Instagram** — mockup iPhone CSS (frame arredondado, notch, status bar) com grid 3-col simulando feed; suporta clicar em cada post pra abrir lightbox.
3. **Planejamento de Postagens** — lista responsiva (cards no mobile, tabela rica no desktop): thumb da arte, título, data formatada (`dd/MM/yyyy`), copy com "ver mais".
4. Rodapé discreto "Apresentado por {agência}".

Ambiente visual premium: gradientes sutis, animações de entrada (fade/slide), totalmente responsivo.

---

## 4) Mudanças no banco (migrations)

```sql
-- Apresentação por projeto
create table public.project_presentations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique,
  slug text not null unique,                -- usado em /c/:slug
  status text not null default 'rascunho',  -- rascunho | publicado
  released boolean not null default false,  -- liberação manual da equipe
  client_logo_url text,
  agency_logo_url text,
  hero_title text,
  hero_description text,
  theme jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Blocos ordenados
create table public.presentation_blocks (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null,
  block_type text not null,   -- header | text | image | gallery | instagram_preview | posts_plan
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Posts planejados (seção 3 da landing)
create table public.presentation_posts (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null,
  position integer not null default 0,
  image_url text,
  title text,
  publish_date date,
  copy text,
  created_at timestamptz not null default now()
);
```

**RLS** (resumo):
- Equipe (admin/editor) com `has_company_access` no projeto: ALL.
- Visualizador aprovado com acesso à empresa: SELECT.
- **Público anônimo**: SELECT em `project_presentations` somente quando `status='publicado' AND released=true`; mesma regra em cascata para `presentation_blocks` e `presentation_posts` via EXISTS.

---

## 5) Arquivos

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Rotas `/minhas-tarefas` e pública `/c/:slug` |
| `src/components/AppSidebar.tsx` | Item "Minhas Tarefas" em Principal |
| `src/pages/MyTasks.tsx` | **Novo** — 3 visões + filtros + admin user-picker |
| `src/components/calendar/{MonthView,WeekView,DayView}.tsx` | **Novo** — extraídos de `TaskCalendar` para reutilizar |
| `src/pages/TaskCalendar.tsx` | Refactor leve para usar os componentes extraídos |
| `src/pages/KanbanBoard.tsx` | Aba "Apresentação ao Cliente" |
| `src/components/presentation/PresentationBuilder.tsx` | **Novo** — editor de blocos |
| `src/components/presentation/blocks/*.tsx` | **Novo** — um arquivo por tipo de bloco |
| `src/pages/ClientLanding.tsx` | **Novo** — landing pública `/c/:slug` |
| migrations SQL | Tabelas + RLS acima |

---

## 6) Escopo intencionalmente fora desta entrega

- **Integração real com API do Instagram**: o preview usa imagens manualmente inseridas (mockado), conforme permitido pelo brief ("mockado ou integrado via API"). Integração via Graph API fica como evolução.
- **Hospedagem separada de frontend cliente**: a landing fica no mesmo domínio sob `/c/:slug` (rota pública sem layout interno). Domínio separado pode ser configurado depois via custom domain.

