

## Plano: Personalização do Login + Restrição ao Admin Master

### Objetivo
Adicionar campos para personalizar a tela de login (logo e nome) nas Configurações, e restringir o acesso a essas configurações **exclusivamente** ao email `estevaodefendi95@gmail.com`.

### 1. Migration: novos campos + RLS restritiva

- Adicionar colunas `login_logo_url` (text, nullable) e `login_app_name` (text, default 'GestãoPro') na tabela `app_settings`
- Adicionar política SELECT para `anon` na `app_settings` (para a tela de login carregar as configurações sem autenticação)

### 2. Atualizar `AdminSettings.tsx`

- Adicionar novo Card "Personalização do Login" com:
  - Campo de texto para nome exibido no login
  - Upload de logo do login (com crop circular via `ImageCropper`)
  - Preview visual
- Verificar `user.email === 'estevaodefendi95@gmail.com'` via `useAuth()` — se não for esse email, não exibir a página de configurações (redirecionar ou mostrar mensagem de acesso negado)

### 3. Atualizar `Login.tsx`

- Carregar `login_logo_url` e `login_app_name` do `app_settings` (query sem auth)
- Substituir o ícone/nome hardcoded pelos valores dinâmicos

### 4. Atualizar `useAppSettings.ts`

- Incluir os novos campos no hook

### 5. Proteger rota no frontend

- Na rota `/admin/configuracoes` ou no próprio componente, verificar que apenas o email master pode acessar

### Resumo

| Mudança | Arquivo |
|---------|---------|
| Adicionar `login_logo_url`, `login_app_name`, RLS anon | Migration |
| Card de personalização do login + restrição por email | `AdminSettings.tsx` |
| Logo/nome dinâmicos no login | `Login.tsx` |
| Novos campos no hook | `useAppSettings.ts` |

