

## Adicionar filtro de Empresa antes do Projeto em "Nova Tarefa"

No diálogo **Nova Tarefa** da aba *Minhas Tarefas*, o usuário hoje escolhe direto o projeto numa lista única (todos os projetos visíveis). Vamos adicionar um passo anterior — selecionar **Empresa** — e o select de Projeto passa a listar **somente os projetos daquela empresa**.

### Alterações em `src/pages/MyTasks.tsx`

**1) Estado**
- Adicionar `allCompanies: { id, name }[]` e `ntCompany: string`.
- `allProjects` passa a guardar também `company_id` (já está sendo selecionado como `select("id, name")` — mudar para `select("id, name, company_id")`).

**2) Carregamento**
- Novo `loadAllCompanies()`: `select("id, name").order("name")` na tabela `companies` (RLS já filtra por acesso do usuário).
- Chamar `loadAllCompanies()` no mesmo `useEffect` que hoje chama `loadAllProjects()` quando `canEdit`.

**3) Layout do diálogo (`~linha 593`)**
Antes do campo "Projeto", adicionar:
```
Empresa *
[Select] Selecione uma empresa...
```
- Ao trocar a empresa: `setNtProject("")` e `setNtAssignee("")` (limpa cascata).
- Select de Projeto fica **desabilitado** enquanto não houver `ntCompany`, com placeholder "Escolha uma empresa primeiro".
- Lista do select de Projeto: `allProjects.filter(p => p.company_id === ntCompany)`.

**4) Reset ao fechar/criar**
- Em `createTask` (sucesso) e ao cancelar: limpar `ntCompany` junto com os outros campos.

**5) Validação**
- Botão "Criar" desabilitado se faltar `ntCompany`, `ntProject` ou `ntTitle` (já tem os dois últimos).

### Não muda

- Demais campos do diálogo (Título, Descrição, Prioridade, Prazo, Responsável).
- Lógica de `project_columns` para definir status inicial.
- RLS, schema e fluxo de `INSERT` em `tasks`.
- Filtro de "Projeto" na toolbar de listagem (continua mostrando os projetos das tarefas atuais).

### Resultado

O diálogo "Nova Tarefa" terá agora dois selects encadeados — **Empresa → Projeto** — facilitando encontrar o projeto correto quando o usuário tem acesso a vários.

