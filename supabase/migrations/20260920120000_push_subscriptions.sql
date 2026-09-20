-- Assinaturas de Web Push (PWA) por dispositivo/navegador. Um mesmo usuário
-- pode ter várias linhas (um celular, um desktop etc.) — por isso a chave não
-- é o user_id, e sim o endpoint, que é único por instalação do navegador.
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
