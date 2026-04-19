

## Diagnóstico

O filtro Equipe só mostra "Todos" e "Sem responsável" porque `loadMembers` usa um join aninhado:
```ts
.select("*, profiles:user_id(full_name, nickname, email, avatar_url)")
```
A RLS da tabela `profiles` só libera "próprio perfil" ou admin. Quando o usuário corrente não é admin nem o próprio membro, o join devolve `profiles: null` — e como o nome exibido depende desse objeto, o item acaba caindo no fallback ou simplesmente sumindo da UI por causa do `name` vazio + filtros já aplicados.

Confirmado no banco: o projeto atual tem 1 membro **ativo** com `user_id` (Estevão) + 1 pendente. O ativo deveria aparecer no filtro, mas não aparece.

## Plano

### 1. Carregar membros em 2 etapas (sem depender de join via RLS)
Em `src/pages/KanbanBoard.tsx`, função `loadMembers`:
- Buscar `project_members` sem o join aninhado.
- Coletar os `user_id` não nulos e buscar `profiles` em uma segunda query `.in("id", userIds)`.
- Montar no frontend o `members[]` com `profiles` enriquecido (quando RLS permitir) e fallback consistente.
- Garantir que a key `profiles` seja sempre objeto ou `null`, para o restante do código continuar funcionando.

### 2. Mostrar todos os membros ativos no filtro Equipe
Ainda em `KanbanBoard.tsx`, no `<Select>` do filtro:
- Listar todo membro com `user_id` e `status === "ativo"`.
- Nome exibido com prioridade: `nickname` → `full_name` → `email` (do profile) → `invited_email` (do member) → "Sem nome".
- Manter "Todos" e "Sem responsável".

### 3. Mesma lógica de exibição no card
- `getAssigneeDisplay` continua igual, mas agora recebe membros enriquecidos corretamente, então o nome curto aparece em todos os casos onde o user é membro do projeto.

### Arquivo
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | `loadMembers` em 2 etapas (members + profiles); fallback de nome no filtro Equipe usando email/invited_email |

### Resultado
- O filtro Equipe passa a listar todos os responsáveis cadastrados no projeto (ex.: Estevão), independentemente da RLS de `profiles`.
- O sistema reconhece corretamente quem é o responsável de cada tarefa e permite filtrar por ele.

