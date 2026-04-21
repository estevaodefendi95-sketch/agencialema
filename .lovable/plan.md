

## Permitir criar tarefas em "Minhas Tarefas" + foto de perfil no menu lateral

### 1) Botão "Nova Tarefa" em Minhas Tarefas

Hoje a página `/minhas-tarefas` só lista — não cria. O Kanban (`KanbanBoard.tsx`) já tem o diálogo completo, mas exige `projectId` fixo. Em "Minhas Tarefas" o usuário precisa **escolher o projeto** no momento da criação.

**Onde:** `src/pages/MyTasks.tsx`, header (linha ~238) — adicionar botão "Nova Tarefa" ao lado do select de "Ver tarefas de…".

**Diálogo simplificado** (novo, dentro do próprio `MyTasks.tsx`, sem reaproveitar o do Kanban para evitar acoplamento):
- **Projeto** *(obrigatório)*: Select com todos os projetos onde o usuário tem acesso (via `companies` que ele tem acesso → `projects`). Carregar uma vez ao montar.
- **Título** *(obrigatório)*.
- **Descrição** (opcional, textarea).
- **Prioridade** (baixa/media/alta/urgente, default `media`).
- **Prazo** (date input, opcional).
- **Responsável**: select com membros do projeto escolhido (carregado dinamicamente via `project_members` ao trocar projeto). Default = usuário atual.
- **Status**: primeira coluna do projeto (busca em `project_columns` ordenado por `position`; fallback `a_fazer`).

**Regra de permissão:** botão só aparece se `canEdit` (admin/editor) — RLS já bloqueia o resto.

**Ação salvar:**
- `INSERT` em `tasks` com `project_id`, `title`, `description`, `priority`, `due_date`, `assigned_to`, `status`, `created_by = user.id`, `position = 0`.
- Após sucesso: toast, fechar diálogo, recarregar lista (`loadTasks(selectedUser)`).

**Visibilidade na lista:** se o `assigned_to` da tarefa criada for o `selectedUser` atual, ela aparece automaticamente após o reload.

### 2) Foto do perfil no item "Meu Perfil" da sidebar

**Onde:** `src/components/AppSidebar.tsx`, item `{ title: "Meu Perfil", url: "/perfil", icon: UserCircle }` (linha 63).

**Como:**
- Usar `avatarUrl` do `useAuth()` (já exposto).
- No `renderMenu`, detectar quando o item é "Meu Perfil" e renderizar `<AssigneeAvatar url={avatarUrl} name={...} className="h-4 w-4 mr-2" />` no lugar de `<item.icon className="mr-2 h-4 w-4" />`.
- Se `avatarUrl` for `null`, cai no fallback do próprio `AssigneeAvatar` (iniciais), que já fica circular e minimalista — alinhado com a imagem de referência.
- No modo `collapsed` da sidebar, mesmo tratamento (avatar circular pequeno).

### Detalhes técnicos

**MyTasks.tsx (novo state e fetch):**
```ts
const [allProjects, setAllProjects] = useState<{id, name, company_id}[]>([])
const [projectMembers, setProjectMembers] = useState<Profile[]>([])
const [openNewTask, setOpenNewTask] = useState(false)
// form state: newProjectId, newTitle, newDesc, newPriority, newDueDate, newAssignedTo
```
- `loadAllProjects()`: `select id, name, company_id from projects where archived=false` (RLS já filtra acesso).
- Quando `newProjectId` muda → carrega `project_members` + `profiles` daquele projeto.
- Status inicial: query `project_columns where project_id=? order by position asc limit 1`.

**Sem mudanças de schema** (tabela `tasks` já suporta tudo).

### Não muda

- Lógica de listagem, filtros, drag-and-drop, calendário.
- Outros menus da sidebar — só "Meu Perfil" troca o ícone.
- Diálogo do Kanban permanece como está.
- RLS de `tasks` já permite editores/admins criarem.

### Resultado

- Em "Minhas Tarefas" surge um botão **"Nova Tarefa"** que abre um diálogo permitindo criar tarefas em qualquer projeto acessível, atribuindo a si mesmo (ou a outro membro), e a tarefa aparece imediatamente na lista quando atribuída ao usuário visível.
- O item **"Meu Perfil"** da barra lateral passa a exibir a foto de perfil circular do usuário no lugar do ícone genérico — com fallback elegante para iniciais quando não há foto.

