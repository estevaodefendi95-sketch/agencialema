
## Plano

Identifiquei duas causas prováveis no código atual:

1. O card mostra a contagem de comentários porque ela é carregada por uma query separada em `KanbanBoard.tsx`.
2. No modal, os comentários são buscados em `TaskDetail.tsx` com `select("*, profiles(full_name, nickname)")`, mas o projeto não expõe relacionamento válido de `task_comments -> profiles` desse jeito. Resultado: a contagem aparece, mas a lista pode vir vazia/erro silencioso.

### 1. Corrigir carregamento dos comentários no modal
Em `src/components/TaskDetail.tsx`:
- Ajustar a busca de comentários para usar uma relação válida com o autor:
  - tentar via alias explícito `profiles:user_id(...)` se o relacionamento existir no backend
  - se não existir, fazer em 2 etapas:
    - buscar comentários de `task_comments`
    - buscar perfis dos `user_id`
    - montar a lista enriquecida no frontend
- Tratar erro de carregamento com toast/log seguro, para não falhar silenciosamente.
- Garantir que, se houver comentários, eles sempre sejam renderizados visivelmente ao abrir a tarefa.

### 2. Deixar os comentários sempre visíveis quando existirem
Ainda em `TaskDetail.tsx`:
- Manter o painel minimizado por padrão só quando não houver comentários.
- Se existirem comentários salvos, abrir o bloco automaticamente.
- Preservar o comportamento de expandir ao postar novo comentário.

### 3. Garantir persistência visual após reabrir
- Revisar o `load()` do modal para não sobrescrever `comments` com vazio por causa de query inválida.
- Validar que o comentário recém-lançado continue visível após fechar e reabrir a tarefa.

### 4. Corrigir enquadramento do botão “Salvar” com o X
No cabeçalho de `TaskDetail.tsx`:
- Reorganizar o topo do modal para o CTA “Salvar” não disputar espaço com o botão de fechar.
- Aplicação prevista:
  - reservar espaço à direita para o X
  - mover/alinhar o botão “Salvar” em uma área própria do header
  - garantir bom encaixe no viewport atual (910x638) e em larguras menores

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/components/TaskDetail.tsx` | Corrigir query/renderização dos comentários; abrir comentários quando houver conteúdo; ajustar layout do cabeçalho para separar “Salvar” do X |

### Resultado esperado
- O número de comentários no card passa a bater com o que aparece dentro da tarefa.
- Comentários lançados ficam visíveis ao abrir/reabrir o modal.
- O cabeçalho fica limpo, sem sobreposição entre “Salvar” e o X.
