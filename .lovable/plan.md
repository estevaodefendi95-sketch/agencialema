

## Melhorias na Apresentação ao Cliente

Quatro ajustes focados no builder e na landing pública:

### 1) Recorte/enquadramento de imagens no upload

Hoje as imagens vão direto pro storage no formato original. Vou reaproveitar o `ImageCropper` (já existe em `src/components/ImageCropper.tsx`, baseado em `react-image-crop`) e plugá-lo nos uploads do builder de apresentação.

- **Imagens de bloco "Imagem"** → cropper livre com proporção opcional (16:9, 4:3, 1:1, livre — toggle no topo do cropper).
- **Galeria** → cropper aplicado uma imagem por vez (fila), proporção 1:1 padrão (altera para livre se o usuário quiser).
- **Preview Instagram** → **força 1:1** (sem opção), garantindo feed alinhado.
- **Posts do planejamento** (campo `image_url` do `presentation_posts`) → cropper 4:5 (formato retrato típico de feed).
- **Logos (cliente/agência)** → mantêm upload direto (logo geralmente vem pronto), mas com `object-contain` melhor enquadrado.

Vou estender o `ImageCropper` para aceitar `aspect?: number | "free"` em vez de só circular/1:1, e devolver a imagem recortada via callback (usando o mesmo fluxo de upload já existente em `uploadImage`).

### 2) Mockup Instagram — só o feed

No `ClientLanding.tsx`, o componente `InstagramPreview` hoje mostra notch + status bar + header com avatar `@cliente`. Vou simplificar:

- Remover o header com `@cliente`, o avatar gradiente e a status bar.
- Manter só o **frame do iPhone** (bordas arredondadas, sombra) com o **grid 3×N do feed** ocupando todo o interior.
- Título da seção continua: "Preview do Feed".
- Mesmo ajuste no preview do builder, se houver renderização espelhada.

### 3) Landing pública premium

Refinar `src/pages/ClientLanding.tsx` para ficar com cara de apresentação de agência:

- **Hero**: full-bleed com gradiente sutil, logos no topo bem alinhados (cliente esquerda alta, agência canto), título em escala maior (`text-5xl md:text-7xl`), descrição com `max-w-2xl` e fonte mais leve. Animação de entrada (fade-up).
- **Tipografia**: hierarquia clara (h1/h2/h3), mais respiro vertical (`py-24 md:py-32` entre seções), separadores discretos.
- **Blocos de imagem**: bordas arredondadas maiores (`rounded-2xl`), sombras suaves, legendas em itálico centralizadas.
- **Galerias**: masonry/grid responsivo com hover sutil (zoom 1.02).
- **Mockup Instagram**: centralizado, com glow sutil atrás (gradiente colorido borrado), conforme item 2.
- **Planejamento de Postagens**: cards com layout maior (imagem 1:3 do card no desktop), data como pílula colorida, copy formatada com line-height generoso, hover eleva o card.
- **Footer**: marca da agência (logo pequena) + ano + frase discreta.
- **Detalhes**: scroll-smooth, micro-animações de entrada via `IntersectionObserver` (classes Tailwind `animate-fade-in` se já existirem; senão CSS inline).
- Totalmente responsivo (mobile-first), respeita `prefers-reduced-motion`.

### 4) Preview interno da equipe (mesmo sem publicar)

Hoje o botão "Pré-visualizar" no builder abre `/c/:slug`, que faz a query filtrando `status='publicado' AND released=true` — então rascunhos não aparecem.

Vou criar uma rota interna:

- **Rota**: `/projetos/:projectId/apresentacao/preview` (dentro do `RequireAuth` + `AppLayout`, ou em layout limpo — limpo é melhor para realmente simular a apresentação). Vou usar layout limpo (sem sidebar) com um banner fixo no topo "Modo Preview — não publicado" + botão "Voltar ao editor".
- **Página**: `src/pages/PresentationPreview.tsx` — reusa exatamente o mesmo componente de renderização da landing (vou extrair o conteúdo de `ClientLanding.tsx` para um componente `<PresentationView pres blocks posts />` e ambas as páginas o usam).
- **Carregamento**: usa Supabase autenticado, busca por `project_id` (RLS já permite equipe via `Approved users view presentations`). Sem filtro de status/released.
- **Botão "Pré-visualizar"** no builder muda para abrir essa rota interna em nova aba (sempre disponível, mesmo em rascunho). O botão "Copiar link público" continua só visível quando publicado+liberado.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/ImageCropper.tsx` | Aceitar prop `aspect` (number ou "free") + toggle de proporção |
| `src/components/presentation/PresentationBuilder.tsx` | Plugar cropper nos uploads (image, gallery, instagram_preview, posts), trocar destino do botão "Pré-visualizar" |
| `src/components/presentation/PresentationView.tsx` | **Novo** — renderização compartilhada (extraído de ClientLanding) |
| `src/pages/ClientLanding.tsx` | Usa `PresentationView`; layout premium refinado; mockup IG sem header |
| `src/pages/PresentationPreview.tsx` | **Novo** — rota interna autenticada com banner "Preview" |
| `src/App.tsx` | Rota `/projetos/:projectId/apresentacao/preview` |

### Resultado

- Equipe recorta cada imagem no upload, garantindo enquadramento consistente.
- Mockup do Instagram fica limpo, só o feed.
- Landing do cliente com visual de apresentação de agência (premium, espaçoso, animado).
- Equipe vê a página exatamente como o cliente verá, mesmo antes de publicar.

