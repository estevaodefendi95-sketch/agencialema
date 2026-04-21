

## Avatares circulares nos seletores de responsável

Adicionar a foto de perfil (circular, minimalista) nos dropdowns de responsável em três telas, tanto no botão (gatilho) quanto na lista de opções.

### Onde alterar

1. **`src/pages/MyTasks.tsx`** (Select "Eu mesmo / membros") — linhas ~248-263
2. **`src/pages/TaskCalendar.tsx`** (Select "Todos os responsáveis") — linhas ~524-543
3. **`src/pages/KanbanBoard.tsx`** (Select "Equipe") — linhas ~652-677

### Como ficará (visual)

- Cada item de membro: `Avatar` 20px (`h-5 w-5`) circular à esquerda + nome.
- Item especial ("Eu mesmo"): avatar do próprio usuário logado.
- Itens genéricos ("Todos", "Todos os responsáveis", "Sem responsável"): ícone neutro pequeno (`Users` / `UserX`) dentro de um círculo do mesmo tamanho — mantém alinhamento visual.
- Trigger (botão fechado): mostra o avatar do membro selecionado em vez do ícone `User` / `Users` atual; quando "Todos"/"Eu mesmo", mostra o ícone neutro.
- Fallback do Avatar: iniciais do nome (1-2 letras), fundo `bg-muted`, texto `text-[10px]` — mantém o look minimalista.

### Detalhes técnicos

**Componente reutilizável** novo: `src/components/AssigneeAvatar.tsx`
```tsx
type Props = { name?: string | null; url?: string | null; size?: number; className?: string };
// Renderiza <Avatar> circular com AvatarImage(url) + AvatarFallback(iniciais)
```
Usado tanto no `SelectValue` (trigger) quanto em cada `SelectItem`.

**MyTasks.tsx**
- Já carrega `members: Profile[]` com `avatar_url`. Adicionar `<AssigneeAvatar>` antes do nome em cada `SelectItem`.
- Para "Eu mesmo": buscar avatar do próprio user. Já existe `profiles` carregado; incluir o user atual via `members.find(m => m.id === user.id)` ou puxar do `AuthContext` (adicionar `avatarUrl` ao contexto — alternativa mais simples: incluir o próprio user em `members` no fetch).
- Trigger: substituir `<User className="h-4 w-4" />` por `<AssigneeAvatar>` do membro selecionado.

**TaskCalendar.tsx**
- `assigneeOptions.list` precisa expor `avatar_url` (hoje só tem `id` e `name`). Ajustar o `useMemo` que monta a lista para incluir o `avatar_url` do profile do assignee.
- Renderizar `<AssigneeAvatar>` em cada `SelectItem`.
- "Todos os responsáveis" / "Sem responsável" / "Nomes livres": círculo com ícone neutro / iniciais.

**KanbanBoard.tsx**
- `members` já tem `profiles.avatar_url`. Adicionar `<AssigneeAvatar url={p?.avatar_url} name={name} />` no `SelectItem`.
- "Todos" / "Sem responsável": círculo neutro.

**AuthContext.tsx**
- Expor `avatarUrl` (do `profiles.avatar_url` já buscado) para uso no item "Eu mesmo" sem precisar refazer query.

### Não muda

- Lógica de filtro, valores dos `Select`, RLS, dados.
- Outros componentes que já usam `Avatar` (TaskDetail, AppSidebar etc.).
- Estilo dos demais filtros (projeto, prioridade).

### Resultado

Os três seletores passam a mostrar a foto circular minimalista de cada usuário ao lado do nome — tanto no botão fechado quanto na lista aberta — alinhado ao padrão visual da plataforma.

