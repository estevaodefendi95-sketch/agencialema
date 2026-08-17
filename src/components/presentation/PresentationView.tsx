import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Grid3x3, Play, UserSquare2, Presentation as PresentationIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGalleryItems, getPostMediaItems, type MediaItem, type PostMediaRow } from "./mediaUtils";
import { normalizeTheme, themeVars } from "./theme";
import CoverSlide from "./blocks/CoverSlide";
import RulesSlide from "./blocks/RulesSlide";
import ThemesSlide from "./blocks/ThemesSlide";
import FeedOverviewSlide from "./blocks/FeedOverviewSlide";

export type { PostMediaRow } from "./mediaUtils";

export type PresentationData = {
  id: string;
  slug: string;
  status: string;
  released: boolean;
  client_logo_url: string | null;
  agency_logo_url: string | null;
  hero_title: string | null;
  hero_description: string | null;
  hero_image_url?: string | null;
  theme?: any;
};

export type Block = { id: string; block_type: string; position: number; data: any };
export type Post = {
  id: string;
  position: number;
  image_url: string | null;
  title: string | null;
  publish_date: string | null;
  publish_time: string | null;
  format_type: string | null;
  copy: string | null;
};

type SlideDef = { id: string; invert?: boolean; backgroundImage?: string | null; fullBleed?: boolean; node: React.ReactNode };

export default function PresentationView({
  pres,
  blocks,
  posts,
  postMedia = [],
}: {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia?: PostMediaRow[];
}) {
  const theme = useMemo(() => normalizeTheme(pres.theme), [pres.theme]);
  const [deckMode, setDeckMode] = useState(false);
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () => buildSlides({ pres, blocks, posts, postMedia }),
    [pres, blocks, posts, postMedia],
  );

  useEffect(() => {
    if (!deckMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "Escape") setDeckMode(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deckMode, slides.length]);

  const current = slides[Math.min(index, Math.max(slides.length - 1, 0))];

  return (
    <div
      style={themeVars(theme)}
      className="pres-root min-h-screen"
    >
      <div style={{ background: "var(--pres-bg)", color: "var(--pres-fg)" }} className="min-h-screen">
        {deckMode && current ? (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
            <div
              className="relative w-full max-w-[1400px] aspect-[16/9] overflow-hidden shadow-2xl"
              style={
                current.invert
                  ? { background: "var(--pres-invert-bg)", color: "var(--pres-invert-fg)" }
                  : { background: "var(--pres-bg)", color: "var(--pres-fg)" }
              }
            >
              {current.backgroundImage && !current.fullBleed && (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${current.backgroundImage})` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: current.invert ? "color-mix(in srgb, var(--pres-invert-bg) 55%, transparent)" : "color-mix(in srgb, var(--pres-bg) 65%, transparent)" }}
                  />
                </>
              )}
              <div className={cn("relative w-full h-full overflow-auto", current.fullBleed ? "p-0" : "px-6 md:px-16 py-10 md:py-14")}>
                {current.node}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
                className="h-9 w-9 rounded-full border border-current/30 flex items-center justify-center disabled:opacity-30"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm tabular-nums opacity-70">
                {index + 1} / {slides.length}
              </span>
              <button
                onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
                disabled={index >= slides.length - 1}
                className="h-9 w-9 rounded-full border border-current/30 flex items-center justify-center disabled:opacity-30"
                aria-label="Próximo slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeckMode(false)}
                className="ml-2 text-sm flex items-center gap-1.5 opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" /> Sair
              </button>
            </div>
          </div>
        ) : (
          <>
            {slides.map((s) => (
              <section
                key={s.id}
                className={cn(
                  "relative w-full h-[85vh] md:h-screen overflow-y-auto flex [align-items:safe_center] animate-fade-in",
                  s.fullBleed ? "p-0" : "px-6 md:px-16 py-14 md:py-20",
                )}
                style={
                  s.invert
                    ? { background: "var(--pres-invert-bg)", color: "var(--pres-invert-fg)" }
                    : undefined
                }
              >
                {s.backgroundImage && !s.fullBleed && (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${s.backgroundImage})` }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: s.invert ? "color-mix(in srgb, var(--pres-invert-bg) 55%, transparent)" : "color-mix(in srgb, var(--pres-bg) 65%, transparent)" }}
                    />
                  </>
                )}
                <div className={cn("relative w-full", !s.fullBleed && "max-w-6xl mx-auto")}>{s.node}</div>
              </section>
            ))}

            <footer
              className="px-6 md:px-16 py-10 flex items-center justify-between gap-4 border-t"
              style={{ borderColor: "color-mix(in srgb, var(--pres-fg) 15%, transparent)" }}
            >
              <span className="pres-display text-sm md:text-base text-[color:var(--pres-accent)]">
                #seu feed, seu lema.
              </span>
              {pres.agency_logo_url && (
                <img src={pres.agency_logo_url} alt="" className="h-8 object-contain opacity-70" />
              )}
            </footer>

            {slides.length > 0 && (
              <button
                onClick={() => {
                  setIndex(0);
                  setDeckMode(true);
                }}
                className="hidden md:flex fixed bottom-6 right-6 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg z-30"
                style={{ background: "var(--pres-accent)", color: "var(--pres-invert-fg)" }}
              >
                <PresentationIcon className="h-4 w-4" /> Modo apresentação
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildSlides({
  pres,
  blocks,
  posts,
  postMedia,
}: {
  pres: PresentationData;
  blocks: Block[];
  posts: Post[];
  postMedia: PostMediaRow[];
}): SlideDef[] {
  const slides: SlideDef[] = [];
  const hasCover = blocks.some((b) => b.block_type === "cover");

  if (!hasCover) {
    slides.push({
      id: "hero",
      fullBleed: !!pres.hero_image_url,
      node: <HeroSlide pres={pres} />,
    });
  }

  for (const b of blocks) {
    slides.push(...blockSlides(b, pres, posts, postMedia));
  }

  if (!blocks.some((b) => b.block_type === "posts_plan") && posts.length > 0) {
    slides.push(...postSlides(posts, postMedia));
  }

  return slides;
}

function blockSlides(b: Block, pres: PresentationData, posts: Post[], postMedia: PostMediaRow[]): SlideDef[] {
  const invert = !!b.data?.invert;

  switch (b.block_type) {
    case "cover":
      return [
        {
          id: b.id,
          invert,
          backgroundImage: b.data?.background_image_url || null,
          node: <CoverSlide data={b.data || {}} clientLogo={pres.client_logo_url} agencyLogo={pres.agency_logo_url} />,
        },
      ];
    case "rules":
      return [
        {
          id: b.id,
          invert: b.data?.invert !== false,
          backgroundImage: b.data?.background_image_url || null,
          node: <RulesSlide data={b.data || {}} agencyLogo={pres.agency_logo_url} />,
        },
      ];
    case "themes":
      return [{ id: b.id, backgroundImage: b.data?.background_image_url || null, node: <ThemesSlide data={b.data || {}} /> }];
    case "feed_overview":
      return [{ id: b.id, backgroundImage: b.data?.background_image_url || null, node: <FeedOverviewSlide data={b.data || {}} /> }];
    case "header":
      return [
        {
          id: b.id,
          invert,
          backgroundImage: b.data?.background_image_url || null,
          node: (
            <div className={cn(b.data?.align === "center" && "text-center")}>
              {b.data?.title && (
                <h2 className="pres-display text-4xl md:text-7xl font-bold tracking-tight leading-[1.05]">
                  {b.data.title}
                </h2>
              )}
              {b.data?.subtitle && (
                <p className="text-lg md:text-2xl mt-5 opacity-80 max-w-3xl whitespace-pre-line">
                  {b.data.subtitle}
                </p>
              )}
            </div>
          ),
        },
      ];
    case "canvas":
      return [
        {
          id: b.id,
          fullBleed: true,
          node: <CanvasSlide data={b.data || { elements: [] }} />,
        },
      ];
    case "banner":
      if (!b.data?.url) return [];
      return [
        {
          id: b.id,
          fullBleed: true,
          node: <BannerSlide data={b.data} />,
        },
      ];
    case "text":
      return [
        {
          id: b.id,
          invert,
          backgroundImage: b.data?.background_image_url || null,
          node: (
            <p
              className={cn(
                "text-xl md:text-3xl leading-relaxed font-light whitespace-pre-line max-w-4xl",
                b.data?.align === "center" && "text-center mx-auto",
              )}
            >
              {b.data?.content}
            </p>
          ),
        },
      ];
    case "image":
      if (!b.data?.url) return [];
      return [
        {
          id: b.id,
          invert,
          node: (
            <figure>
              <img src={b.data.url} alt={b.data.caption || ""} className="w-full max-h-[70vh] object-contain" />
              {b.data.caption && (
                <figcaption className="text-sm mt-4 opacity-70 text-center">{b.data.caption}</figcaption>
              )}
            </figure>
          ),
        },
      ];
    case "gallery": {
      const items = getGalleryItems(b.data);
      if (items.length === 0) return [];
      return [
        {
          id: b.id,
          invert,
          node: (
            <>
              <div className="hidden md:grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, minmax(0,1fr))` }}>
                {items.map((item, i) => (
                  <MediaTile key={i} item={item} className="w-full aspect-[4/5] object-cover" />
                ))}
              </div>
              <div className="md:hidden">
                <MediaCarousel items={items} />
              </div>
              {b.data?.caption && <p className="text-sm mt-4 opacity-70 text-center">{b.data.caption}</p>}
            </>
          ),
        },
      ];
    }
    case "instagram_preview":
      return [{ id: b.id, invert, node: <InstagramPreview data={b.data || {}} /> }];
    case "posts_plan":
      return postSlides(posts, postMedia);
    default:
      return [];
  }
}

function postSlides(posts: Post[], postMedia: PostMediaRow[]): SlideDef[] {
  return posts.map((p, i) => ({
    id: `post-${p.id}`,
    node: <PostSlide post={p} index={i} media={postMedia} />,
  }));
}

function HeroSlide({ pres }: { pres: PresentationData }) {
  if (pres.hero_image_url) {
    return (
      <div className="relative w-full h-full min-h-[85vh] md:min-h-screen">
        <img src={pres.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/40" />
        <div className="absolute inset-x-0 top-8 md:top-12 px-6 md:px-16 flex items-center justify-center gap-10">
          {pres.client_logo_url && (
            <div className="h-12 md:h-16 flex items-center justify-center bg-white/90 rounded px-4 py-2">
              <img src={pres.client_logo_url} alt="Logo do cliente" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {pres.agency_logo_url && (
            <div className="h-10 md:h-14 flex items-center justify-center bg-white/90 rounded px-4 py-2">
              <img src={pres.agency_logo_url} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-12 md:bottom-20 px-6 md:px-16 text-center">
          <span className="pres-display block text-xs md:text-sm uppercase tracking-[0.2em] text-white/80 mb-3">
            Apresentação de conteúdo
          </span>
          <h1 className="pres-display text-4xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white mb-4">
            {pres.hero_title || "Apresentação"}
          </h1>
          {pres.hero_description && (
            <p className="text-base md:text-xl max-w-3xl mx-auto leading-relaxed font-light text-white/90 whitespace-pre-line">
              {pres.hero_description}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-16 pb-8 mb-10 border-b border-current/15">
        {pres.client_logo_url && (
          <div className="h-20 md:h-28 flex items-center justify-center">
            <img src={pres.client_logo_url} alt="Logo do cliente" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {pres.agency_logo_url && (
          <div className="h-20 md:h-28 flex items-center justify-center">
            <img src={pres.agency_logo_url} alt="" className="max-h-full max-w-full object-contain opacity-70" />
          </div>
        )}
      </div>
      <div className="text-center">
        <span className="pres-display block text-xs md:text-sm uppercase tracking-[0.2em] text-[color:var(--pres-accent)] mb-4">
          Apresentação de conteúdo
        </span>
        <h1 className="pres-display text-5xl md:text-8xl font-bold tracking-tight leading-[1.02] mb-8">
          {pres.hero_title || "Apresentação"}
        </h1>
        {pres.hero_description && (
          <p className="text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed font-light opacity-80 whitespace-pre-line">
            {pres.hero_description}
          </p>
        )}
      </div>
    </div>
  );
}

function BannerSlide({ data }: { data: any }) {
  const position: "top" | "center" | "bottom" = data.text_position || "bottom";
  const hasText = !!(data.title || data.subtitle);

  return (
    <div className="relative w-full h-full min-h-[85vh] md:min-h-screen">
      <img src={data.url} alt={data.title || ""} className="absolute inset-0 w-full h-full object-cover" />
      {hasText && (
        <>
          <div
            className={cn(
              "absolute inset-x-0 bg-gradient-to-b from-black/60 via-black/10 to-transparent",
              position === "top" && "top-0 h-1/2",
              position === "center" && "inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/10",
              position === "bottom" && "bottom-0 top-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent",
            )}
          />
          <div
            className={cn(
              "absolute inset-x-0 px-6 md:px-16 flex flex-col",
              position === "top" && "top-10 md:top-16 items-start text-left",
              position === "center" && "inset-y-0 items-center justify-center text-center",
              position === "bottom" && "bottom-10 md:bottom-16 items-start text-left",
            )}
          >
            {data.title && (
              <h2 className="pres-display text-3xl md:text-6xl font-bold tracking-tight text-white leading-[1.05] max-w-4xl">
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p className="text-base md:text-xl text-white/90 mt-3 max-w-2xl whitespace-pre-line">
                {data.subtitle}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CanvasSlide({ data }: { data: any }) {
  const elements: any[] = data.elements || [];
  return (
    <div
      className="absolute inset-0"
      style={{
        containerType: "inline-size",
        background: data.background_image_url
          ? `center/cover no-repeat url(${data.background_image_url})`
          : data.background_color || "var(--pres-bg)",
      } as React.CSSProperties}
    >
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute overflow-hidden"
          style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, zIndex: el.zIndex }}
        >
          {el.type === "text" ? (
            <div
              className="w-full h-full"
              style={{
                fontSize: `${el.fontSize || 4}cqw`,
                fontFamily: `"${el.fontFamily || "Archivo"}", ui-sans-serif, system-ui, sans-serif`,
                color: el.color || undefined,
                fontWeight: el.bold ? 700 : 400,
                textAlign: el.align || "left",
                lineHeight: 1.15,
                whiteSpace: "pre-wrap",
              }}
            >
              {el.content}
            </div>
          ) : (
            el.url && (
              <img
                src={el.url}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${el.imgX ?? 50}% ${el.imgY ?? 50}%`,
                  transform: `scale(${el.imgScale ?? 1})`,
                  transformOrigin: "center",
                }}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}

function PostSlide({ post, index, media }: { post: Post; index: number; media: PostMediaRow[] }) {
  const items = getPostMediaItems(post, media).map((m) => ({ url: m.media_url, type: m.media_type } as MediaItem));

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 md:gap-12 items-start">
      <div className="w-full">
        {items.length > 0 && (
          <MediaCarousel items={items} mediaClassName="w-full aspect-[4/5] object-cover" />
        )}
      </div>

      <div className="w-full space-y-6">
        <div>
          <h2 className="pres-display text-3xl md:text-5xl font-bold tracking-tight text-[color:var(--pres-accent)]">
            Post {String(index + 1).padStart(2, "0")}
          </h2>
          <span className="pres-display text-base md:text-2xl font-semibold text-[color:var(--pres-accent)]">
            {post.format_type && <span className="font-bold">{post.format_type}: </span>}
            {post.title && <span className="font-semibold">{post.title}</span>}
          </span>
        </div>

        {(post.publish_date || post.publish_time) && (
          <span
            className="pres-display text-xs md:text-base font-bold px-3 py-1.5 uppercase whitespace-nowrap"
            style={{ background: "var(--pres-accent)", color: "var(--pres-invert-fg)" }}
          >
            {[
              post.publish_date && `DATA: ${format(parseISO(post.publish_date), "dd/MM")}`,
              post.publish_time && `HORÁRIO: ${post.publish_time.slice(0, 5)}`,
            ]
              .filter(Boolean)
              .join(" | ")}
          </span>
        )}

        {post.copy && (
          <div className="w-full">
            <p className="pres-display font-bold text-lg md:text-2xl text-[color:var(--pres-accent)] mb-2">Legenda:</p>
            <p className="text-base md:text-xl leading-relaxed whitespace-pre-line opacity-90">{post.copy}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Carrossel simples (dots + setas nas laterais em telas maiores) usado tanto
// pela Galeria quanto pelos posts do Planejamento. Sem carrossel quando há
// só 1 item — mostra a mídia direto.
function MediaCarousel({ items, mediaClassName }: { items: MediaItem[]; mediaClassName?: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    setSelected(api.selectedScrollSnap());
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (items.length === 0) return null;
  if (items.length === 1) return <MediaTile item={items[0]} className={mediaClassName} />;

  return (
    <div className="h-full flex flex-col">
      <Carousel setApi={setApi} className="w-full flex-1 min-h-0">
        <CarouselContent className="h-full">
          {items.map((item, i) => (
            <CarouselItem key={i} className="h-full">
              <MediaTile item={item} className={mediaClassName} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
      <div className="flex justify-center gap-1.5 mt-3 shrink-0">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selected ? "w-4 bg-[color:var(--pres-accent)]" : "w-1.5 bg-current opacity-30",
            )}
            aria-label={`Ir para item ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function MediaTile({ item, className }: { item: MediaItem; className?: string }) {
  const cls = className || "aspect-square w-full object-cover";
  if (item.type === "video") {
    return <video src={item.url} controls className={cn(cls, "bg-black")} />;
  }
  return <img src={item.url} alt="" className={cn(cls, "hover:scale-[1.01] transition-transform duration-300")} />;
}

function InstagramPreview({ data }: { data: any }) {
  const images: string[] = data?.images || [];
  const layout: "feed_only" | "full_profile" = data?.layout || "feed_only";
  const isFull = layout === "full_profile";
  const highlights: { id: string; title: string; cover_url: string }[] = data?.highlights || [];

  return (
    <section className="animate-fade-in">
      <h2 className="pres-display text-3xl md:text-4xl font-bold text-center mb-1 tracking-tight">
        {isFull ? "Preview do Perfil" : "Preview do Feed"}
      </h2>
      <p className="text-center opacity-70 mb-4">
        {isFull ? "Como ficará o perfil completo do cliente" : "Como ficará o Instagram do cliente"}
      </p>
      <div className="flex justify-center">
        <div className="relative py-2 px-3">
          {/* Side buttons (drawn outside the frame) */}
          {/* Left: silent switch + volume up + volume down */}
          <div className="absolute left-[1px] top-[120px] w-[4px] h-[24px] bg-neutral-900 rounded-l-md" />
          <div className="absolute left-[1px] top-[160px] w-[4px] h-[44px] bg-neutral-900 rounded-l-md" />
          <div className="absolute left-[1px] top-[214px] w-[4px] h-[44px] bg-neutral-900 rounded-l-md" />
          {/* Right: power button */}
          <div className="absolute right-[1px] top-[180px] w-[4px] h-[68px] bg-neutral-900 rounded-r-md" />

          {/* iPhone outer frame — proportional to a real device (~9:19.5) */}
          <div
            className="relative h-[68vh] md:h-[78vh] max-h-[760px] min-h-[480px] w-auto bg-white border-[3px] border-neutral-900 rounded-[44px] p-[6px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)]"
            style={{ aspectRatio: "9 / 19" }}
          >
            {/* Inner screen */}
            <div className="relative w-full h-full bg-white text-neutral-900 rounded-[38px] overflow-hidden border border-neutral-200 flex flex-col">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-[110px] h-[22px] bg-neutral-900 rounded-b-[14px] flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                <div className="w-7 h-[3px] rounded-full bg-neutral-800" />
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between px-5 pt-1.5 pb-1 text-[10px] text-neutral-600 font-semibold shrink-0">
                <span>9:41</span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <span>•••</span>
                  <span>◗</span>
                </span>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {isFull && (
                  <ProfileHeader
                    username={data?.username || "yourname"}
                    displayName={data?.display_name}
                    bio={data?.bio}
                    avatarUrl={data?.avatar_url}
                    postsCount={data?.posts_count}
                    followersCount={data?.followers_count}
                    followingCount={data?.following_count}
                    highlights={highlights}
                  />
                )}

                {/* Feed-only top tabs */}
                {!isFull && (
                  <div className="flex items-center justify-around border-b border-neutral-200 py-1.5 px-3 text-neutral-400 text-xs">
                    <span className="text-neutral-900">▦</span>
                    <span>▷</span>
                    <span>👤</span>
                  </div>
                )}

                {/* Feed grid */}
                <div className="grid grid-cols-3 gap-px bg-neutral-200">
                  {images.length === 0 ? (
                    <div className="col-span-3 aspect-[3/4] flex items-center justify-center text-neutral-400 p-6 text-sm text-center bg-white">
                      Sem imagens no feed
                    </div>
                  ) : (
                    images.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="aspect-square w-full object-cover bg-neutral-100"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Home indicator */}
              <div className="shrink-0 flex justify-center py-2">
                <div className="w-[100px] h-[4px] rounded-full bg-neutral-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileHeader({
  username,
  displayName,
  bio,
  avatarUrl,
  postsCount,
  followersCount,
  followingCount,
  highlights,
}: {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  postsCount?: string | number;
  followersCount?: string | number;
  followingCount?: string | number;
  highlights: { id: string; title: string; cover_url: string }[];
}) {
  return (
    <div className="px-3 pt-3 pb-2">
      {/* Top bar */}
      <div className="flex items-center justify-between text-[13px] mb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <span>←</span>
          <span>{username}</span>
        </div>
        <div className="flex items-center gap-3 text-base">
          <span>⌕</span>
          <span>⋮</span>
        </div>
      </div>

      {/* Avatar + counters */}
      <div className="flex items-center gap-3 mb-2">
        <div className="shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-[60px] w-[60px] rounded-full object-cover ring-1 ring-neutral-200" />
          ) : (
            <div className="h-[60px] w-[60px] rounded-full bg-gradient-to-br from-pink-300 via-fuchsia-300 to-orange-300" />
          )}
        </div>
        <div className="flex-1 grid grid-cols-3 gap-x-1.5 text-center min-w-0">
          <Stat value={postsCount ?? 0} label="Posts" />
          <Stat value={followersCount ?? 0} label="Followers" />
          <Stat value={followingCount ?? 0} label="Following" />
        </div>
      </div>

      {/* Display name + bio */}
      {(displayName || bio) && (
        <div className="text-[12px] leading-tight mb-3">
          {displayName && <div className="font-semibold">{displayName}</div>}
          {bio && <div className="whitespace-pre-line text-neutral-700">{bio}</div>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 mb-3">
        <FakeBtn className="flex-1">
          Following <ChevronDown className="h-3 w-3 inline-block ml-0.5 -mt-0.5" />
        </FakeBtn>
        <FakeBtn className="flex-1">Message</FakeBtn>
        <FakeBtn className="flex-1">Contact</FakeBtn>
        <FakeBtn className="px-2.5">
          <Plus className="h-3.5 w-3.5" />
        </FakeBtn>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
          {highlights.map((h) => (
            <div key={h.id} className="flex flex-col items-center gap-1 shrink-0 w-[58px]">
              <div className="h-[58px] w-[58px] rounded-full p-[2px] bg-neutral-200">
                {h.cover_url ? (
                  <img src={h.cover_url} alt="" className="h-full w-full rounded-full object-cover bg-white" />
                ) : (
                  <div className="h-full w-full rounded-full bg-neutral-100" />
                )}
              </div>
              <span className="text-[10px] truncate w-full text-center text-neutral-700">{h.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-around border-t border-neutral-200 pt-2.5 -mx-3 px-3 text-neutral-400">
        <Grid3x3 className="h-5 w-5 text-neutral-900" strokeWidth={1.5} />
        <Play className="h-5 w-5" strokeWidth={1.5} />
        <UserSquare2 className="h-5 w-5" strokeWidth={1.5} />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-[13px] leading-tight">{value}</div>
      <div className="text-[10px] text-neutral-600">{label}</div>
    </div>
  );
}

function FakeBtn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-0.5 text-[12px] font-semibold bg-neutral-100 border border-neutral-200 rounded-lg h-[30px] text-center text-neutral-900 ${className}`}
    >
      {children}
    </div>
  );
}
