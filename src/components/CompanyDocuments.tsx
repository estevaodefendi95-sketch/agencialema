import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Paperclip, X } from "lucide-react";

interface CompanyDocument {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface Props {
  companyId: string;
  canManage: boolean;
}

export function CompanyDocuments({ companyId, canManage }: Props) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("company_documents")
      .select("id, file_name, file_url, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setDocuments((data || []) as CompanyDocument[]);
  };

  useEffect(() => { load(); }, [companyId]);

  const uploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `company-docs/${companyId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
    if (uploadError) {
      toast({ title: "Erro ao enviar documento", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      e.target.value = "";
      return;
    }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    await supabase.from("company_documents").insert({
      company_id: companyId,
      file_name: file.name,
      file_url: urlData.publicUrl,
    });
    toast({ title: "Documento anexado" });
    setUploading(false);
    e.target.value = "";
    load();
  };

  const removeDocument = async (doc: CompanyDocument) => {
    const urlParts = doc.file_url.split("/storage/v1/object/public/attachments/");
    if (urlParts[1]) {
      await supabase.storage.from("attachments").remove([urlParts[1].split("?")[0]]);
    }
    await supabase.from("company_documents").delete().eq("id", doc.id);
    toast({ title: "Documento removido" });
    load();
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <FileText className="h-4 w-4" /> Documentos
      </Label>
      {documents.length > 0 ? (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 group">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{doc.file_name}</span>
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Baixar"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {canManage && (
                <button
                  onClick={() => removeDocument(doc)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum documento anexado</p>
      )}
      {canManage && (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Paperclip className="h-4 w-4" />
          {uploading ? "Enviando..." : "Anexar documento"}
          <input type="file" className="hidden" onChange={uploadDocument} disabled={uploading} />
        </label>
      )}
    </div>
  );
}
