

## Plano: Crop de Logo, Comentários no Histórico e Mídia nos Cards

### 1. Componente de Crop/Redimensionamento de Imagem

Criar um componente `ImageCropper.tsx` usando a biblioteca `react-image-crop`:
- Modal com preview da imagem e área de recorte arrastável
- Formato circular (estilo Google/avatar) para logos
- Aspecto quadrado (1:1) como padrão
- Botões "Recortar" e "Cancelar"
- Gera um Blob recortado via canvas e faz upload para o bucket `attachments`

Aplicar em 3 locais:
- `AdminSettings.tsx` (logo do app)
- `Companies.tsx` (logo da empresa)

### 2. Salvar Comentários no Histórico

No `TaskDetail.tsx`, ao adicionar comentário (`addComment`), inserir também um registro em `task_history`:
```
action: "Comentou"
details: { content: "texto do comentário" }
```

Isso já funciona com a tabela existente, sem mudanças no banco.

### 3. Mostrar Mídia nos Cards do Kanban

No `KanbanBoard.tsx`:
- Carregar `task_media` junto com as tasks (query separada agrupada por task_id)
- No card, se houver mídia, exibir thumbnail da primeira imagem acima do título
- Se houver mais de 1 mídia, mostrar badge "+N" no canto da thumbnail
- Vídeos: exibir ícone de play sobre um frame estático

### Resumo Técnico

| Mudança | Arquivo |
|---------|---------|
| Instalar `react-image-crop` | package.json |
| Criar `ImageCropper.tsx` | Novo componente |
| Integrar crop em `AdminSettings.tsx` | Edição |
| Integrar crop em `Companies.tsx` | Edição |
| Comentário → histórico | `TaskDetail.tsx` |
| Thumbnail + badge nos cards | `KanbanBoard.tsx` |

Sem migrações de banco necessárias.

