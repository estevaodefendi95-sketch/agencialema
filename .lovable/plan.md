

## Plano: Responsável na criação + Status de convite na equipe

### 1. Campo Responsável no dialog "Nova Tarefa" (`KanbanBoard.tsx`)

Já existe `newAssignedTo` no estado e a lógica de salvar. Verificar/garantir que o `Select` de responsável esteja realmente renderizado no dialog "Nova Tarefa", populado por `projectMembers` (membros do projeto). Se ausente ou escondido, adicionar o campo no formulário do dialog antes do botão de criar.

### 2. Status de convite em `project_members`

**Migração SQL:**
- Adicionar coluna `status text NOT NULL DEFAULT 'ativo'` em `project_members` (valores: `pendente`, `ativo`)
- Adicionar coluna `invited_email text` (para convites por e-mail antes do usuário existir/aceitar)
- Adicionar coluna `invited_at timestamptz DEFAULT now()`

**Lógica de convite (`KanbanBoard.tsx` — Sheet de equipe):**
- Ao convidar um membro por e-mail:
  - Se o e-mail corresponder a um usuário existente com acesso à empresa do projeto → criar `project_members` com `status = 'ativo'`
  - Caso contrário → criar `project_members` com `user_id = null`, `invited_email = email`, `status = 'pendente'`
- Exibir o membro convidado imediatamente na lista da equipe com badge **"Aguardando aprovação"** (amarelo) quando `status = 'pendente'`
- Membros ativos aparecem com badge verde **"Ativo"** (ou sem badge)

### 3. Aprovação automática ao entrar no projeto

Quando um usuário fizer login e tiver acesso à empresa do projeto:
- Criar função/trigger SQL que, ao inserir em `user_company_access`, faça `UPDATE project_members SET user_id = <novo user>, status = 'ativo', invited_email = null WHERE invited_email = <email do user> AND project pertence à company`
- Alternativamente, resolver no client: ao abrir o projeto, rodar uma função RPC que faz o "claim" dos convites pendentes do e-mail do usuário logado

Abordagem escolhida: **trigger SQL** em `user_company_access` (mais robusto e automático).

### 4. UI do Sheet "Equipe do projeto"

- Lista de membros com avatar, nome (ou e-mail se pendente), badge de status
- Pendentes aparecem com ícone de relógio + "Aguardando aprovação"
- Botão remover funciona em ambos os estados

### Resumo

| Mudança | Onde |
|---------|------|
| Garantir Select Responsável no dialog Nova Tarefa | `KanbanBoard.tsx` |
| Colunas `status`, `invited_email`, `invited_at` | Migração SQL `project_members` |
| Convite cria membro pendente imediato | `KanbanBoard.tsx` (Sheet equipe) |
| Trigger ativa membro ao ganhar acesso à empresa | Migração SQL |
| Badge "Aguardando aprovação" / "Ativo" | `KanbanBoard.tsx` (Sheet equipe) |

