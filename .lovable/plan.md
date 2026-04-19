

## Plano

O card de edição de tarefas voltou a ter problema de scroll porque o painel de comentários fixo no rodapé ocupa altura demais e empurra o conteúdo principal. Solução: tornar o painel de comentários **minimizável** (colapsável com botão chevron), preservando o estado e garantindo o scroll vertical da área principal em qualquer caso.

### Mudanças em `src/components/TaskDetail.tsx`

1. **Estado de minimização**
   - Adicionar `const [commentsOpen, setCommentsOpen] = useState(true)` (começa aberto para não esconder a funcionalidade).

2. **Header do painel de comentários** (rodapé fixo do dialog)
   - Manter o `<div>` fixo `shrink-0 border-t`.
   - Header clicável com: título "Comentários (n)" à esquerda + botão `ChevronDown`/`ChevronUp` à direita que alterna `commentsOpen`.
   - Cursor pointer no header inteiro.

3. **Corpo do painel (condicional)**
   - Quando `commentsOpen === true`: renderiza textarea + botão "Comentar" + `ScrollArea h-[200px]` com a lista de comentários.
   - Quando `commentsOpen === false`: nada é renderizado abaixo do header — o painel ocupa só ~48px e o `ScrollArea` principal (`flex-1 min-h-0`) ganha todo o espaço restante.

4. **Garantir scroll principal funcional**
   - Confirmar `DialogContent` com `h-[90vh] flex flex-col overflow-hidden`.
   - `ScrollArea` principal: `flex-1 min-h-0` (já está).
   - Footer "Excluir tarefa": `shrink-0` (já está).
   - Painel de comentários: `shrink-0` sempre, alturas previsíveis em ambos estados.

5. **Persistência do comentário**
   - Manter optimistic update já implementado em `addComment` (sem `load()` destrutivo).
   - Após postar com painel aberto, comentário aparece na `ScrollArea` interna e permanece.

### Resultado
- Card de edição com scroll vertical funcionando corretamente em telas baixas (638px).
- Usuário pode minimizar comentários para ver a tarefa inteira sem rolar.
- Quando expandido, comentários ficam visíveis em área rolável de 200px no rodapé.
- Comentário postado continua aparecendo instantaneamente e permanece.

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/components/TaskDetail.tsx` | Adicionar estado `commentsOpen`, header colapsável com chevron, condicionar render do textarea+lista, garantir layout flex correto |

