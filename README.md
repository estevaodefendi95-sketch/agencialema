# AgênciaLema

ERP para agências de marketing gerenciarem empresas clientes, projetos, tarefas
da equipe e um portal de acompanhamento para os próprios clientes.

## Principais funcionalidades

- **Kanban de tarefas** por projeto, com colunas customizáveis, prioridades,
  checklists, comentários, anexos e histórico (`/projetos/:id`).
- **Minhas Tarefas**: visão pessoal em cards, lista ou calendário, com criação
  rápida de tarefas.
- **Equipe**: carga de trabalho de cada pessoa (tarefas ativas, aprovadas,
  atrasadas e urgentes), visível para admin e editor (`/equipe`).
- **Aprovações**: fluxo de revisão onde tarefas concluídas avançam para o
  status "aprovado".
- **Apresentações/mockup de Instagram**: montagem de posts e blocos de
  apresentação por projeto, com preview exportável para o cliente.
- **Portal do cliente**: página pública por empresa (`/c/:slug`) onde o cliente
  acompanha projetos e aprova conteúdo sem precisar de acesso ao painel interno.
- **Painel administrativo**: gestão de usuários, empresas, configurações da
  aplicação e notificações.

## Papéis de usuário

| Papel | Descrição |
| --- | --- |
| `admin` | Acesso total: usuários, empresas, projetos, configurações. |
| `editor` | Gerencia projetos e tarefas das empresas às quais tem acesso; vê a página Equipe. |
| `visualizador` | Acesso somente leitura aos projetos/tarefas das empresas às quais tem acesso. |
| `cliente` | Acesso restrito ao portal do cliente (`/c/:slug`) das empresas vinculadas. |

## Rodando localmente

Pré-requisitos: Node.js 18+ e um projeto Supabase.

```sh
npm install
npm run dev
```

Crie um arquivo `.env.local` na raiz com as credenciais do seu projeto Supabase:

```sh
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

As migrations do banco (tabelas, RLS, views) ficam em `supabase/migrations`.

### Outros scripts

```sh
npm run build      # build de produção
npm run lint        # lint do projeto
npm run test        # roda a suíte de testes (vitest)
```
