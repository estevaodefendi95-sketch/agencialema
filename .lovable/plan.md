

## Reverter avatar do item "Todos"

O item "Todos os responsáveis" (Calendário) e "Todos" (Kanban) está mostrando indevidamente a foto do usuário logado. Voltar a usar o ícone neutro (`Users`) — apenas itens de usuários reais devem ter foto de perfil.

### Alterações

**`src/pages/TaskCalendar.tsx`** — item `value="all"`:
- Trocar `<AssigneeAvatar url={avatarUrl} name={...} />` por `<AssigneeAvatar placeholder="all" />`.

**`src/pages/KanbanBoard.tsx`** — item `value="all"`:
- Mesma troca.

### Não muda

- Itens de membros reais continuam com foto.
- Item "Sem responsável" continua com ícone `UserX`.
- Itens "Nomes livres" continuam com iniciais.
- `AuthContext.avatarUrl` permanece exposto (pode ser útil em outros lugares).

