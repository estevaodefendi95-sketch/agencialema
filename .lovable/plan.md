## Objetivo

Reformular o layout da apresentação ao cliente com a linguagem visual do PDF da lema. (fundo azul forte + off-white, tipografia grande, blocos numerados, badge de DATA | HORÁRIO), com modo desktop e mobile, mantendo intactos o mockup de iPhone/Instagram e o agendamento/planejamento de posts.

## Formato

Híbrido:
- **Mobile / padrão:** página rolável, cada seção ocupa a tela com o visual do deck.
- **Desktop:** botão "Modo apresentação" que ativa navegação slide a slide em 16:9 (setas ←/→, teclado, contador de slides, ESC para sair). O conteúdo é o mesmo — só muda o modo de navegação.

Vale para a landing pública (`/c/:slug`) e para o preview interno.

## Tema editável por projeto

Usar a coluna `theme` (já existe em `project_presentations`) para guardar cores editáveis: fundo, cor de destaque, cor de texto e cor do slide invertido. Padrão pré-carregado com o azul lema. Editor com seletor de cores no topo do builder + botão "restaurar padrão". Todas as seções consomem essas cores via variáveis CSS aplicadas no container da apresentação (sem cores fixas nos componentes).

## Novos blocos editáveis

Todos entram como tipos novos em `presentation_blocks` (a tabela aceita qualquer tipo — sem mudança no banco) e ganham editor completo no builder:

1. **Capa** — logo do cliente centralizado, palavra "PLANEJAMENTO", mês e ano, frase de topo (#tudo começa pelo seu lema.), logo da agência no rodapé. Campos: frase, palavra-chave, mês, ano, logos.
2. **Regras / Aprovação** — fundo invertido (azul cheio), itens numerados `01`, `02`… com título e descrição, separador entre eles. Lista com adicionar/remover/reordenar.
3. **Temas do mês** — faixa de título colorida no topo + lista numerada em duas colunas. Itens editáveis, reordenáveis.
4. **Visão geral do feed** — título grande à esquerda ("#seu feed, seu lema." + subtítulo) e mosaico 3 colunas de imagens à direita, com upload/recorte 1:1 e reordenação. Em mobile empilha.

## Reformulação das seções existentes

- **Capa/hero atual:** vira o bloco Capa (o hero antigo continua funcionando como fallback).
- **Cabeçalho e Texto:** tipografia do deck (título display grande, corpo leve), opção de alinhamento (esquerda/centro) e de fundo (claro/invertido) — ambos editáveis.
- **Imagem e Galeria:** enquadramento em faixa horizontal como no PDF, com legenda editável e opção de proporção.
- **Planejamento de Posts (visual apenas — lógica de agendamento intacta):** cada post vira um slide "Post 01": número grande, tipo/título ao lado, badge azul `DATA: 24/07 | HORÁRIO: 11H30` no canto superior direito, faixa horizontal de mídias e bloco "Legenda:" abaixo. Mantém carrossel no mobile e os botões de aprovação/comentário do cliente como estão hoje.
- **Preview Instagram:** intocado, apenas herda o fundo do tema.
- **Rodapé:** logo da agência + `#seu feed, seu lema.`

## Detalhes técnicos

- `PresentationView.tsx` é dividido em: `PresentationDeck` (shell com modo scroll/slide, tema e navegação), `Slide` (moldura 16:9 no desktop, altura livre no mobile) e um arquivo por bloco em `src/components/presentation/blocks/`.
- Tema aplicado via CSS vars locais (`--pres-bg`, `--pres-fg`, `--pres-accent`, `--pres-invert-bg`) — nenhuma cor hardcoded nos componentes.
- `PresentationBuilder.tsx` ganha: painel de tema, os 4 novos tipos no menu "Adicionar bloco" e editores dedicados; drag-and-drop e o fluxo de versões/lançamento continuam iguais.
- Landing (`/c/:slug`) e preview interno usam o mesmo `PresentationDeck`.
- Sem migração de banco: `theme` já existe e `block_type` não tem restrição de valores.
- Tipografia: fonte display sem serifa de peso alto para títulos, mantendo a fonte atual no corpo.

## Fora do escopo

Mockup do iPhone/Instagram e a lógica de agendamento/aprovação de posts não são alterados.
