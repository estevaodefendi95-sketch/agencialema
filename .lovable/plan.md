

## Plano: Remover Agências + Impressão PDF de Projetos

### Parte 1 — Remover o conceito de "Agências"

A multi-tenancy via agência será desativada. O sistema passa a ser single-tenant por instalação: o cliente que contrata o SaaS gerencia tudo dentro do seu próprio ambiente.

**Frontend**
- Remover rota `/admin/agencias` em `App.tsx`
- Remover import e item do menu "Agências" em `AppSidebar.tsx`
- Excluir página `src/pages/AdminAgencias.tsx`
- Em `AuthContext.tsx`: remover `agencyId`, `isAgencyAdmin`, `isSuperAdmin` (manter apenas `isAdmin` baseado em role `admin`)
- Ajustar `AdminUsers.tsx` e demais telas que usam `isAgencyAdmin`/`isSuperAdmin` para usar apenas `isAdmin`

**Backend (migração SQL)**
- Reescrever as policies RLS de `companies`, `projects`, `tasks`, `project_columns`, `project_members`, `project_history`, `task_*`, `notifications`, `user_roles`, `user_company_access`, `profiles` removendo qualquer referência a `agency_id` / `get_user_agency_id` / `is_super_admin`
- Novo modelo de acesso simplificado:
  - `admin` → acesso total a tudo
  - `editor` / `visualizador` / `cliente` → acesso filtrado por `user_company_access`
- Promover `estevaodefendi95@gmail.com` e `estevaodefendi@outlook.com` ao role `admin` (já são) e garantir que `admin` enxergue tudo sem depender de agência
- Dropar coluna `agency_id` de `profiles` e `companies`
- Dropar tabela `agencies` e função `get_user_agency_id`
- Manter `is_super_admin` apenas se útil, ou remover

### Parte 2 — Impressão PDF do Projeto (Kanban)

Na página `KanbanBoard.tsx` (`/projetos/:id`), adicionar botão **"Imprimir / PDF"** no header.

**Fluxo:**
1. Clicar abre um `Dialog` "Preparar impressão" com:
   - Lista de todas as tarefas do projeto agrupadas por coluna
   - Checkbox em cada tarefa (todas marcadas por padrão)
   - Botões "Selecionar todas" / "Limpar seleção"
   - Filtros rápidos por coluna e por responsável (opcional, marca/desmarca em lote)
   - Botão **"Gerar PDF"**
2. Ao confirmar, abre uma rota/visão de impressão (`/projetos/:id/imprimir?ids=...`) ou um layout oculto otimizado com CSS `@media print`:
   - Cabeçalho: nome do projeto, empresa, data de geração, logo do app
   - Tarefas selecionadas agrupadas por coluna, mostrando: título, descrição, prioridade, prazo, responsável, checklist (resumo)
   - Layout limpo, preto-no-branco, quebras de página entre colunas grandes
3. Dispara `window.print()` automaticamente — usuário escolhe "Salvar como PDF" no diálogo nativo do navegador (sem dependência extra, funciona em qualquer browser)

**Arquivos:**
- `KanbanBoard.tsx`: botão + dialog de seleção
- Novo componente `src/components/PrintProjectView.tsx`: layout de impressão com CSS print
- `src/index.css`: regras `@media print` (esconder sidebar, ajustar fontes, evitar quebras dentro de cards)

### Resumo

| Mudança | Onde |
|---|---|
| Remover rota e página Agências | `App.tsx`, deletar `AdminAgencias.tsx` |
| Remover item do menu | `AppSidebar.tsx` |
| Simplificar AuthContext (sem agência) | `AuthContext.tsx` |
| Reescrever RLS sem agency_id | Migração SQL |
| Drop coluna agency_id + tabela agencies | Migração SQL |
| Botão "Imprimir / PDF" + dialog de seleção | `KanbanBoard.tsx` |
| Layout de impressão | `PrintProjectView.tsx` + `index.css` |

