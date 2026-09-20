-- Alternativa ao Database Webhook pra disparar send-push: habilita pg_net
-- (chamadas HTTP assíncronas de dentro do Postgres) e cria uma trigger que
-- chama a edge function a cada notificação nova.
--
-- Antes de rodar, troque <VALOR_DO_SEND_PUSH_SECRET> pelo mesmo valor do
-- secret SEND_PUSH_SECRET configurado na edge function send-push.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_send_push()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ddyudmvpavumngdlkvxr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<VALOR_DO_SEND_PUSH_SECRET>'
    ),
    body := to_jsonb(NEW)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Falha ao chamar o push nunca pode impedir o INSERT da notificação.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_send_push();
