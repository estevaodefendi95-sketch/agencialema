

## Plano

### 1. Usuários pendentes — diagnóstico
Verifiquei o banco: **não há nenhum usuário com status `pendente`**. Todos os 4 perfis existentes estão `aprovado`. Por isso a aba "Pendentes" mostra "Nenhum usuário pendente". O sistema está funcionando — só não há cadastros aguardando aprovação no momento.

Para testar o fluxo: faça logout e crie uma nova conta pela tela de cadastro com outro email. Esse novo usuário aparecerá como `pendente` e cairá na aba.

**Observação**: o email `estevaodefendi95@gmail.com` é auto-aprovado como admin pela função `handle_new_user()`. Qualquer outro email entra como `pendente`.

### 2. Comentários fixados no card da tarefa
Hoje, em `TaskDetail.tsx`, comentários e histórico estão misturados em uma "Timeline de Atividade" única, dentro do mesmo `ScrollArea` do dialog. Vou reestruturar:

**Mudanças em `src/components/TaskDetail.tsx`:**

- **Separar comentários do histórico**: comentários ganham seção própria, histórico permanece como timeline secundária abaixo.
- **Painel de comentários fixo dentro do dialog**:
  - Título "Comentários (n)" sempre visível.
  - Lista de comentários em um container com **altura fixa (~280px)** e **scroll vertical próprio** (`ScrollArea` interno).
  - Cada comentário mostra: avatar/nome do usuário, data e hora formatadas (pt-BR), conteúdo, e ações de editar/excluir (já existem).
  - Ordem cronológica: mais recentes no topo (ou final, conforme preferência — vou manter recentes no topo para consistência com hoje).
- **Caixa de novo comentário fixa** logo acima da lista, sempre visível.
- **Layout do dialog ajustado**: descrição/checklist/mídias continuam no scroll principal; bloco de comentários vira uma seção com scroll independente (não rola junto com o resto).

**Estrutura visual final do dialog:**
```
┌─────────────────────────────────┐
│ Título da tarefa                │
├─────────────────────────────────┤
│ [scroll principal]              │
│  Descrição                      │
│  Prioridade / Prazo / Resp.     │
│  Mídias                         │
│  Checklist                      │
│  Histórico (linha do tempo)     │
├─────────────────────────────────┤
│ 💬 Comentários (3)         [fix]│
│  [textarea + enviar]            │
│  ┌─[scroll interno ~280px]──┐   │
│  │ Maria — 18/04 14:32      │   │
│  │ "Comentário aqui..."     │   │
│  │ ──────────────────────   │   │
│  │ João — 17/04 09:10       │   │
│  │ "Outro comentário..."    │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/components/TaskDetail.tsx` | Separar comentários do histórico; criar bloco fixo de comentários com scroll vertical próprio; manter nome do usuário, data e hora visíveis em cada comentário |

