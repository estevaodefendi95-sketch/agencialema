-- Área admin "Clientes & Contratos" — DOCUMENTAÇÃO do SQL rodado direto no
-- banco (via Lovable), no mesmo espírito dos outros triggers/funções
-- copiados aqui. Sem segredo nenhum: a chave de criptografia das
-- observações fica no Supabase Vault (secret "company_notes_key") e só é
-- lida dentro das funções — nunca aparece neste arquivo nem no front.
--
-- O bucket "company-contracts" foi criado pelo painel (privado, public: false).
--
-- A Parte B pode ainda não estar aplicada no banco (depende de liberar o
-- acesso a secrets do Vault). Enquanto isso, as chamadas RPC falham com
-- "função não encontrada" e o front mostra isso como recurso indisponível.

-- ============================================================
-- Parte A — contratos por empresa
-- ============================================================
CREATE TABLE public.company_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_contracts_company ON public.company_contracts(company_id);
ALTER TABLE public.company_contracts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_contracts TO authenticated;

CREATE POLICY "Admins manage company contracts" ON public.company_contracts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage contract files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'company-contracts' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'company-contracts' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- Parte B — observações confidenciais (criptografadas)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.company_admin_notes (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  notes_encrypted BYTEA,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_admin_notes ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy de propósito: só as funções abaixo (SECURITY DEFINER) acessam.

-- Todas exigem o papel admin e lançam 'Acesso negado' caso contrário.

-- Grava (upsert) a observação criptografada com a chave do Vault.
-- chamada: supabase.rpc("admin_set_company_notes", { p_company_id, p_notes }) → void
CREATE OR REPLACE FUNCTION public.admin_set_company_notes(p_company_id UUID, p_notes TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  k text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'company_notes_key' LIMIT 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Chave de criptografia não configurada (vault secret company_notes_key)';
  END IF;
  INSERT INTO public.company_admin_notes (company_id, notes_encrypted, updated_by, updated_at)
  VALUES (p_company_id, pgp_sym_encrypt(coalesce(p_notes, ''), k), auth.uid(), now())
  ON CONFLICT (company_id) DO UPDATE
    SET notes_encrypted = EXCLUDED.notes_encrypted,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_company_notes(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_company_notes(UUID, TEXT) TO authenticated;

-- Lê a observação já descriptografada; '' se ainda não houver nenhuma.
-- chamada: supabase.rpc("admin_get_company_notes", { p_company_id }) → text
CREATE OR REPLACE FUNCTION public.admin_get_company_notes(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  k text;
  enc bytea;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT notes_encrypted INTO enc FROM public.company_admin_notes WHERE company_id = p_company_id;
  IF enc IS NULL THEN
    RETURN '';
  END IF;
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'company_notes_key' LIMIT 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Chave de criptografia não configurada (vault secret company_notes_key)';
  END IF;
  RETURN pgp_sym_decrypt(enc, k);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_company_notes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_company_notes(UUID) TO authenticated;

-- Lista quais empresas têm observação salva (sem o conteúdo).
-- chamada: supabase.rpc("admin_list_companies_with_notes") → { company_id, updated_at }[]
CREATE OR REPLACE FUNCTION public.admin_list_companies_with_notes()
RETURNS TABLE(company_id UUID, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY SELECT n.company_id, n.updated_at FROM public.company_admin_notes n;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_companies_with_notes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_companies_with_notes() TO authenticated;
