import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Presentation, EyeOff, ShieldCheck, Pencil, Plus, Trash2 } from "lucide-react";
import PresentationView, { type PresentationData, type Block, type Post, type PostMediaRow } from "./PresentationView";

type Snapshot = {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia: PostMediaRow[];
};

type VersionRow = {
  id: string;
  name: string;
  created_at: string;
  visible_to_client: boolean;
};

// Aba "Apresentação" do Kanban: uma linha por lançamento (presentation_versions)
// da apresentação do projeto — cada "Lançar e Salvar" é um registro
// independente que persiste aqui, nunca sobrescrevendo o anterior. O
// conteúdo em edição (o estado "vivo") vive na aba Planejamento.
export function PresentationsTab({
  projectId,
  projectName,
  canEdit,
  onEditPlanning,
}: {
  projectId: string;
  projectName: string;
  canEdit: boolean;
  onEditPlanning: () => void;
}) {
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VersionRow | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const { data: pres } = await supabase
      .from("project_presentations")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    setPresentationId(pres?.id ?? null);
    if (!pres) {
      setVersions([]);
      setLoading(false);
      return;
    }

    const { data: v } = await supabase
      .from("presentation_versions")
      .select("id, name, created_at, visible_to_client")
      .eq("presentation_id", pres.id)
      .order("created_at", { ascending: false });
    setVersions((v || []) as VersionRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function toggleVisible(v: VersionRow) {
    const visible_to_client = !v.visible_to_client;
    const previous = versions;
    setVersions((prev) => prev.map((x) => (x.id === v.id ? { ...x, visible_to_client } : x)));
    const { error } = await supabase.from("presentation_versions").update({ visible_to_client }).eq("id", v.id);
    if (error) {
      setVersions(previous);
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    }
  }

  async function deleteVersion() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const previous = versions;
    setVersions((prev) => prev.filter((x) => x.id !== target.id));
    const { error } = await supabase.from("presentation_versions").delete().eq("id", target.id);
    if (error) {
      setVersions(previous);
      toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento excluído" });
    }
  }

  async function openPreview(versionId: string) {
    setPreviewLoading(true);
    setPreviewOpen(true);
    const { data } = await supabase
      .from("presentation_versions")
      .select("snapshot")
      .eq("id", versionId)
      .maybeSingle();
    setPreviewSnapshot((data?.snapshot as unknown as Snapshot) ?? null);
    setPreviewLoading(false);
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  if (!presentationId) {
    return (
      <div className="text-center py-12">
        <Presentation className="mx-auto h-10 w-10 mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground mb-3">Nenhuma apresentação criada ainda</p>
        {canEdit && (
          <Button onClick={onEditPlanning} className="gap-2">
            <Plus className="h-4 w-4" /> Criar apresentação
          </Button>
        )}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12">
        <Presentation className="mx-auto h-10 w-10 mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground mb-3">Nenhuma versão lançada ainda</p>
        {canEdit && (
          <Button variant="outline" onClick={onEditPlanning} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar no Planejamento
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card">
          <Presentation className="h-5 w-5 text-muted-foreground shrink-0" />
          <button
            type="button"
            onClick={() => openPreview(v.id)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="font-medium truncate hover:text-primary transition-colors">{v.name || projectName}</p>
            <p className="text-xs text-muted-foreground">Lançado em {format(new Date(v.created_at), "dd/MM/yyyy")}</p>
          </button>
          {v.visible_to_client && (
            <Badge variant="secondary" className="shrink-0 text-xs">Visível para o cliente</Badge>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => toggleVisible(v)}
            >
              {v.visible_to_client ? (
                <><EyeOff className="h-3.5 w-3.5" /> Bloquear visualização</>
              ) : (
                <><ShieldCheck className="h-3.5 w-3.5" /> Liberar visualização</>
              )}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onEditPlanning}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(v)}
              title="Excluir este lançamento"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O cliente deixa de ver este lançamento imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteVersion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-hide p-0">
          {previewLoading ? (
            <div className="text-center py-16 text-muted-foreground">Carregando...</div>
          ) : previewSnapshot ? (
            <PresentationView
              pres={previewSnapshot.pres}
              blocks={previewSnapshot.blocks}
              posts={previewSnapshot.posts}
              postMedia={previewSnapshot.postMedia}
            />
          ) : (
            <div className="text-center py-16 text-muted-foreground">Não foi possível carregar esta versão</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
