import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PresentationView, { type PresentationData, type Block, type Post } from "@/components/presentation/PresentationView";

export default function ClientLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [pres, setPres] = useState<PresentationData | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      setPres(data as any);
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("presentation_blocks").select("*").eq("presentation_id", data.id).order("position"),
        supabase.from("presentation_posts").select("*").eq("presentation_id", data.id).order("position"),
      ]);
      setBlocks((b || []) as any);
      setPosts((p || []) as any);
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

  if (notFound || !pres) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Apresentação indisponível</h1>
          <p className="text-muted-foreground">Este conteúdo ainda não foi liberado pela equipe.</p>
        </div>
      </div>
    );
  }

  return <PresentationView pres={pres} blocks={blocks} posts={posts} />;
}
