

## Análise Arquitetural: SaaS Multi-Agência

### Situação Atual
O sistema tem um admin master único (`estevaodefendi95@gmail.com`) que controla tudo. "Empresas" são os clientes da agência. Não existe isolamento entre agências — é um sistema single-tenant.

### O que precisa mudar para Multi-Agência

O conceito central é introduzir **Agências** como entidade de primeiro nível (tenant). Cada agência tem seus próprios clientes (empresas), projetos, usuários e branding.

```text
┌─────────────────────────────────────────┐
│            SUPER ADMIN                  │
│    (estevaodefendi95@gmail.com)          │
│    Vê tudo, gerencia agências           │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐     │
│  │  Agência A   │  │  Agência B   │     │
│  │  (tenant)    │  │  (tenant)    │     │
│  │              │  │              │     │
│  │ Admin: João  │  │ Admin: Maria │     │
│  │ Logo: X      │  │ Logo: Y      │     │
│  │              │  │              │     │
│  │ Clientes:    │  │ Clientes:    │     │
│  │  - Empresa 1 │  │  - Empresa 3 │     │
│  │  - Empresa 2 │  │  - Empresa 4 │     │
│  │              │  │              │     │
│  │ Projetos:    │  │ Projetos:    │     │
│  │  pertence a  │  │  pertence a  │     │
│  │  suas empr.  │  │  suas empr.  │     │
│  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────┘
```

### Plano de Implementação

#### 1. Banco de Dados: Tabela `agencies` (novo tenant)

Nova tabela `agencies` com: `id`, `name`, `slug`, `logo_url`, `app_name`, `created_at`. Cada agência é um tenant isolado.

- Adicionar `agency_id` nas tabelas: `companies`, `profiles`, `projects` (via company), `user_company_access`
- Novo role: `agency_admin` — admin da agência, pode gerenciar apenas seus dados
- RLS: todas as queries filtram por `agency_id` do usuário logado

#### 2. Branding por Agência

Ao invés de um `app_settings` global, cada agência tem seu próprio `logo_url` e `app_name` na tabela `agencies`. O admin da agência personaliza o cabeçalho/sidebar com a logo e nome dele. O `app_settings` global fica apenas para o super admin (login page, configs globais).

#### 3. Nomes customizáveis das colunas do Kanban

Nova tabela `project_column_labels` ou campo JSON no projeto:
- Permite que o admin da agência renomeie as colunas (ex: "A Fazer" → "Backlog", "Aprovado" → "Entregue")
- Cada projeto pode ter seus próprios nomes de coluna
- Fallback para os nomes padrão se não customizado

#### 4. Isolamento de dados (RLS)

- Função `get_user_agency_id(user_id)` retorna o agency_id do usuário
- Todas as policies de RLS filtram: `agency_id = get_user_agency_id(auth.uid())`
- Super admin (`estevaodefendi95@gmail.com`) bypassa o filtro de agency

#### 5. Fluxo de cadastro de agência

- Super admin cria a agência e define o admin da agência
- Admin da agência convida seus editores e clientes
- Clientes só veem projetos das empresas vinculadas à agência deles

### Resumo das Mudanças

| Mudança | Tipo |
|---------|------|
| Criar tabela `agencies` | Migration |
| Adicionar `agency_id` em `companies`, `profiles` | Migration |
| Criar role `agency_admin` no enum `app_role` | Migration |
| RLS com filtro por `agency_id` em todas as tabelas | Migration |
| Branding por agência (sidebar/header) | `AppSidebar.tsx`, `AppLayout.tsx` |
| Tela de gerenciamento de agências (super admin) | Nova página |
| Admin da agência personaliza logo/nome | `AdminSettings.tsx` |
| Nomes customizáveis das colunas Kanban | `KanbanBoard.tsx` + tabela/campo |
| Função `get_user_agency_id()` | Migration |

### Impacto

Esta é uma mudança arquitetural significativa que toca praticamente todas as tabelas e queries. Recomendo implementar em fases:

1. **Fase 1**: Criar `agencies`, migrar dados, atualizar RLS
2. **Fase 2**: Branding por agência + tela de gerenciamento
3. **Fase 3**: Kanban customizável + refinamentos

Deseja aprovar para começar pela Fase 1?

