

## Plano: Mostrar mídias das tarefas no documento de impressão

No `PrintProjectView.tsx`, abaixo da descrição/metadados de cada tarefa, renderizar a galeria de mídias da tarefa.

### Mudanças

**1. `KanbanBoard.tsx` — carregar mídias no fluxo de impressão**
- No momento em que o usuário abre o dialog "Imprimir" (ou ao montar o `PrintProjectView`), buscar de `task_media` todas as mídias das tarefas do projeto:
  ```
  supabase.from('task_media').select('id, task_id, file_url, file_name, file_type')
    .in('task_id', tasks.map(t => t.id))
  ```
- Agrupar por `task_id` e passar como prop `mediaByTask: Record<string, MediaItem[]>` para `<PrintProjectView />`.

**2. `PrintProjectView.tsx` — renderizar mídias por tarefa**
- Adicionar prop `mediaByTask`.
- Para cada tarefa, se houver mídias, renderizar uma seção "Mídias" com:
  - **Imagens** (`file_type` começa com `image` ou extensão jpg/png/webp/gif): thumbnail clicável (`<a href={file_url} target="_blank">`), grid de até 3 colunas, mostradas inline no PDF.
  - **Vídeos** (`file_type` = `video` ou extensão mp4/mov/webm): card com ícone de play + nome do arquivo, link clicável que abre em nova aba.
  - **PDFs** (extensão .pdf): card com ícone de documento + nome do arquivo, link clicável.
  - **Outros**: card genérico com nome do arquivo + link.
- No CSS print (`index.css`), garantir que `<a>` mantenha cor azul/sublinhado e que os links continuem clicáveis quando o navegador salva como PDF (links em `<a href>` ficam ativos no PDF gerado pelo Chrome/Edge).
- `break-inside: avoid` nos cards de mídia para não cortar no meio.

### Observação técnica
A coluna `task_media.file_type` no banco tem default `'image'`. Para detectar vídeo/PDF de forma robusta, vou inspecionar tanto `file_type` quanto a extensão de `file_name`/`file_url`.

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/pages/KanbanBoard.tsx` | Buscar `task_media` e passar `mediaByTask` ao `PrintProjectView` |
| `src/components/PrintProjectView.tsx` | Nova prop + render de galeria (imagens inline, vídeos/PDFs como link clicável) |
| `src/index.css` | Pequeno ajuste para preservar links no print |

