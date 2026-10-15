import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, ExternalLink, FileText, Loader2, Lock, Paperclip, Save, Trash2 } from "lucide-react";
import { adminErrorMessage } from "@/lib/adminRpc";

const CONTRACTS_BUCKET = "company-contracts";

type Contract = { id: string; file_name: string; storage_path: string; created_at: string };

// company_contracts ainda não está nos tipos gerados — mesmo cast pontual
// usado pra outras tabelas recém-criadas no projeto.
const db = supabase as any;

// Nome do arquivo seguro pra chave do Storage (sem acento, espaço vira "-").
function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export default function AdminClientDetail() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<{ name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    supabase.from("companies").select("name, logo_url").eq("id", companyId).maybeSingle()
      .then(({ data }) => setCompany(data));
  }, [companyId]);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/admin/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes &amp; Contratos
      </Link>
      <div className="flex items-center gap-3">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="h-12 w-12 rounded-full object-cover border" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <h2 className="text-2xl font-bold">{company?.name || "Empresa"}</h2>
      </div>

      <ContractsCard companyId={companyId} />
      <NotesCard companyId={companyId} />
    </div>
  );
}

function ContractsCard({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Contract | null>(null);

  async function load() {
    const { data, error } = await db
      .from("company_contracts")
      .select("id, file_name, storage_path, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setLoadError(error ? adminErrorMessage(error) : null);
    setContracts((data || []) as Contract[]);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [companyId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const path = `${companyId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(CONTRACTS_BUCKET).upload(path, file, { upsert: false });
      if (upErr) {
        toast({ title: `Erro ao enviar ${file.name}`, description: adminErrorMessage(upErr), variant: "destructive" });
        continue;
      }
      const { error: insErr } = await db.from("company_contracts").insert({
        company_id: companyId,
        file_name: file.name,
        storage_path: path,
        uploaded_by: user?.id,
      });
      if (insErr) {
        // Sem linha na tabela o arquivo ficaria órfão no bucket.
        await supabase.storage.from(CONTRACTS_BUCKET).remove([path]);
        toast({ title: `Erro ao registrar ${file.name}`, description: adminErrorMessage(insErr), variant: "destructive" });
      }
    }
    setUploading(false);
    load();
  }

  // Signed URL gerada na hora a cada clique (60s) e nunca guardada. A aba é
  // aberta antes do await pra não ser barrada pelo bloqueador de pop-up.
  async function openContract(c: Contract) {
    const win = window.open("", "_blank");
    setOpeningId(c.id);
    const { data, error } = await supabase.storage.from(CONTRACTS_BUCKET).createSignedUrl(c.storage_path, 60);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      win?.close();
      toast({ title: "Não foi possível abrir o contrato", description: adminErrorMessage(error), variant: "destructive" });
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = data.signedUrl;
    } else {
      window.open(data.signedUrl, "_blank", "noopener");
    }
  }

  async function confirmDelete() {
    const c = toDelete;
    setToDelete(null);
    if (!c) return;
    const { error: rmErr } = await supabase.storage.from(CONTRACTS_BUCKET).remove([c.storage_path]);
    if (rmErr) {
      toast({ title: "Erro ao excluir o arquivo", description: adminErrorMessage(rmErr), variant: "destructive" });
      return;
    }
    const { error } = await db.from("company_contracts").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Erro ao excluir o contrato", description: adminErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Contrato excluído" });
    }
    load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Contratos</CardTitle>
          <CardDescription>Arquivos privados — o link de cada um é gerado na hora e expira em 1 minuto.</CardDescription>
        </div>
        <label className="shrink-0">
          <input type="file" multiple className="hidden" onChange={onPick} disabled={uploading} />
          <Button asChild size="sm" disabled={uploading}>
            <span className="cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1.5" />}
              {uploading ? "Enviando..." : "Anexar contrato"}
            </span>
          </Button>
        </label>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contrato anexado.</p>
        ) : (
          <div className="divide-y border rounded-lg">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.file_name}</p>
                  <p className="text-xs text-muted-foreground">Enviado em {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openContract(c)} disabled={openingId === c.id}>
                  {openingId === c.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                  Abrir
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(c)} title="Excluir contrato">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.file_name}" será apagado do armazenamento. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function NotesCard({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data, error } = await db.rpc("admin_get_company_notes", { p_company_id: companyId });
      if (error) {
        // Erro (inclusive "Acesso negado") nunca vira campo vazio editável —
        // senão salvar sobrescreveria a observação existente.
        setLoadError(adminErrorMessage(error));
      } else {
        setLoadError(null);
        setText(data || "");
        setSaved(data || "");
      }
      setLoading(false);
    })();
  }, [companyId]);

  const dirty = text !== saved;

  async function save() {
    setSaving(true);
    const { error } = await db.rpc("admin_set_company_notes", { p_company_id: companyId, p_notes: text });
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: adminErrorMessage(error), variant: "destructive" });
      return;
    }
    setSaved(text);
    toast({ title: "Observações salvas" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Observações confidenciais</CardTitle>
        <CardDescription>Visível apenas para administradores — armazenado criptografado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Condições negociadas, contatos, combinados..."
            />
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">{dirty ? "Alterações não salvas" : saved ? "Salvo" : ""}</span>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
