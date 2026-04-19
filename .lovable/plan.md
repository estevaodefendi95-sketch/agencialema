

Usuário mostra 3 áreas no modal de tarefa com problema de "enquadramento" (ring azul colado nas bordas, campos com altura/proporção ruim):
1. Selects/Inputs de Prioridade e Prazo
2. Textarea de Descrição (muito alta, ring colado)
3. Input "Novo item..." do Checklist

Tudo está em `TaskDetail.tsx`. Causa: campos sem altura padronizada (`h-9`), textarea sem `min-h` controlado, e provavelmente uso de `focus:ring-2 ring-offset-2` somado a containers sem padding interno suficiente — daí o ring "vaza" visualmente.

## Plano

### Ajustes em `src/components/TaskDetail.tsx`

1. **Descrição (Textarea)**
   - `min-h-[80px]` (hoje deve estar bem maior), `text-sm`, `resize-none` ou `resize-y` controlado.
   - Wrapper `space-y-1.5`, label `text-sm`.

2. **Prioridade (Select) e Prazo (Input date)**
   - Ambos com `h-9 text-sm`.
   - Grid já existente mantida, apenas padronizar altura.
   - Wrapper `space-y-1.5`, label `text-sm`.

3. **Checklist — input "Novo item..."**
   - `h-9 text-sm`.
   - Botão de adicionar ao lado também `h-9` para alinhar.

4. **Consistência geral do modal**
   - Todos os labels: `text-sm`.
   - Todos os inputs/selects/date: `h-9 text-sm`.
   - Espaçamento entre label e campo: `space-y-1.5`.

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/components/TaskDetail.tsx` | Padronizar `h-9 text-sm` em inputs/selects/date, `min-h-[80px] text-sm` na textarea, `space-y-1.5` nos wrappers, alinhar botão do checklist |

### Resultado
Campos com altura uniforme, ring azul respirando dentro do card, descrição compacta e checklist alinhado.

