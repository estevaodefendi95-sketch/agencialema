

## Plano: Lixeira discreta no TaskDetail + Toggle Card/Lista em Empresas e Projetos

### 1. Lixeira mais discreta no TaskDetail

Atualmente o botão de excluir (lixeira vermelha) está ao lado do título, muito próximo do X de fechar. Mudança:
- Mover o botão de excluir para o **final do dialog** (rodapé), com estilo `ghost` e texto "Excluir tarefa" em vermelho discreto
- Manter o X de fechar no canto superior direito (padrão do Dialog)
- Isso separa visualmente as duas ações e evita cliques acidentais

### 2. Toggle Card/Lista em Empresas (`Companies.tsx`)

- Adicionar estado `viewMode` ("card" | "lista") com persistência em `localStorage` (chave `view-mode-empresas`)
- Toggle com ícones `LayoutGrid` (Card) e `List` (Lista) no cabeçalho, ao lado do botão "Nova Empresa"
- **Modo Card**: layout atual (grid de cards)
- **Modo Lista**: tabela com colunas: Logo, Nome, Slug, Descrição, Ações

### 3. Toggle Card/Lista em Projetos (`Projects.tsx`)

- Mesmo padrão: estado `viewMode` com `localStorage` (chave `view-mode-projetos`)
- Toggle Card/Lista no cabeçalho
- **Modo Card**: layout atual
- **Modo Lista**: tabela com colunas: Nome, Empresa, Prazo, Descrição

### 4. Renomear labels no KanbanBoard

- Trocar "Kanban" / "Lista" por "Card" / "Lista" nos botões de toggle existentes

### Resumo

| Mudança | Arquivo |
|---------|---------|
| Lixeira para rodapé, separada do X | `TaskDetail.tsx` |
| Toggle Card/Lista + tabela | `Companies.tsx` |
| Toggle Card/Lista + tabela | `Projects.tsx` |
| Renomear labels do toggle | `KanbanBoard.tsx` |

