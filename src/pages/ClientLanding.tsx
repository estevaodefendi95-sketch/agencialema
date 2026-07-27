import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PresentationView, { type PresentationData, type Block, type Post, type PostMediaRow } from "@/components/presentation/PresentationView";

export default function ClientLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [pres, setPres] = useState<PresentationData | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postMedia, setPostMedia] = useState<PostMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [noVersion, setNoVersion] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_presentations")
        .select("*")
        .eq("slug", slug)
        .eq("status", "publicado")
        .eq("released", true)
        .maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // A página pública sempre mostra o conteúdo congelado do último
      // lançamento — nunca os blocos/posts em edição no Planejamento.
      const { data: version } = await supabase
        .from("presentation_versions")
        .select("snapshot")
        .eq("presentation_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const snapshot = version?.snapshot as any;
      if (!snapshot) {
        setNoVersion(true);
        setLoading(false);
        return;
      }

      setPres(snapshot.pres);
      setBlocks(snapshot.blocks || []);
      setPosts(snapshot.posts || []);
      setPostMedia(snapshot.postMedia || []);
      setLoading(false);
    })();
  }, [slug]);

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

  if (noVersion || !pres) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nenhuma versão lançada ainda</h1>
          <p className="text-muted-foreground">Volte em breve — a equipe ainda está preparando esta apresentação.</p>
        </div>
      </div>
    );
  }

  return <PresentationView pres={pres} blocks={blocks} posts={posts} postMedia={postMedia} />;
}
