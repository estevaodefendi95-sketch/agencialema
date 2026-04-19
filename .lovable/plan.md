

## Plano

### 1. Logo da empresa no cabeçalho do projeto (Kanban)
No `KanbanBoard.tsx`, o cabeçalho mostra apenas o **nome da empresa** em texto. Vou adicionar a **logo da marca** ao lado, igual já é feito na página de Projetos.

**Mudanças em `src/pages/KanbanBoard.tsx`:**
- Atualizar a query `load()` para trazer também `logo_url`:
  ```ts
  supabase.from("projects").select("name, company_id, companies(name, logo_url)")...
  ```
- Adicionar estado `companyLogo: string | null`.
- No header (linha ~504-508), renderizar:
  - Se `companyLogo` existir: `<img>` redondo (~32px) com a logo.
  - Senão: ícone `Building2` como fallback.
  - Ao lado: nome da empresa (pequeno) + nome do projeto (grande) — mantendo layout atual.

### 2. Scroll vertical do card de edição de tarefas
No viewport atual (638px de altura), o `DialogContent` usa `max-h-[90vh]` + `flex-col`. Quando o painel de comentários colapsável está fechado, o `ScrollArea` principal (`flex-1 min-h-0`) deveria funcionar — mas em telas baixas o conteúdo (descrição, prioridade, prazo, mídias, checklist, histórico) fica cortado e não rola corretamente porque o `details` não tem altura previsível e o flex não calcula direito.

**Mudanças em `src/components/TaskDetail.tsx`:**
- Garantir altura fixa do dialog: trocar `max-h-[90vh]` por `h-[90vh]` para o flexbox calcular `flex-1` corretamente.
- Adicionar `overflow-hidden` no `DialogContent` para impedir scroll do dialog inteiro.
- Garantir que o `<details>` de comentários tenha `overflow-hidden` no estado fechado e não interfira no cálculo do scroll principal.
- Ajustar a `ScrollArea` interna de comentários para `h-[200px]` fixo (em vez de `max-h-`) quando aberta, para previsibilidade.
- Confirmar que o footer "Excluir tarefa" continua `shrink-0` para não competir com o scroll.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | Buscar `logo_url` da empresa e renderizar logo no cabeçalho do projeto |
| `src/components/TaskDetail.tsx` | Corrigir cálculo de altura do dialog e do ScrollArea principal para garantir scroll vertical em telas pequenas |

