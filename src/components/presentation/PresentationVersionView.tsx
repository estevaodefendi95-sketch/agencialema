import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PresentationView, { type PresentationData, type Block, type Post, type PostMediaRow } from "./PresentationView";

type Snapshot = {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia: PostMediaRow[];
};

// Lê o snapshot mais recente lançado (presentation_versions) pra um projeto —
// usado pela aba "Apresentação" do Kanban, que mostra sempre o último
// conteúdo congelado, nunca os blocos/posts em edição no Planejamento.
export function PresentationVersionView({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: pres } = await supabase
        .from("project_presentations")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (!pres) {
        setSnapshot(null);
        setLoading(false);
        return;
      }

      const { data: version } = await supabase
        .from("presentation_versions")
        .select("snapshot")
        .eq("presentation_id", pres.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSnapshot((version?.snapshot as unknown as Snapshot) ?? null);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  if (!snapshot) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Nenhuma versão lançada ainda</p>
      </div>
    );
  }

  return (
    <PresentationView
      pres={snapshot.pres}
      blocks={snapshot.blocks}
      posts={snapshot.posts}
      postMedia={snapshot.postMedia}
    />
  );
}
