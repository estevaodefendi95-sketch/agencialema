

## Substituir "Eu mesmo" pelo apelido do usuário

No seletor de "Ver tarefas de..." em **`src/pages/MyTasks.tsx`**, o item do próprio usuário hoje exibe o texto fixo "Eu mesmo". Trocar por `nickname` (fallback `full_name`) do perfil do usuário logado.

### Alteração

**`src/pages/MyTasks.tsx`** (linhas ~255-270):
- Calcular `myName = me?.nickname || me?.full_name || "Eu"`.
- Renderizar `{myName}` no `SelectItem` em vez de "Eu mesmo".
- Reusar o mesmo nome no `AssigneeAvatar`.

### Não muda

- Demais membros já mostram apelido/full_name.
- Título do header permanece igual.
- Outros seletores não têm "Eu mesmo".
