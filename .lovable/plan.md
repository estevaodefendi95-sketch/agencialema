

## Plano: Garantir fluxo de aprovação e perfis

O fluxo já existe parcialmente. Vou validar e ajustar o que falta para atender:

1. **Cadastro público (signup)** → usuário entra como `pendente`. Apenas admin aprova.
2. **Criação pelo admin** → usuário já entra como `aprovado` automaticamente, com role e empresas definidas.
3. **Seleção de perfil** (admin/editor/visualizador/cliente) disponível tanto na criação quanto na aprovação.

### Estado atual (verificado)

- `handle_new_user()` já cria perfil como `pendente` (exceto super admin hardcoded). ✓
- Edge function `create-user` já marca `aprovado` + atribui role + vincula empresas. ✓
- `AdminUsers.tsx` já tem dialog de criação e edição com seletor de role (admin/editor/visualizador/cliente) e empresas. ✓
- `PendingApproval.tsx` existe para bloquear usuários não aprovados. ✓

### Lacunas a corrigir

1. **Tela de aprovação dedicada / destaque para pendentes**: hoje `AdminUsers` lista todos misturados. Adicionar:
   - Filtro/aba "Pendentes" no topo com contador
   - Botão **"Aprovar"** direto na linha (atalho), além do "Editar" existente
   - Ao aprovar via atalho, abre o mesmo dialog de edição já posicionado para escolher perfil + empresas antes de confirmar (obrigatório escolher role)

2. **Validação de role obrigatória na aprovação**: garantir que admin não aprove sem definir perfil. Se role = `cliente`/`editor`/`visualizador`, exigir ao menos 1 empresa vinculada (admin não precisa).

3. **Feedback visual**: badge de "Pendente" mais destacado e ordenação por status (pendentes primeiro).

4. **Confirmar fluxo de signup**: revisar `Login.tsx` / signup para garantir mensagem clara: "Cadastro enviado. Aguarde aprovação do administrador."

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/AdminUsers.tsx` | Aba/filtro pendentes, botão "Aprovar" atalho, ordenação, validação de empresas obrigatórias |
| `src/pages/Login.tsx` | Confirmar mensagem pós-signup sobre aguardar aprovação |
| `src/pages/PendingApproval.tsx` | Verificar copy e UX |

Sem mudanças de banco — schema e RLS já suportam tudo.

