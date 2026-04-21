import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";

type Presentation = {
  id: string;
  slug: string;
  status: string;
  released: boolean;
  client_logo_url: string | null;
  agency_logo_url: string | null;
  hero_title: string | null;
  hero_description: string | null;
};

type Block = { id: string; block_type: string; position: number; data: any };
type Post = { id: string; position: number; image_url: string | null; title: string | null; publish_date: string | null; copy: string | null };

export default function ClientLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [pres, setPres] = useState<Presentation | null>(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* HERO */}
      <header className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <div className="flex items-start justify-between gap-6 mb-12">
          {pres.client_logo_url ? (
            <img src={pres.client_logo_url} alt="Logo do cliente" className="h-16 max-w-[200px] object-contain" />
          ) : <div />}
          {pres.agency_logo_url && (
            <img src={pres.agency_logo_url} alt="Logo da agência" className="h-12 max-w-[160px] object-contain opacity-80" />
          )}
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          {pres.hero_title || "Apresentação"}
        </h1>
        {pres.hero_description && (
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed whitespace-pre-line">
            {pres.hero_description}
          </p>
        )}
      </header>

      {/* BLOCKS */}
      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-12">
        {blocks.map((b) => (
          <BlockRender key={b.id} block={b} posts={posts} />
        ))}

        {/* If posts plan block missing but posts exist, render anyway as fallback */}
        {!blocks.some((b) => b.block_type === "posts_plan") && posts.length > 0 && (
          <PostsPlanSection posts={posts} />
        )}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Apresentação preparada com cuidado pela equipe ✨
      </footer>
    </div>
  );
}

function BlockRender({ block, posts }: { block: Block; posts: Post[] }) {
  if (block.block_type === "header") {
    return (
      <section className="text-center py-6">
        {block.data.title && <h2 className="text-3xl font-bold mb-2">{block.data.title}</h2>}
        {block.data.subtitle && <p className="text-muted-foreground">{block.data.subtitle}</p>}
      </section>
    );
  }
  if (block.block_type === "text") {
    return (
      <section className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="whitespace-pre-line text-base leading-relaxed">{block.data.content}</p>
      </section>
    );
  }
  if (block.block_type === "image" && block.data.url) {
    return (
      <section>
        <img src={block.data.url} alt={block.data.caption || ""} className="w-full rounded-lg border shadow-sm" />
        {block.data.caption && <p className="text-sm text-muted-foreground text-center mt-2">{block.data.caption}</p>}
      </section>
    );
  }
  if (block.block_type === "gallery") {
    const images: string[] = block.data.images || [];
    return (
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="aspect-square w-full object-cover rounded-lg border" />
        ))}
      </section>
    );
  }
  if (block.block_type === "instagram_preview") {
    return <InstagramPreview images={block.data.images || []} />;
  }
  if (block.block_type === "posts_plan") {
    return <PostsPlanSection posts={posts} />;
  }
  return null;
}

function InstagramPreview({ images }: { images: string[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-center mb-6">Preview do Feed</h2>
      <div className="flex justify-center">
        <div className="relative w-[280px] h-[580px] bg-foreground rounded-[40px] p-3 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-foreground rounded-b-2xl z-10" />
          <div className="w-full h-full bg-background rounded-[28px] overflow-hidden flex flex-col">
            {/* Status bar */}
            <div className="h-6 bg-muted/30 flex-shrink-0" />
            {/* Header */}
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 p-0.5">
                <div className="w-full h-full rounded-full bg-background" />
              </div>
              <span className="text-xs font-semibold">@cliente</span>
            </div>
            {/* Feed grid */}
            <div className="grid grid-cols-3 gap-px bg-border flex-1 overflow-y-auto">
              {images.length === 0 ? (
                <div className="col-span-3 flex items-center justify-center text-muted-foreground p-4 text-xs text-center">
                  Sem imagens no feed
                </div>
              ) : images.map((url, i) => (
                <img key={i} src={url} alt="" className="aspect-square w-full object-cover bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PostsPlanSection({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">Planejamento de Postagens</h2>
      <div className="space-y-4">
        {posts.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0">
              {p.image_url ? (
                <img src={p.image_url} alt={p.title || ""} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-lg">{p.title || "Sem título"}</h3>
                  {p.publish_date && (
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                      {format(parseISO(p.publish_date), "dd 'de' MMM", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {p.copy && <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{p.copy}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
