import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PresentationView, { type PresentationData, type Block, type Post } from "@/components/presentation/PresentationView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, EyeOff } from "lucide-react";

export default function PresentationPreview() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [pres, setPres] = useState<PresentationData | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!projectId || authLoading || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_presentations")
        .select("*")
        .eq("project_id", projectId)
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
  }, [projectId, authLoading, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Link to="/login" className="underline">Faça login para ver o preview</Link>
      </div>
    );
  }

  if (notFound || !pres) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <h1 className="text-2xl font-bold">Apresentação não encontrada</h1>
        <Button asChild variant="outline">
          <Link to={`/projetos/${projectId}`}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao projeto</Link>
        </Button>
      </div>
    );
  }

  const isLive = pres.status === "publicado" && pres.released;

  return (
    <div>
      {/* Preview banner */}
      <div className="sticky top-0 z-50 bg-foreground text-background px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 text-sm">
          <EyeOff className="h-4 w-4" />
          <span className="font-medium">Modo pré-visualização</span>
          <span className="opacity-80">
            — o cliente {isLive ? "já vê" : "ainda não vê"} esta página
          </span>
        </div>
        <Button asChild size="sm" variant="secondary" className="h-7">
          <Link to={`/projetos/${projectId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar ao editor
          </Link>
        </Button>
      </div>
      <PresentationView pres={pres} blocks={blocks} posts={posts} />
    </div>
  );
}
