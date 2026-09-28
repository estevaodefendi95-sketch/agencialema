# Revisão mobile e busca contextual

## Objetivo
Entregar uma experiência consistente em Android e iOS em todas as áreas internas, no portal do cliente e no detalhe da tarefa, além de transformar a busca do cabeçalho em uma busca útil para a área atual.

## Plano

1. **Padronizar a estrutura mobile**
   - Ajustar cabeçalho, conteúdo, menu lateral e navegação inferior para respeitar as áreas seguras do Android/iOS, teclado virtual e barras do navegador.
   - Garantir títulos, ações e filtros sem sobreposição, cortes ou rolagem horizontal acidental.
   - Padronizar alvos de toque, estados de foco, carregamento, vazio e erro.

2. **Revisar todas as áreas**
   - Conferir Dashboard, Empresas, detalhe da empresa, Projetos, projeto/Kanban, Calendário, Minhas Tarefas, Equipe, Notificações, Perfil e telas administrativas.
   - Conferir também o portal do cliente, tarefas, calendário e apresentações públicas.
   - Adaptar tabelas e barras extensas para alternativas móveis legíveis; manter scroll horizontal somente onde ele é parte natural da interação, como Kanban e calendário.

3. **Otimizar a página de tarefa**
   - Tratar o detalhe como painel integral no celular, com cabeçalho compacto, fechamento sempre acessível e botão de salvar visível quando houver alterações.
   - Reorganizar responsável, responsáveis adicionais, datas, prioridade, lembrete, subtarefas, mídias, checklist e atividade para uma coluna confortável.
   - Corrigir ações que hoje dependem de passar o mouse, ampliar controles pequenos e preservar o conteúdo ao abrir teclado, seletores e anexos.
   - Validar também a abertura direta por links com `?task=`.

4. **Criar busca contextual no cabeçalho**
   - Fazer o texto, os resultados e a ação da busca mudarem conforme a página atual.
   - Em **Empresas**, pesquisar instantaneamente por nome, descrição, slug e responsáveis do fluxo; mostrar resultados claros e abrir diretamente a empresa escolhida.
   - Em **Projetos**, priorizar projetos e suas empresas; dentro de um projeto, pesquisar tarefas daquele projeto e abrir a tarefa.
   - Em **Minhas Tarefas** e **Calendário**, pesquisar tarefas visíveis ao usuário e abrir o detalhe.
   - Em **Equipe**, pesquisar pessoas; em **Notificações**, filtrar avisos; nas demais áreas, manter uma busca geral como alternativa.
   - Usar atraso curto de digitação, botão para limpar, mensagens específicas e navegação acessível por toque e teclado.

5. **Evitar buscas duplicadas**
   - Centralizar o estado da busca contextual e permitir que cada página registre sua fonte de resultados ou filtro local.
   - Nas listas, refletir o termo do cabeçalho imediatamente no conteúdo; em resultados navegáveis, fechar a busca após selecionar.
   - Manter o atalho `Ctrl/⌘ + K` no computador e uma abertura simples em tela cheia no celular.

6. **Validar Android e iOS**
   - Testar larguras representativas de iPhone e Android, incluindo orientação vertical, teclado aberto, tema claro/escuro e conteúdo longo.
   - Exercitar busca de empresa, busca de tarefa, abertura do detalhe, edição, salvamento, filtros, menus, modais e navegação inferior.
   - Corrigir erros encontrados e confirmar o resultado visual com capturas das telas principais.

## Detalhes técnicos
- Preservar as permissões e regras de dados existentes; a mudança será na interface e no comportamento de busca.
- Reutilizar os componentes e tokens visuais atuais, acrescentando um contexto compartilhado para busca por rota.
- A lista de Empresas atualmente não possui filtro local, e a busca global leva qualquer empresa apenas para `/empresas`; o novo fluxo abrirá `/empresas/:companyId` e filtrará a lista quando apropriado.
- O detalhe de tarefa já é um painel de largura total no celular, mas possui espaçamentos de desktop, grades em duas colunas e ações dependentes de hover que serão adaptadas.
