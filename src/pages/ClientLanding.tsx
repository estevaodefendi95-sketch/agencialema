import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import PresentationView, { type PresentationData, type Block, type Post, type PostMediaRow } from "@/components/presentation/PresentationView";

type Snapshot = {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia: PostMediaRow[];
};

type VersionEntry = {
  id: string;
  name: string;
  created_at: string;
  snapshot: Snapshot;
};

export default function ClientLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [noVersion, setNoVersion] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_presentations")
        .select("id")
        .eq("slug", slug)
        .eq("status", "publicado")
        .eq("released", true)
        .maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // A página pública mostra todos os lançamentos liberados pro cliente
      // (visible_to_client) — a policy pública já garante esse filtro, mas
      // deixamos explícito aqui também. O mais recente vem em destaque; os
      // demais ficam listados abaixo como "Apresentações anteriores".
      const { data: v } = await supabase
        .from("presentation_versions")
        .select("id, name, created_at, snapshot")
        .eq("presentation_id", data.id)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false });

      if (!v || v.length === 0) {
        setNoVersion(true);
        setLoading(false);
        return;
      }

      setVersions(v as unknown as VersionEntry[]);
      setSelectedId(v[0].id);
      setLoading(false);
    })();
  }, [slug]);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) || versions[0] || null,
    [versions, selectedId],
  );
  const olderVersions = useMemo(
    () => (selected ? versions.filter((v) => v.id !== selected.id) : []),
    [versions, selected],
  );

  function openVersion(id: string) {
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Apresentação indisponível</h1>
          <p className="text-muted-foreground">Este conteúdo ainda não foi liberado pela equipe.</p>
        </div>
      </div>
    );
  }

  if (noVersion || !selected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nenhuma versão lançada ainda</h1>
          <p className="text-muted-foreground">Volte em breve — a equipe ainda está preparando esta apresentação.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PresentationView
        pres={selected.snapshot.pres}
        blocks={selected.snapshot.blocks}
        posts={selected.snapshot.posts}
        postMedia={selected.snapshot.postMedia}
      />

      {olderVersions.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <h2 className="text-xl font-bold mb-4">Apresentações anteriores</h2>
          <div className="space-y-2">
            {olderVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => openVersion(v.id)}
                className="w-full flex items-center justify-between gap-3 text-left border rounded-lg px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium">{v.name}</span>
                <span className="text-sm text-muted-foreground shrink-0">{format(new Date(v.created_at), "dd/MM/yyyy")}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
