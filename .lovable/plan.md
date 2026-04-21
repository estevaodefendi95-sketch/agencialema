
## Mockup do Instagram em formato de iPhone (igual referência)

Hoje o `InstagramPreview` em `PresentationView.tsx` já usa um "frame" de iPhone, mas é estilizado (gradiente, glow, bordas grossas) e não bate com a referência enviada — que é um **iPhone branco simples, com notch, bordas finas pretas e botões laterais**, exatamente como nas duas imagens.

Vou refazer o frame para replicar fielmente a referência, mantendo os dois layouts internos (`feed_only` e `full_profile`) já implementados.

### Mudanças

**Arquivo único: `src/components/presentation/PresentationView.tsx`** (componente `InstagramPreview` / wrapper do iPhone)

1. **Frame do iPhone realista**:
   - Corpo branco (`bg-white`) com borda preta fina (≈ 2px) e cantos arredondados grandes (`rounded-[3rem]`).
   - **Notch central** preto no topo (pílula horizontal com câmera + speaker).
   - **Botões laterais** desenhados como pequenas barras pretas: volume (esquerda, 2 traços) e power (direita, 1 traço maior).
   - **Indicador de home** (barra horizontal preta) na base.
   - Sombra suave (`shadow-2xl`) em vez do glow gradiente atual.
   - Remover o fundo gradiente colorido por trás — fundo neutro/transparente, igual à referência.

2. **Tela interna**:
   - Fundo branco.
   - Status bar simples no topo (hora à esquerda, ícones de sinal/wifi/bateria à direita) em cinza claro — igual à referência.
   - Mantém o conteúdo já existente (`ProfileHeader` + grid para `full_profile`, ou só grid para `feed_only`).

3. **Proporção**:
   - Largura fixa (~280–300px) com aspect ratio de iPhone real (~9:19.5) para parecer um device de verdade, centralizado.

4. **Responsividade**:
   - Em telas pequenas, o frame escala mantendo proporção (sem deformar).

### Não muda

- Estrutura de dados do bloco (`layout`, `images`, `highlights`, etc.).
- Editor (`PresentationBuilder.tsx`) — formato de edição permanece igual.
- Lógica das duas variantes (`feed_only` vs `full_profile`).
- Demais blocos da apresentação.

### Resultado

Preview do Instagram passa a parecer uma foto real de iPhone branco (como as duas imagens enviadas), elevando o padrão visual da apresentação ao cliente.
