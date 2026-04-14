

## Plano: Login Social (Google + Apple) e Admin Master

### 1. Login com Google e Apple

Adicionar botões "Google" e "Apple" na tela de login, seguindo o estilo da imagem de referência (botões lado a lado abaixo do formulário, separados por "OU CONTINUE COM").

**Implementação:**
- Usar `lovable.auth.signInWithOAuth("google")` e `lovable.auth.signInWithOAuth("apple")` (Lovable Cloud managed)
- Chamar a ferramenta **Configure Social Auth** para gerar o módulo `src/integrations/lovable/`
- Atualizar `Login.tsx` com os botões sociais e o separador visual
- Redesenhar a tela de login seguindo o estilo dark da referência: fundo escuro, botão principal verde/emerald, ícones nos inputs, toggle de visibilidade da senha, link "Esqueceu a senha?"
- Separar login e cadastro: login como view principal, link "Não tem conta? Cadastre-se" embaixo

### 2. Admin Master (estevaodefendi95@gmail.com)

Garantir que **apenas** a conta `estevaodefendi95@gmail.com` tenha acesso completo de admin a todas as configurações e todos os usuários/empresas.

**Implementação:**
- Criar uma migration que insere o role `admin` para esse email na tabela `user_roles` (via trigger ou verificação no signup)
- Adicionar um trigger no banco: quando um usuário com esse email faz signup (inclusive via Google/Apple), automaticamente recebe status `aprovado` e role `admin`
- Proteger as rotas `/admin/*` no frontend verificando `isAdmin`
- Adicionar verificação no `AuthContext` ou nas páginas admin para garantir que apenas admins acessem

### 3. Fluxo de usuários OAuth

Quando um usuário faz login via Google/Apple pela primeira vez:
- O trigger existente de `handle_new_user` cria o perfil com status `pendente`
- Exceto se for `estevaodefendi95@gmail.com` → status `aprovado` + role `admin` automaticamente
- Demais usuários aguardam aprovação do admin

### Resumo Técnico

| Mudança | Tipo |
|---------|------|
| Configurar Social Auth (Google + Apple) | Ferramenta |
| Redesenhar `Login.tsx` com botões sociais | Edição |
| Migration: trigger para auto-aprovar admin master | Migration |
| Proteger rotas admin no frontend | Verificação |

