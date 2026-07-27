import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Presentation, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import PresentationView, { type PresentationData, type Block, type Post, type PostMediaRow } from "./PresentationView";

type Snapshot = {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia: PostMediaRow[];
};

type PresentationRow = {
  id: string;
  slug: string;
  status: string;
  released: boolean;
  hero_title: string | null;
  latestVersion: { id: string; name: string } | null;
};

// Aba "Apresentação" do Kanban: lista compacta das apresentações do projeto
// (normalmente uma só, mas a estrutura suporta mais). Mostra sempre o que já
// foi lançado — o conteúdo em edição vive na aba Planejamento.
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
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("project_presentations")
      .select("id, slug, status, released, hero_title")
      .eq("project_id", projectId);

    const list = data || [];
    const withVersions = await Promise.all(
      list.map(async (p) => {
        const { data: v } = await supabase
          .from("presentation_versions")
          .select("id, name")
          .eq("presentation_id", p.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...p, latestVersion: v || null } as PresentationRow;
      }),
    );
    setPresentations(withVersions);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function toggleReleased(p: PresentationRow) {
    const released = !p.released;
    setPresentations((prev) => prev.map((x) => (x.id === p.id ? { ...x, released } : x)));
    await supabase.from("project_presentations").update({ released }).eq("id", p.id);
  }

  async function openPreview(p: PresentationRow) {
    if (!p.latestVersion) return;
    setPreviewLoading(true);
    setPreviewOpen(true);
    const { data } = await supabase
      .from("presentation_versions")
      .select("snapshot")
      .eq("id", p.latestVersion.id)
      .maybeSingle();
    setPreviewSnapshot((data?.snapshot as unknown as Snapshot) ?? null);
    setPreviewLoading(false);
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  if (presentations.length === 0) {
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

  return (
    <div className="space-y-2">
      {presentations.map((p) => {
        const title = p.hero_title || p.latestVersion?.name || projectName;
        const hasVersion = !!p.latestVersion;
        return (
          <div key={p.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card">
            <Presentation className="h-5 w-5 text-muted-foreground shrink-0" />
            <button
              type="button"
              onClick={() => openPreview(p)}
              disabled={!hasVersion}
              title={hasVersion ? undefined : "Nenhuma versão lançada ainda"}
              className="flex-1 min-w-0 text-left font-medium truncate enabled:hover:text-primary enabled:cursor-pointer disabled:cursor-default transition-colors"
            >
              {title}
            </button>
            <Badge variant={p.status === "publicado" ? "default" : "secondary"} className="shrink-0">
              {p.status === "publicado" ? "Publicado" : "Rascunho"}
            </Badge>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => toggleReleased(p)}
                title={p.released ? "Cliente vê a página — clique pra ocultar" : "Cliente não vê a página — clique pra liberar"}
              >
                {p.released ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onEditPlanning}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
          </div>
        );
      })}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
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
            <div className="text-center py-16 text-muted-foreground">Nenhuma versão lançada ainda</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
