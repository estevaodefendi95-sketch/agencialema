

## Plano Atualizado: Sistema de Controle de Acesso pelo ADMIN

### Mudança Principal

O ADMIN controla totalmente o ciclo de vida dos usuários:
1. **Cadastro controlado** — Usuários não se auto-registram livremente. O ADMIN cria/convida usuários.
2. **Aprovação de login** — Novos usuários ficam com status "pendente" até o ADMIN aprovar.
3. **Definição de perfil** — O ADMIN define se o usuário é ADMIN ou CLIENTE.
4. **Escopo de visibilidade** — O ADMIN vincula o CLIENTE a uma ou mais empresas, determinando exatamente o que ele pode ver.

---

### Estrutura de Banco de Dados

**Tabelas de controle de acesso:**

```text
user_roles
├── id (uuid, PK)
├── user_id (uuid → auth.users)
├── role (enum: admin, cliente)
└── unique(user_id, role)

user_company_access
├── id (uuid, PK)
├── user_id (uuid → auth.users)
├── company_id (uuid → companies)
└── unique(user_id, company_id)

profiles
├── id (uuid, PK → auth.users)
├── full_name (text)
├── email (text)
├── avatar_url (text)
├── status (enum: pendente, aprovado, bloqueado)
├── created_at
└── updated_at
```

**Fluxo:**
- ADMIN cria convite (por email) → usuário recebe link → faz cadastro → status fica "pendente"
- ADMIN aprova → define role (CLIENTE) → vincula às empresas permitidas
- Usuário só consegue acessar o sistema após aprovação
- RLS filtra dados usando `user_company_access` para CLIENTEs

---

### Funcionalidades do Painel ADMIN

1. **Gestão de Usuários** (`/admin/usuarios`)
   - Lista de todos os usuários com status (pendente/aprovado/bloqueado)
   - Botões: Aprovar, Bloquear, Editar
   - Ao aprovar: selecionar role e vincular empresas

2. **Edição de Acesso** (modal ou página)
   - Alterar role do usuário
   - Adicionar/remover empresas visíveis para o CLIENTE
   - Bloquear/desbloquear acesso

3. **Convite de Usuários**
   - ADMIN envia convite por email
   - Link de cadastro com token de convite

---

### Segurança (RLS)

- **ADMIN**: acessa tudo (verificado via função `has_role`)
- **CLIENTE**: só vê dados de empresas vinculadas em `user_company_access`
- **Usuários pendentes/bloqueados**: nenhum acesso a dados (RLS bloqueia)
- Função `security definer` para checar role sem recursão

---

### Implementação — 3 Etapas

**Etapa 1: Banco + Auth + Proteção de rotas**
- Configurar Supabase Auth (email/senha)
- Criar tabelas: `profiles`, `user_roles`, `user_company_access`, `companies`
- Trigger para criar profile com status "pendente" no signup
- RLS policies com `has_role()` e checagem de `user_company_access`
- Página de login + tela "Aguardando aprovação" para pendentes

**Etapa 2: Painel ADMIN de Gestão de Usuários**
- Página de listagem de usuários com filtros por status
- Fluxo de aprovação: aprovar → definir role → vincular empresas
- Convite por email
- CRUD de empresas

**Etapa 3: Restante do MVP**
- Dashboard diferenciado (ADMIN vs CLIENTE)
- Projetos, Kanban, Tarefas, Aprovações, Notificações
- Dark/light mode toggle
- Tudo em PT-BR

---

### Resumo da Mudança

| Antes | Agora |
|-------|-------|
| Usuário escolhe seu tipo no cadastro | ADMIN define o tipo do usuário |
| Auto-registro livre | Cadastro requer aprovação do ADMIN |
| Cliente vê "sua empresa" automaticamente | ADMIN define quais empresas o cliente pode ver |

