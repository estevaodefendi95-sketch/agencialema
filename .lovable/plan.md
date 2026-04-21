
## Mockup do Instagram — escolha entre Perfil completo ou Só feed

Hoje o bloco `instagram_preview` mostra apenas o feed dentro do iPhone. Vou adicionar **dois formatos** que o editor escolhe ao montar a apresentação, conforme as duas referências enviadas:

- **Formato A — Perfil completo**: cabeçalho do perfil (avatar, nome, bio, contadores Posts/Followers/Following, botões Following/Message/Contact, linha de **Story Highlights** circulares) + grid de feed.
- **Formato B — Só feed** (atual): apenas o grid 3×N dentro do iPhone.

### 1) Modelo de dados (sem migração)

O bloco `instagram_preview` guarda tudo dentro de `data` (jsonb). Vou estender:

```ts
data: {
  layout: "feed_only" | "full_profile",  // novo, default "feed_only"
  images: string[],                       // feed (já existe)
  // Campos extras só usados em "full_profile":
  username?: string,
  display_name?: string,
  bio?: string,
  avatar_url?: string,
  posts_count?: number,
  followers_count?: string,  // string p/ aceitar "14,1 mil"
  following_count?: string,
  highlights?: { id: string; title: string; cover_url: string }[],
}
```

Compatível com blocos antigos: se `layout` não existir, renderiza como `feed_only`.

### 2) Editor (`PresentationBuilder.tsx`)

No bloco Instagram, adicionar:

- **Toggle de formato** no topo: "Só feed" / "Perfil completo" (Tabs ou RadioGroup).
- Quando "Perfil completo" estiver ativo, mostrar campos extras:
  - Avatar (upload com cropper 1:1 circular).
  - Nome de exibição, @username, bio (textarea).
  - Posts / Followers / Following (3 inputs curtos).
  - **Story Highlights**: lista de até 8 itens, cada um com capa (cropper 1:1 circular) + título curto. Botão "+ Adicionar destaque" e remover individual.
- Grid de feed continua igual (uploads com cropper 1:1).

### 3) Renderização (`PresentationView.tsx`)

Refatorar `InstagramPreview` para receber `data` completo e bifurcar:

- **`feed_only`**: mantém o iPhone atual (sem header), só grid.
- **`full_profile`**: dentro do mesmo iPhone, renderiza, em ordem:
  1. Barra superior simples com `← @username  ⌕  ⋮` (sem status bar do sistema).
  2. Linha do perfil: avatar circular grande à esquerda + 3 contadores (Posts / Followers / Following) à direita.
  3. Nome em negrito + bio (com quebras de linha).
  4. Botões fake "Following · Message · Contact · ▼".
  5. Carrossel horizontal de Story Highlights (círculos com borda cinza + título embaixo).
  6. Linha de tabs com ícones (grid · reels · tagged) — só visual.
  7. Grid 3×N com as mesmas imagens do feed.

Tudo estilizado para parecer captura real de Instagram (fontes, espaçamentos, cinzas claros), respeitando o tema do app. Mantém o glow gradiente e o frame do iPhone.

### 4) Resultado

- Editor escolhe por bloco se mostra **só o feed** ou **o perfil completo com highlights**.
- Pode inclusive ter dois blocos `instagram_preview` na mesma apresentação (um de cada tipo) — cada um independente.
- Visualizações pública (`/c/:slug`) e preview interno (`/projetos/.../apresentacao/preview`) refletem o mesmo formato automaticamente.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/presentation/PresentationBuilder.tsx` | UI de edição do bloco Instagram com toggle de formato + campos de perfil + highlights |
| `src/components/presentation/PresentationView.tsx` | `InstagramPreview` com dois layouts (`feed_only` / `full_profile`) |
