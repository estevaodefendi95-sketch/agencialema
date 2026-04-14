

## Plano: Rolagem horizontal fluida + Seletor de cor personalizada

### 1. Melhorar fluidez da rolagem horizontal (UX)

No container `flex gap-4 overflow-x-auto pb-4` do modo card:
- Adicionar `scroll-smooth` e estilos CSS para esconder a scrollbar nativa (usando `-webkit-scrollbar` / `scrollbar-width: none`)
- Adicionar padding horizontal e `snap-x snap-mandatory` com `snap-start` em cada coluna para scroll com snap suave
- Garantir área de scroll com padding no final para o botão "Adicionar coluna" não ficar cortado

Arquivo: `KanbanBoard.tsx` (classes do container flex) + `src/index.css` (classe utilitária para esconder scrollbar)

### 2. Botão de cor personalizada (caneta/paleta)

Em todas as 4 instâncias do seletor de cores (coluna lista, coluna card, tarefa lista, tarefa card):
- Adicionar como último item um botão com ícone `Pencil` que, ao clicar, abre um `<input type="color">` nativo do navegador
- Ao selecionar a cor no color picker, chamar `saveColumnColor` ou `saveTaskColor` com o valor hex escolhido

Isso permite cores customizadas além das 8 pré-definidas.

### Resumo

| Mudança | Onde |
|---------|------|
| Scroll suave + snap + esconder scrollbar | `KanbanBoard.tsx` + `index.css` |
| Botão caneta → color picker nativo | 4 popovers de cor em `KanbanBoard.tsx` |

