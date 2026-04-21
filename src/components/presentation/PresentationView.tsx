import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";

export type PresentationData = {
  id: string;
  slug: string;
  status: string;
  released: boolean;
  client_logo_url: string | null;
  agency_logo_url: string | null;
  hero_title: string | null;
  hero_description: string | null;
};

export type Block = { id: string; block_type: string; position: number; data: any };
export type Post = {
  id: string;
  position: number;
  image_url: string | null;
  title: string | null;
  publish_date: string | null;
  copy: string | null;
};

export default function PresentationView({
  pres,
  blocks,
  posts,
}: {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-20 md:pb-32">
          <div className="flex items-start justify-between gap-6 mb-16 md:mb-24 animate-fade-in">
            {pres.client_logo_url ? (
              <img
                src={pres.client_logo_url}
                alt="Logo do cliente"
                className="h-16 md:h-20 max-w-[220px] object-contain"
              />
            ) : (
              <div />
            )}
            {pres.agency_logo_url && (
              <img
                src={pres.agency_logo_url}
                alt="Logo da agência"
                className="h-10 md:h-12 max-w-[160px] object-contain opacity-70"
              />
            )}
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.05] animate-fade-in">
            {pres.hero_title || "Apresentação"}
          </h1>
          {pres.hero_description && (
            <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl leading-relaxed font-light whitespace-pre-line animate-fade-in">
              {pres.hero_description}
            </p>
          )}
        </div>
      </header>

      {/* BLOCKS */}
      <main className="max-w-6xl mx-auto px-6 pb-24 space-y-20 md:space-y-28">
        {blocks.map((b) => (
          <BlockRender key={b.id} block={b} posts={posts} />
        ))}

        {/* Fallback: render posts plan if not in any block */}
        {!blocks.some((b) => b.block_type === "posts_plan") && posts.length > 0 && (
          <PostsPlanSection posts={posts} />
        )}
      </main>

      <footer className="border-t py-10 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          {pres.agency_logo_url && (
            <img src={pres.agency_logo_url} alt="" className="h-8 opacity-60" />
          )}
          <span>Apresentação preparada com cuidado · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function BlockRender({ block, posts }: { block: Block; posts: Post[] }) {
  if (block.block_type === "header") {
    return (
      <section className="text-center py-6 animate-fade-in">
        {block.data.title && (
          <h2 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">{block.data.title}</h2>
        )}
        {block.data.subtitle && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{block.data.subtitle}</p>
        )}
      </section>
    );
  }
  if (block.block_type === "text") {
    return (
      <section className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto animate-fade-in">
        <p className="whitespace-pre-line text-lg md:text-xl leading-relaxed font-light text-foreground/90">
          {block.data.content}
        </p>
      </section>
    );
  }
  if (block.block_type === "image" && block.data.url) {
    return (
      <section className="animate-fade-in">
        <img
          src={block.data.url}
          alt={block.data.caption || ""}
          className="w-full rounded-2xl border shadow-xl"
        />
        {block.data.caption && (
          <p className="text-sm text-muted-foreground text-center mt-4 italic">
            {block.data.caption}
          </p>
        )}
      </section>
    );
  }
  if (block.block_type === "gallery") {
    const images: string[] = block.data.images || [];
    return (
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
        {images.map((url, i) => (
          <img
            key={i}
            src={url}
            alt=""
            className="aspect-square w-full object-cover rounded-2xl border shadow-md hover:scale-[1.02] transition-transform duration-300"
          />
        ))}
      </section>
    );
  }
  if (block.block_type === "instagram_preview") {
    return <InstagramPreview data={block.data} />;
  }
  if (block.block_type === "posts_plan") {
    return <PostsPlanSection posts={posts} />;
  }
  return null;
}

function InstagramPreview({ images }: { images: string[] }) {
  return (
    <section className="animate-fade-in">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-3 tracking-tight">
        Preview do Feed
      </h2>
      <p className="text-center text-muted-foreground mb-10">
        Como ficará o Instagram do cliente
      </p>
      <div className="flex justify-center">
        <div className="relative">
          {/* Glow */}
          <div className="absolute -inset-8 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-yellow-500/20 blur-3xl rounded-full -z-10" />
          {/* iPhone frame — feed only, no header */}
          <div className="relative w-[300px] md:w-[340px] bg-foreground rounded-[44px] p-3 shadow-2xl">
            <div className="w-full bg-background rounded-[32px] overflow-hidden">
              <div className="grid grid-cols-3 gap-px bg-border">
                {images.length === 0 ? (
                  <div className="col-span-3 aspect-[3/4] flex items-center justify-center text-muted-foreground p-6 text-sm text-center">
                    Sem imagens no feed
                  </div>
                ) : (
                  images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="aspect-square w-full object-cover bg-muted"
                    />
                  ))
                )}
              </div>
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
    <section className="animate-fade-in">
      <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight text-center">
        Planejamento de Postagens
      </h2>
      <p className="text-center text-muted-foreground mb-10">
        Cronograma e copies dos próximos posts
      </p>
      <div className="space-y-6">
        {posts.map((p) => (
          <Card
            key={p.id}
            className="overflow-hidden border shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl"
          >
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.title || ""}
                  className="w-full aspect-square md:aspect-auto md:h-full object-cover"
                />
              ) : (
                <div className="w-full aspect-square md:aspect-auto bg-muted flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="p-6 md:p-8 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="font-bold text-xl md:text-2xl tracking-tight">
                    {p.title || "Sem título"}
                  </h3>
                  {p.publish_date && (
                    <span className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-full font-medium whitespace-nowrap">
                      {format(parseISO(p.publish_date), "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {p.copy && (
                  <p className="text-base text-muted-foreground whitespace-pre-line leading-relaxed">
                    {p.copy}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
