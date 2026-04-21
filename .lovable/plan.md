

## Foto de perfil + ajuste do mockup do iPhone

Dois ajustes pequenos e independentes.

### 1) Foto de perfil do usuário

**Backend (migration):**
- Atualizar a função `handle_new_user()` para também salvar `avatar_url` quando o provedor (Google/Apple) envia a foto:
  ```sql
  COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  )
  ```
  Assim, ao logar pela primeira vez via Google ou Apple, a foto do provedor entra automaticamente no `profiles.avatar_url`. Email/senha continua sem foto (nulo).

**Frontend — `src/pages/Profile.tsx`:**
- Adicionar bloco "Foto de perfil" no topo do card com:
  - Preview circular (`Avatar`, 96px) usando `avatar_url` do profile, fallback nas iniciais do nome.
  - Botão "Trocar foto" que abre o `<input type="file">` e em seguida o `ImageCropper` existente (`circular`, `aspect={1}`, upload em `avatars/{user.id}.png` no bucket `attachments`).
  - Botão "Remover" quando já existir foto (seta `avatar_url` para `null`).
- Carregar `avatar_url` no `useEffect` e atualizar o profile no banco quando o crop terminar.

**Resultado:** a foto já aparece automaticamente em Equipe (`KanbanBoard`), Minhas Tarefas e detalhes de tarefa (`TaskDetail`) — esses já leem `avatar_url`.

### 2) Mockup do Instagram — sempre dentro do iPhone

Em `src/components/presentation/PresentationView.tsx`, no componente `InstagramPreview`:

- **Manter sempre o frame do iPhone** (já existe), tanto para `feed_only` quanto para `full_profile`.
- Refinar o frame para ficar fiel à imagem de referência (iPhone branco, bordas finas, notch, botões laterais, home indicator) — já está praticamente assim, só ajustes finos:
  - Garantir proporção do corpo do iPhone (~9:19).
  - Preservar exatamente a aparência da referência (cores, raios de borda, sombras).
- **Comportamento sem personalização:** quando o editor escolher `feed_only` ou não preencher dados de perfil, o iPhone exibe apenas o grid do feed centralizado dentro da tela do aparelho (sem header de perfil), exatamente como na imagem de referência enviada.
- Não há mais opção de renderizar o feed "solto" — o iPhone é obrigatório nos dois modos.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase` migration | `handle_new_user()` passa a gravar `avatar_url` do OAuth |
| `src/pages/Profile.tsx` | Novo bloco de foto de perfil com upload + crop circular |
| `src/components/presentation/PresentationView.tsx` | Garante iPhone sempre presente; ajustes finos no frame |

### Não muda

- Estrutura de dados de blocos (`layout`, `images`, `highlights`, `avatar_url` etc.).
- Editor (`PresentationBuilder.tsx`) — já permite escolher entre `feed_only` e `full_profile`.
- Login Google/Apple já está configurado via Lovable Cloud — só passa a aproveitar a foto que já vem nos metadados.
- Componentes de equipe e tarefas — já consomem `avatar_url`.

