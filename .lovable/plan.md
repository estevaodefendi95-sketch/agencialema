

## Plano: Personalização, Mídias e Gestão Avançada de Usuários

### 1. Configurações do Sistema (nome + logo)

**Nova tabela `app_settings`** com campos `app_name` (text), `logo_url` (text). Uma única linha (singleton).

**Nova página `/admin/configuracoes`** onde o ADMIN pode:
- Alterar o nome da aplicação (substitui "GestãoPro" no header e sidebar)
- Fazer upload de uma logo (exibida no header e sidebar)

**Impacto nos componentes**: `AppLayout.tsx` e `AppSidebar.tsx` leem de `app_settings` para exibir nome/logo dinâmicos.

---

### 2. Logo da Empresa (upload pequeno)

No CRUD de empresas (`Companies.tsx`), adicionar campo de upload de logo:
- Upload para o bucket `attachments` (já existente)
- Salvar URL no campo `logo_url` da tabela `companies`
- Exibir logo pequena (32x32) nos cards de empresa, substituindo o ícone genérico

---

### 3. Mídias nos Cards de Tarefas (banners, fotos, vídeos)

**Nova tabela `task_media`**: `id`, `task_id`, `file_url`, `file_name`, `file_type` (image/video), `created_at`.

No Kanban:
- Cards exibem thumbnail da primeira imagem/banner (se houver)
- No `TaskDetail`, seção de mídias com upload múltiplo e preview (imagens inline, vídeos com player)
- Suporte a imagens (jpg, png, webp) e vídeos (mp4, webm)

---

### 4. Permissões Granulares (editor, visualizador)

Atualizar o enum `app_role` para incluir novos valores: `admin`, `editor`, `visualizador`, `cliente`.

- **editor**: pode criar/editar tarefas e comentar nas empresas vinculadas
- **visualizador**: apenas visualiza tarefas e projetos (sem editar)
- **cliente**: mantém o comportamento atual (visualiza + aprova)

Atualizar o select de perfil no `AdminUsers.tsx` com as 4 opções. Ajustar RLS e condicionais no frontend para respeitar os novos níveis.

---

### 5. Admin Cria Novos Usuários (já aprovados)

No `AdminUsers.tsx`, adicionar botão **"Novo Usuário"** que abre um formulário com:
- Nome completo, email, senha temporária
- Seleção de role (admin/editor/visualizador/cliente)
- Vinculação a empresas

Usar uma **Edge Function** que chama `supabase.auth.admin.createUser()` com a service role key para criar o usuário diretamente. O perfil já é criado com status `aprovado` e role definido.

---

### Resumo Técnico

| Mudança | Tipo |
|---------|------|
| Tabela `app_settings` + RLS | Migration |
| Tabela `task_media` + RLS | Migration |
| Alterar enum `app_role` (adicionar editor, visualizador) | Migration |
| Atualizar RLS para novos roles | Migration |
| Edge Function `create-user` | Novo arquivo |
| Página `AdminSettings.tsx` | Novo componente |
| Atualizar `Companies.tsx` (upload logo) | Edição |
| Atualizar `AdminUsers.tsx` (criar usuário + novos roles) | Edição |
| Atualizar `TaskDetail.tsx` (upload de mídias) | Edição |
| Atualizar `KanbanBoard.tsx` (thumbnail nos cards) | Edição |
| Atualizar `AppSidebar.tsx` e `AppLayout.tsx` (nome/logo dinâmicos) | Edição |
| Nova rota `/admin/configuracoes` em `App.tsx` | Edição |

