

## Reorganizar sidebar em subcategorias

Hoje todos os 8 itens ficam soltos numa única lista. Vou agrupar em 3 seções com labels discretas + uma seção admin colapsável, deixando o menu mais respirável e escaneável.

### Nova estrutura

```text
nortyx.
─────────────
PRINCIPAL
  Dashboard
  Calendário

GESTÃO
  Empresas
  Projetos

ADMIN  (somente isAdmin, colapsável, aberto por padrão na rota admin)
  Usuários
  Configurações

CONTA
  Notificações
  Meu Perfil
─────────────
[Modo escuro] [Sair]
```

### Mudanças em `src/components/AppSidebar.tsx`

1. **Header isolado** — mover logo + `app_name` para fora dos grupos (sem `SidebarGroupLabel`), criando um cabeçalho enxuto no topo.
2. **3–4 `SidebarGroup`** com `SidebarGroupLabel` em texto pequeno, uppercase, `text-xs text-muted-foreground` (já é o estilo nativo do shadcn) — só aparece quando `!collapsed`:
   - **Principal**: Dashboard, Calendário
   - **Gestão**: Empresas, Projetos
   - **Admin** (condicional `isAdmin`): Usuários, Configurações
   - **Conta**: Notificações, Meu Perfil
3. **Item ativo** — manter o highlight `bg-sidebar-accent text-sidebar-primary font-medium` já existente.
4. **Modo colapsado** — labels de grupo somem automaticamente; ícones continuam alinhados. Sem mudança visual quebrada.
5. **Footer** — sem alteração (tema + sair).

### Resultado
Menu visualmente mais limpo, com hierarquia clara, separando navegação do dia a dia (Principal/Gestão) do que é administrativo e do que é pessoal (Conta).

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/components/AppSidebar.tsx` | Header dedicado + 3–4 SidebarGroups com SidebarGroupLabel ("Principal", "Gestão", "Admin", "Conta") |

