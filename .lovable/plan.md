

## Sidebar com seções colapsáveis

Hoje as seções (Principal, Gestão, Admin, Conta) estão sempre abertas. Vou torná-las colapsáveis, mantendo apenas **Principal** aberta por padrão. As demais começam recolhidas e o usuário expande clicando no label.

### Comportamento

- Cada `SidebarGroup` vira um `Collapsible` (já existe `@/components/ui/collapsible` no projeto).
- O `SidebarGroupLabel` vira o trigger — clicável, com chevron à direita que rotaciona ao abrir.
- Estado inicial:
  - **Principal** → aberta
  - **Gestão**, **Admin**, **Conta** → fechadas
- Auto-abertura inteligente: se a rota atual pertence a uma seção (ex.: `/empresas` → Gestão), essa seção abre automaticamente para mostrar o item ativo.
- Persistência opcional do estado em `localStorage` (`sidebar-section-{label}`) para lembrar a escolha do usuário entre navegações.
- Modo colapsado da sidebar (ícone): seções desaparecem como hoje, apenas ícones empilhados — sem chevron, sem agrupamento visual (já é o comportamento nativo).

### Visual do label

```
PRINCIPAL          ⌄
  Dashboard
  Calendário
GESTÃO             ›
ADMIN              ›
CONTA              ›
```

- Chevron `ChevronRight` do lucide, com `transition-transform` e `rotate-90` quando aberto.
- Label mantém `text-xs uppercase tracking-wider text-muted-foreground`, ganha `cursor-pointer hover:text-foreground` e `flex items-center justify-between w-full`.

### Mudanças em `src/components/AppSidebar.tsx`

1. Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` e `ChevronRight`.
2. Adicionar `defaultOpen: boolean` em cada entrada de `sections` (apenas Principal `true`).
3. Estado controlado por seção via `useState<Record<string, boolean>>`, inicializado com `defaultOpen` + leitura do `localStorage` + checagem se a rota atual está dentro da seção (`useLocation` + `section.items.some(i => matchesRoute(i.url))`).
4. Envolver cada grupo em `<Collapsible open={openMap[label]} onOpenChange={...}>`:
   - `CollapsibleTrigger asChild` → `SidebarGroupLabel` com chevron.
   - `CollapsibleContent` → `SidebarGroupContent` com a `SidebarMenu`.
5. Persistir `openMap` em `localStorage` no `onOpenChange`.
6. Quando `collapsed` (sidebar em modo ícone), renderizar como hoje (sem Collapsible, sem label) — mantém compatibilidade com `collapsible="icon"`.

### Arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/AppSidebar.tsx` | Seções viram Collapsible com chevron; só Principal aberta por padrão; auto-expande seção da rota ativa; persiste estado em localStorage |

### Resultado

Sidebar mais limpa: ao abrir o app o usuário vê apenas Dashboard e Calendário sob "Principal". Gestão, Admin e Conta ficam recolhidas até serem clicadas, reduzindo ruído visual.

