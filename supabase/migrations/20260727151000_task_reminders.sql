-- Horário opcional + lembrete antes do prazo, além da data já existente.
ALTER TABLE public.tasks ADD COLUMN due_time time;
ALTER TABLE public.tasks ADD COLUMN reminder_minutes_before integer;
ALTER TABLE public.tasks ADD COLUMN reminder_sent_at timestamptz;
