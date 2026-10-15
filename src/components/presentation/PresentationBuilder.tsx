import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, GripVertical, Trash2, Image as ImageIcon, Type, Smartphone, ListOrdered, Eye, ExternalLink, Copy, Heading, Upload, Play, X, Rocket, History as HistoryIcon, LayoutTemplate, ListChecks, Hash, Grid3x3, RefreshCw, ChevronLeft, ChevronRight, RectangleHorizontal, LayoutGrid, ChevronDown, Calendar, Clock, Check, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FeedTypeBadge from "./FeedTypeBadge";
import { LEMA_LOGO_URL } from "@/lib/brand";
import CanvasEditor, { type CanvasData } from "./blocks/CanvasEditor";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ImageCropper, { processInstagramFile, uploadProcessedImage } from "@/components/ImageCropper";
import { detectMediaType, getFeedItems, getGalleryItems, getPostMediaItems, isLegacyPostMedia, type FeedItem, type FeedItemType, type MediaItem, type PostMediaRow } from "./mediaUtils";
import PresentationView from "./PresentationView";


const MAX_MEDIA_MB = 50;

// Upload direto (sem recorte) pra arquivos que o ImageCropper não processa,
// como vídeo. Usado pelas galerias e pelos posts do planejamento.
async function uploadRawMedia(file: File, folder: string): Promise<{ url: string | null; error: string | null }> {
  if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
    return {
      url: null,
      error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O limite recomendado é ${MAX_MEDIA_MB}MB por arquivo.`,
    };
  }
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
  if (error) {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("exceeded") || msg.includes("too large") || msg.includes("payload") || msg.includes("413")) {
      return { url: null, error: `Arquivo muito grande pro upload. O limite recomendado é ${MAX_MEDIA_MB}MB por arquivo.` };
    }
    return { url: null, error: error.message || "Erro ao enviar arquivo." };
  }
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

type Presentation = {
  id: string;
  project_id: string;
  slug: string;
  status: "rascunho" | "publicado";
  released: boolean;
  client_logo_url: string | null;
  agency_logo_url: string | null;
  hero_title: string | null;
  hero_description: string | null;
  hero_image_url: string | null;
  theme?: any;
};

type Block = {
  id: string;
  presentation_id: string;
  block_type:
    | "cover"
    | "rules"
    | "themes"
    | "feed_overview"
    | "header"
    | "banner"
    | "canvas"
    | "text"
    | "image"
    | "gallery"
    | "instagram_preview"
    | "posts_plan";
  position: number;
  data: any;
};

type Post = {
  id: string;
  presentation_id: string;
  position: number;
  image_url: string | null;
  title: string | null;
  publish_date: string | null;
  publish_time: string | null;
  format_type: string | null;
  copy: string | null;
};

const BLOCK_META = {
  cover: { label: "Capa", icon: LayoutTemplate },
  rules: { label: "Regras / Aprovação", icon: ListChecks },
  themes: { label: "Temas do mês", icon: Hash },
  feed_overview: { label: "Visão geral do feed", icon: Grid3x3 },
  header: { label: "Cabeçalho", icon: Heading },
  banner: { label: "Banner", icon: RectangleHorizontal },
  canvas: { label: "Página livre", icon: LayoutGrid },
  text: { label: "Texto", icon: Type },
  image: { label: "Imagem", icon: ImageIcon },
  gallery: { label: "Galeria", icon: ImageIcon },
  instagram_preview: { label: "Preview Instagram", icon: Smartphone },
  posts_plan: { label: "Planejamento de Posts", icon: ListOrdered },
};

// Níveis fixos da edição, nessa ordem (a Capa vem antes e usa os campos da
// própria apresentação). Outros tipos só existem em apresentações antigas:
// continuam editáveis/renderizáveis, mas não dá pra criar novos.
const FIXED_BLOCK_TYPES = ["instagram_preview", "posts_plan"] as const;
const FIXED_BLOCK_DEFAULTS: Record<(typeof FIXED_BLOCK_TYPES)[number], any> = {
  instagram_preview: { items: [] },
  posts_plan: {},
};

// Visual "painel limpo" da Lema, usado só nos editores dos blocos Preview
// Instagram e Planejamento de Posts.
const LEMA_PANEL = "rounded-2xl bg-[#F6F4EF] text-[#141414] font-['Archivo',ui-sans-serif,system-ui,sans-serif]";
const LEMA_INPUT = "rounded-xl border-black/10 bg-white focus-visible:ring-[#1B1BC7]/30";

const INSTA_LAYOUTS: { value: "feed_only" | "full_profile"; label: string; hint: string }[] = [
  { value: "feed_only", label: "Só feed", hint: "Apenas o grid 3×N" },
  { value: "full_profile", label: "Perfil completo", hint: "Cabeçalho + stories + feed" },
];

const FEED_TYPE_OPTIONS: { value: FeedItemType; label: string; icon: typeof ImageIcon }[] = [
  { value: "photo", label: "Foto", icon: ImageIcon },
  { value: "carousel", label: "Carrossel", icon: Copy },
  { value: "video", label: "Vídeo", icon: Play },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#141414]/55">{children}</p>;
}

// Seletor do tipo do tile do grid (marcação manual da equipe).
function FeedTypeSelect({ value, onChange }: { value: FeedItemType; onChange: (t: FeedItemType) => void }) {
  const current = FEED_TYPE_OPTIONS.find((o) => o.value === value) || FEED_TYPE_OPTIONS[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="min-w-0 inline-flex items-center gap-0.5 rounded-full bg-white/95 shadow-sm pl-1.5 pr-1 h-5 text-[10px] font-semibold text-[#141414]"
          title="Tipo do post"
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{current.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[140px]">
        {FEED_TYPE_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className="text-xs gap-2">
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
            {o.value === value && <Check className="h-3.5 w-3.5 ml-auto text-[#1B1BC7]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

type PresentationVersion = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
  profiles?: { full_name: string | null; nickname?: string | null } | null;
};

export default function PresentationBuilder({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { canEdit, user } = useAuth();
  const { toast } = useToast();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postMedia, setPostMedia] = useState<PostMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function resetForNewCycle() {
    if (!pres) return;
    setResetting(true);

    const igBlock = blocks.find((b) => b.block_type === "instagram_preview");
    const preservedIgData = igBlock
      ? {
          avatar_url: igBlock.data?.avatar_url,
          username: igBlock.data?.username,
          display_name: igBlock.data?.display_name,
          bio: igBlock.data?.bio,
          posts_count: igBlock.data?.posts_count,
          followers_count: igBlock.data?.followers_count,
          following_count: igBlock.data?.following_count,
          highlights: igBlock.data?.highlights || [],
          layout: igBlock.data?.layout,
          items: [],
        }
      : null;

    const postIds = posts.map((p) => p.id);
    if (postIds.length > 0) {
      await supabase.from("presentation_post_media").delete().in("post_id", postIds);
    }
    const { error: postsErr } = await supabase.from("presentation_posts").delete().eq("presentation_id", pres.id);
    const { error: blocksErr } = await supabase.from("presentation_blocks").delete().eq("presentation_id", pres.id);
    if (postsErr || blocksErr) {
      setResetting(false);
      toast({ title: "Erro ao limpar planejamento", description: (postsErr || blocksErr)?.message, variant: "destructive" });
      return;
    }

    await supabase.from("presentation_blocks").insert([
      { presentation_id: pres.id, block_type: "instagram_preview", position: 0, data: preservedIgData || FIXED_BLOCK_DEFAULTS.instagram_preview },
      { presentation_id: pres.id, block_type: "posts_plan", position: 1, data: FIXED_BLOCK_DEFAULTS.posts_plan },
    ]);

    await supabase.from("project_presentations").update({ hero_title: "", hero_description: "" }).eq("id", pres.id);

    setResetting(false);
    setResetOpen(false);
    toast({ title: "Novo ciclo de planejamento criado" });
    loadOrCreate();
  }

  const [launchName, setLaunchName] = useState("");
  const [launching, setLaunching] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<any | null>(null);
  // Contador local de posição por post — evita corrida quando várias mídias
  // são enviadas em sequência antes do estado `postMedia` (React) atualizar.
  const nextPostMediaPosition = useRef<Record<string, number>>({});

  useEffect(() => {
    loadOrCreate();
  }, [projectId]);

  async function loadOrCreate() {
    setLoading(true);
    const { data: existing } = await supabase
      .from("project_presentations")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    // Logo do cliente vem do cadastro da empresa (projects.company_id →
    // companies.logo_url) e o da Lema é fixo — não há mais upload manual.
    let companyLogo: string | null = null;
    if (canEdit) {
      const { data: proj } = await supabase.from("projects").select("company_id").eq("id", projectId).maybeSingle();
      if (proj?.company_id) {
        const { data: company } = await supabase.from("companies").select("logo_url").eq("id", proj.company_id).maybeSingle();
        companyLogo = company?.logo_url || null;
      }
    }

    let p: Presentation | null = existing as any;
    if (p && canEdit) {
      // Apresentações já existentes: sincroniza os logos com o cadastro.
      // Se a empresa não tiver logo, mantém o que já estava salvo.
      const logoPatch: Partial<Presentation> = {};
      if (companyLogo && p.client_logo_url !== companyLogo) logoPatch.client_logo_url = companyLogo;
      if (p.agency_logo_url !== LEMA_LOGO_URL) logoPatch.agency_logo_url = LEMA_LOGO_URL;
      if (Object.keys(logoPatch).length > 0) {
        const { error } = await supabase.from("project_presentations").update(logoPatch).eq("id", p.id);
        if (!error) p = { ...p, ...logoPatch };
      }
    }
    if (!p && canEdit) {
      const baseSlug = slugify(projectName) || projectId.slice(0, 8);
      const slug = `${baseSlug}-${projectId.slice(0, 6)}`;
      const { data: created, error } = await supabase
        .from("project_presentations")
        .insert({
          project_id: projectId,
          slug,
          hero_title: projectName,
          client_logo_url: companyLogo,
          agency_logo_url: LEMA_LOGO_URL,
        })
        .select("*")
        .single();
      if (error) {
        console.error(error);
        toast({ title: "Erro ao criar apresentação", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      p = created as any;
    }
    setPres(p);

    if (p) {
      const [{ data: b }, { data: po }] = await Promise.all([
        supabase.from("presentation_blocks").select("*").eq("presentation_id", p.id).order("position"),
        supabase.from("presentation_posts").select("*").eq("presentation_id", p.id).order("position"),
      ]);
      setBlocks(canEdit ? await ensureFixedBlocks(p.id, (b || []) as any) : ((b || []) as any));
      const postList = (po || []) as Post[];
      setPosts(postList);
      const postIds = postList.map((x) => x.id);
      if (postIds.length > 0) {
        const { data: pm } = await supabase
          .from("presentation_post_media")
          .select("*")
          .in("post_id", postIds)
          .order("position");
        setPostMedia((pm || []) as any);
      } else {
        setPostMedia([]);
      }
      nextPostMediaPosition.current = {};
      loadVersions(p.id);
    }
    setLoading(false);
  }

  // A edição tem 3 níveis fixos: Capa (campos da própria apresentação),
  // Preview Instagram e Planejamento de Posts. Cria os blocos que faltarem —
  // apresentação nova ou antiga sem eles — no fim da lista.
  async function ensureFixedBlocks(presentationId: string, existing: Block[]): Promise<Block[]> {
    const missing = FIXED_BLOCK_TYPES.filter((t) => !existing.some((b) => b.block_type === t));
    if (missing.length === 0) return existing;
    const nextPosition = existing.reduce((max, b) => Math.max(max, b.position + 1), 0);
    const { data, error } = await supabase
      .from("presentation_blocks")
      .insert(missing.map((t, i) => ({ presentation_id: presentationId, block_type: t, position: nextPosition + i, data: FIXED_BLOCK_DEFAULTS[t] })))
      .select("*");
    if (error) {
      toast({ title: "Erro ao preparar a apresentação", description: error.message, variant: "destructive" });
      return existing;
    }
    return [...existing, ...((data || []) as any)];
  }

  async function loadVersions(presentationId: string) {
    const { data } = await supabase
      .from("presentation_versions")
      .select("id, name, created_at, created_by, profiles:created_by(full_name, nickname)")
      .eq("presentation_id", presentationId)
      .order("created_at", { ascending: false });
    setVersions((data || []) as any);
  }

  async function launchVersion() {
    if (!pres || !launchName.trim()) return;
    setLaunching(true);

    // Publica + libera a apresentação pro cliente (se ainda não estiver).
    // Antes isso dependia de dois toggles manuais que podiam "parecer"
    // salvos na tela sem terem sido gravados de fato — agora é parte do
    // mesmo ato de lançar, e qualquer erro é mostrado, não escondido.
    if (pres.status !== "publicado" || !pres.released) {
      const { error: presError } = await supabase
        .from("project_presentations")
        .update({ status: "publicado", released: true })
        .eq("id", pres.id);
      if (presError) {
        setLaunching(false);
        toast({ title: "Erro ao publicar apresentação", description: presError.message, variant: "destructive" });
        return;
      }
      setPres((prev) => (prev ? { ...prev, status: "publicado", released: true } : prev));
    }

    const snapshot = {
      pres: {
        id: pres.id,
        slug: pres.slug,
        status: "publicado",
        released: true,
        client_logo_url: pres.client_logo_url,
        agency_logo_url: pres.agency_logo_url,
        hero_title: pres.hero_title,
        hero_description: pres.hero_description,
        hero_image_url: pres.hero_image_url,
      },
      blocks,
      posts,
      postMedia,
    };
    const { error } = await supabase.from("presentation_versions").insert({
      presentation_id: pres.id,
      name: launchName.trim(),
      snapshot,
      visible_to_client: true,
      created_by: user?.id,
    });
    setLaunching(false);
    if (error) {
      toast({ title: "Erro ao lançar versão", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Versão lançada e liberada para o cliente" });
    setLaunchOpen(false);
    setLaunchName("");
    loadVersions(pres.id);
  }

  async function openVersionPreview(versionId: string) {
    const { data } = await supabase.from("presentation_versions").select("snapshot").eq("id", versionId).maybeSingle();
    if (data?.snapshot) setPreviewSnapshot(data.snapshot);
  }

  // Persist presentation
  async function patchPres(patch: Partial<Presentation>) {
    if (!pres) return;
    const previous = pres;
    const next = { ...pres, ...patch };
    setPres(next);
    const { error } = await supabase.from("project_presentations").update(patch).eq("id", pres.id);
    if (error) {
      setPres(previous);
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    }
  }

  async function patchBlock(id: string, data: any) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)));
    await supabase.from("presentation_blocks").update({ data }).eq("id", id);
  }

  async function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("presentation_blocks").delete().eq("id", id);
  }

  // Um único DragDropContext cobre as listas reordenáveis dentro dos blocos
  // (grid do Instagram, itens da Galeria, mídia de cada post) — a ordem dos
  // blocos em si é fixa. O droppableId de origem decide qual lista mudou.
  async function reorderPostMedia(postId: string, fromIndex: number, toIndex: number) {
    const items = getPostMediaItems(
      posts.find((p) => p.id === postId) || { id: postId, image_url: null },
      postMedia,
    ).filter((m) => !isLegacyPostMedia(m.id));
    if (items.length === 0 || fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withPositions = reordered.map((m, idx) => ({ ...m, position: idx }));
    setPostMedia((prev) => prev.map((m) => withPositions.find((u) => u.id === m.id) || m));
    await Promise.all(
      withPositions.map((m) => supabase.from("presentation_post_media").update({ position: m.position }).eq("id", m.id)),
    );
  }

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const { droppableId } = r.source;

    if (droppableId.startsWith("gallery-items:")) {
      const blockId = droppableId.slice("gallery-items:".length);
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const items = getGalleryItems(block.data);
      const reordered = Array.from(items);
      const [moved] = reordered.splice(r.source.index, 1);
      reordered.splice(r.destination.index, 0, moved);
      const { images: _legacy, ...rest } = block.data;
      await patchBlock(blockId, { ...rest, items: reordered });
      return;
    }

    if (droppableId.startsWith("feed-items:")) {
      const blockId = droppableId.slice("feed-items:".length);
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const reordered = Array.from(getFeedItems(block.data));
      const [moved] = reordered.splice(r.source.index, 1);
      reordered.splice(r.destination.index, 0, moved);
      const { images: _legacy, ...rest } = block.data;
      await patchBlock(blockId, { ...rest, items: reordered });
      return;
    }

    if (droppableId.startsWith("post-media:")) {
      const postId = droppableId.slice("post-media:".length);
      await reorderPostMedia(postId, r.source.index, r.destination.index);
      return;
    }
  }

  // Posts CRUD
  async function addPost() {
    if (!pres) return;
    const { data, error } = await supabase
      .from("presentation_posts")
      .insert({ presentation_id: pres.id, position: posts.length, title: "Novo post" })
      .select("*").single();
    if (error) return;
    setPosts((p) => [...p, data as any]);
  }
  async function patchPost(id: string, patch: Partial<Post>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from("presentation_posts").update(patch).eq("id", id);
  }
  async function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setPostMedia((prev) => prev.filter((m) => m.post_id !== id));
    delete nextPostMediaPosition.current[id];
    await supabase.from("presentation_posts").delete().eq("id", id);
  }

  async function addPostMedia(postId: string, url: string, type: "image" | "video") {
    if (nextPostMediaPosition.current[postId] === undefined) {
      nextPostMediaPosition.current[postId] = postMedia.filter((m) => m.post_id === postId).length;
    }
    const position = nextPostMediaPosition.current[postId]++;
    const { data, error } = await supabase
      .from("presentation_post_media")
      .insert({ post_id: postId, media_url: url, media_type: type, position })
      .select("*").single();
    if (error) {
      toast({ title: "Erro ao salvar mídia", description: error.message, variant: "destructive" });
      return;
    }
    setPostMedia((prev) => [...prev, data as any]);
  }

  async function removePostMedia(mediaId: string) {
    setPostMedia((prev) => prev.filter((m) => m.id !== mediaId));
    await supabase.from("presentation_post_media").delete().eq("id", mediaId);
  }

  const publicUrl = pres ? `${window.location.origin}/c/${pres.slug}` : "";
  const internalPreviewUrl = `${window.location.origin}/projetos/${projectId}/apresentacao/preview`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copiado!" });
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando apresentação...</div>;
  if (!pres) return <div className="text-center py-12 text-muted-foreground">Sem permissão para criar apresentação.</div>;

  const canShowLink = pres.status === "publicado" && pres.released;

  // Primeiro bloco de cada tipo fixo; o resto (tipos antigos ou duplicados)
  // fica na seção "Páginas antigas".
  const igBlock = blocks.find((b) => b.block_type === "instagram_preview");
  const postsBlock = blocks.find((b) => b.block_type === "posts_plan");
  const legacyBlocks = blocks.filter((b) => b !== igBlock && b !== postsBlock);

  function renderBlockEditor(b: Block) {
    return (
      <BlockEditor
        block={b}
        onChange={(d: any) => patchBlock(b.id, d)}
        posts={posts}
        postMedia={postMedia}
        onAddPost={addPost}
        onPatchPost={patchPost}
        onRemovePost={removePost}
        onAddPostMedia={addPostMedia}
        onRemovePostMedia={removePostMedia}
        onReorderPostMedia={reorderPostMedia}
        disabled={!canEdit}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Status</Label>
            <Badge variant={canShowLink ? "default" : "secondary"}>
              {canShowLink ? "Publicado" : "Rascunho (ainda não lançado)"}
            </Badge>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setLaunchOpen(true)}>
              <Rocket className="h-4 w-4 mr-1.5" /> Lançar e Salvar
            </Button>
          )}
          {canEdit && canShowLink && (
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Gerar novo planejamento
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground max-w-[320px] leading-snug">
            "Lançar e Salvar" publica esta versão e libera o acesso do cliente imediatamente.{" "}
            Depois, use a aba <strong className="font-medium">Apresentação</strong> pra bloquear
            o acesso a uma versão específica, editar ou excluir um lançamento.
          </p>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => window.open(internalPreviewUrl, "_blank")}>
            <Eye className="h-4 w-4 mr-1.5" /> Pré-visualizar (equipe)
          </Button>
          {canShowLink && (
            <Button variant="default" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1.5" /> Copiar link público
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Níveis fixos da edição — ordem fixa, sem adicionar/remover/reordenar */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-3">
          <FixedLevelCard step={1} label="Capa" icon={LayoutTemplate}>
            <CoverEditor pres={pres} onPatch={patchPres} disabled={!canEdit} hasLegacyCover={legacyBlocks.some((b) => b.block_type === "cover")} />
          </FixedLevelCard>
          {igBlock && (
            <FixedLevelCard step={2} label={BLOCK_META.instagram_preview.label} icon={BLOCK_META.instagram_preview.icon}>
              {renderBlockEditor(igBlock)}
            </FixedLevelCard>
          )}
          {postsBlock && (
            <FixedLevelCard step={3} label={BLOCK_META.posts_plan.label} icon={BLOCK_META.posts_plan.icon}>
              {renderBlockEditor(postsBlock)}
            </FixedLevelCard>
          )}

          {legacyBlocks.length > 0 && (
            <>
              <div className="pt-4">
                <p className="text-sm font-medium">Páginas antigas</p>
                <p className="text-[11px] text-muted-foreground">
                  Páginas criadas no formato anterior desta apresentação. Continuam aparecendo pro cliente e podem ser
                  editadas ou removidas, mas não é mais possível criar novas.
                </p>
              </div>
              {legacyBlocks.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary">{BLOCK_META[b.block_type]?.label || b.block_type}</Badge>
                      <div className="flex-1" />
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(b.id)} title="Remover página antiga">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {renderBlockEditor(b)}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </DragDropContext>

      {/* Histórico de lançamentos */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            <p className="text-sm font-medium">Histórico de lançamentos</p>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum lançamento ainda</p>
          ) : (
            <div className="space-y-1.5">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-sm border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      {" · "}
                      {v.profiles?.nickname?.trim() || v.profiles?.full_name || "Alguém"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openVersionPreview(v.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: nomear e lançar versão */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar nova versão</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nome deste lançamento</Label>
            <Input value={launchName} onChange={(e) => setLaunchName(e.target.value)} placeholder="Ex: Julho 2026 v2" />
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5 leading-snug">
            Assim que você clicar em "Lançar", o cliente terá acesso imediato a esta versão.
            Pra bloquear o acesso depois, use a aba Apresentação.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchOpen(false)}>Cancelar</Button>
            <Button onClick={launchVersion} disabled={!launchName.trim() || launching}>
              {launching ? "Lançando..." : "Lançar e liberar pro cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar reset pra novo ciclo de planejamento */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar novo planejamento?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Isso vai limpar o conteúdo deste rascunho pra começar um novo ciclo:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Capa, temas, regras, galeria, imagens e planejamento de posts são apagados.</li>
              <li>Logo do cliente, logo da agência e os dados do Instagram (@, bio, avatar, números, destaques) são mantidos.</li>
            </ul>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5 leading-snug">
              As versões já lançadas (visíveis na aba Apresentação) não são afetadas — isso só limpa o rascunho atual em edição.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button onClick={resetForNewCycle} disabled={resetting} variant="destructive">
              {resetting ? "Limpando..." : "Limpar e começar novo ciclo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: prévia read-only de uma versão lançada */}
      <Dialog open={!!previewSnapshot} onOpenChange={(open) => !open && setPreviewSnapshot(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-hide p-0">
          {previewSnapshot && (
            <PresentationView
              pres={previewSnapshot.pres}
              blocks={previewSnapshot.blocks}
              posts={previewSnapshot.posts}
              postMedia={previewSnapshot.postMedia}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Cartão de um nível fixo da edição: sem arrastar e sem excluir.
function FixedLevelCard({ step, label, icon: Icon, children }: { step: number; label: string; icon: typeof ImageIcon; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">{step}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function LogoPreview({ label, caption, url }: { label: string; caption: string; url: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {url ? (
        <img src={url} alt={label} className="h-12 w-20 object-contain border rounded bg-muted p-1.5" />
      ) : (
        <div className="h-12 w-20 border border-dashed rounded flex items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{url ? caption : "Empresa sem logo no cadastro"}</p>
      </div>
    </div>
  );
}

// Capa: sempre o primeiro nível. Edita os campos da própria apresentação
// (renderizados pelo HeroSlide); os logos são automáticos e só leitura.
function CoverEditor({
  pres,
  onPatch,
  disabled,
  hasLegacyCover,
}: {
  pres: Presentation;
  onPatch: (patch: Partial<Presentation>) => void;
  disabled?: boolean;
  hasLegacyCover?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LogoPreview label="Logo do cliente" caption="do cadastro da empresa" url={pres.client_logo_url} />
      <LogoPreview label="Logo da agência" caption="Lema" url={pres.agency_logo_url || LEMA_LOGO_URL} />
      {hasLegacyCover && (
        <p className="md:col-span-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5 leading-snug">
          Esta apresentação ainda tem uma capa no formato antigo (em "Páginas antigas", abaixo), que é a que aparece
          pro cliente. Remova-a pra usar esta capa.
        </p>
      )}
      <div className="md:col-span-2 space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input value={pres.hero_title || ""} onChange={(e) => onPatch({ hero_title: e.target.value })} disabled={disabled} />
        <p className="text-[10px] text-muted-foreground text-right">{(pres.hero_title || "").length}/60 recomendado</p>
      </div>
      <div className="md:col-span-2 space-y-1.5">
        <Label className="text-xs">Descrição da campanha</Label>
        <Textarea value={pres.hero_description || ""} onChange={(e) => onPatch({ hero_description: e.target.value })} disabled={disabled} rows={3} />
        <p className="text-[10px] text-muted-foreground text-right">{(pres.hero_description || "").length}/200 recomendado</p>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs">Banner de capa (opcional)</Label>
        <p className="text-[10px] text-muted-foreground mb-1">Se enviar uma imagem aqui, a capa da apresentação vira um banner em tela cheia com o título/descrição por cima, em vez do fundo liso padrão.</p>
        <BackgroundImageField value={pres.hero_image_url} onChange={(url) => onPatch({ hero_image_url: url })} disabled={disabled} />
      </div>
    </div>
  );
}

function BackgroundImageField({ value, onChange, disabled }: { value: string | null; onChange: (url: string | null) => void; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useRef(`bg-${crypto.randomUUID()}`).current;
  const { toast } = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const { url, error } = await uploadRawMedia(file, "presentations/backgrounds");
    setUploading(false);
    if (error) {
      toast({ title: "Erro ao enviar imagem", description: error, variant: "destructive" });
      return;
    }
    if (url) onChange(url);
  }

  return (
    <div className="pt-2 mt-2 border-t space-y-1.5">
      <Label className="text-xs text-muted-foreground">Imagem de fundo da página (opcional)</Label>
      {value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt="" className="h-12 w-20 object-cover rounded border" />
          {!disabled && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onChange(null)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      ) : (
        !disabled && (
          <label className="cursor-pointer inline-block">
            <Input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <span><ImageIcon className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Enviando..." : "Adicionar imagem de fundo"}</span>
            </Button>
          </label>
        )
      )}
    </div>
  );
}

function BlockEditor({ block, onChange, posts, postMedia, onAddPost, onPatchPost, onRemovePost, onAddPostMedia, onRemovePostMedia, onReorderPostMedia, disabled }: any) {
  const { toast } = useToast();
  const [queue, setQueue] = useState<File[]>([]);
  const [current, setCurrent] = useState<File | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setQueue(files.slice(1));
    setCurrent(files[0]);
  }

  // Bloco Galeria: separa vídeos (upload direto, sem recorte) de imagens
  // (seguem pra fila de recorte existente).
  async function handleGalleryFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const videos = files.filter((f) => detectMediaType(f.name) === "video");
    const images = files.filter((f) => detectMediaType(f.name) !== "video");

    if (videos.length > 0) {
      setUploadingGallery(true);
      // Acumula localmente: cada onChange dispara um patchBlock no pai, mas
      // como isso é um loop síncrono não dá tempo do prop `block` atualizar
      // entre uma volta e outra — sem isso, só o último vídeo sobreviveria.
      let accItems = getGalleryItems(block.data);
      for (const file of videos) {
        const { url, error } = await uploadRawMedia(file, "presentations/media");
        if (error) {
          toast({ title: "Erro ao enviar vídeo", description: error, variant: "destructive" });
          continue;
        }
        if (url) {
          accItems = [...accItems, { url, type: "video" as const }];
          const { images: _legacy, ...rest } = block.data;
          onChange({ ...rest, items: accItems });
        }
      }
      setUploadingGallery(false);
    }
    if (images.length > 0) {
      setQueue(images.slice(1));
      setCurrent(images[0]);
    }
  }

  // Grid do Instagram: grava sempre no formato novo `items` (descarta o
  // `images` legado, que já foi convertido por getFeedItems).
  function setFeedItems(items: FeedItem[]) {
    const { images: _legacy, ...rest } = block.data;
    onChange({ ...rest, items });
  }

  // Mesmo padrão de handleGalleryFiles: vídeo sobe direto, imagem vai pra
  // fila de recorte.
  async function handleFeedFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const videos = files.filter((f) => detectMediaType(f.name) === "video");
    const images = files.filter((f) => detectMediaType(f.name) !== "video");

    if (videos.length > 0) {
      setUploadingGallery(true);
      let accItems = getFeedItems(block.data);
      for (const file of videos) {
        const { url, error } = await uploadRawMedia(file, "presentations/media");
        if (error) {
          toast({ title: "Erro ao enviar vídeo", description: error, variant: "destructive" });
          continue;
        }
        if (url) {
          accItems = [...accItems, { url, type: "video" as const }];
          setFeedItems(accItems);
        }
      }
      setUploadingGallery(false);
    }
    if (images.length > 0) {
      setQueue(images.slice(1));
      setCurrent(images[0]);
    }
  }

  function handleCropped(url: string, isMulti: boolean) {
    if (isInsta) {
      setFeedItems([...getFeedItems(block.data), { url, type: "photo" }]);
    } else if (isGallery) {
      const items = getGalleryItems(block.data);
      const { images: _legacy, ...rest } = block.data;
      onChange({ ...rest, items: [...items, { url, type: "image" as const }] });
    } else if (isMulti) {
      onChange({ ...block.data, images: [...(block.data.images || []), url] });
    } else {
      onChange({ ...block.data, url });
    }
    // Next file
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
    } else {
      setCurrent(null);
    }
  }

  async function handleApplyToRemaining(mode: string) {
    const filesToProcess = [current, ...queue].filter((f): f is File => !!f);
    setQueue([]);
    setCurrent(null);
    const newUrls: string[] = [];
    for (const f of filesToProcess) {
      try {
        const blob = await processInstagramFile(f, mode);
        const url = await uploadProcessedImage(blob, `presentations/media/${crypto.randomUUID()}.png`);
        newUrls.push(url);
      } catch (err) {
        console.error("Falha ao processar imagem em lote", err);
      }
    }
    if (newUrls.length > 0) {
      if (isInsta) {
        setFeedItems([...getFeedItems(block.data), ...newUrls.map((url) => ({ url, type: "photo" as const }))]);
      } else {
        onChange({ ...block.data, images: [...(block.data.images || []), ...newUrls] });
      }
    }
  }

  function cancelCrop() {
    setCurrent(null);
    setQueue([]);
  }

  // Determine aspect for each block type
  const isInsta = block.block_type === "instagram_preview";
  const isGallery = block.block_type === "gallery";
  const isFeedOverview = block.block_type === "feed_overview";
  const isSingleImage = block.block_type === "image";
  const aspect: number | "free" | "choice" = isInsta || isFeedOverview ? 1 : isGallery ? 1 : "choice";
  const isMulti = isGallery || isInsta || isFeedOverview;

  if (block.block_type === "cover") {
    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input placeholder="Tagline (#tudo começa pelo seu lema.)" value={block.data.tagline || ""} onChange={(e) => onChange({ ...block.data, tagline: e.target.value })} disabled={disabled} />
          <Input placeholder="Rótulo (PLANEJAMENTO)" value={block.data.label || ""} onChange={(e) => onChange({ ...block.data, label: e.target.value })} disabled={disabled} />
          <Input placeholder="Mês (ex.: OUTUBRO)" value={block.data.month || ""} onChange={(e) => onChange({ ...block.data, month: e.target.value })} disabled={disabled} />
          <Input placeholder="Ano" value={block.data.year || ""} onChange={(e) => onChange({ ...block.data, year: e.target.value })} disabled={disabled} />
        </div>
        <BackgroundImageField
          value={block.data.background_image_url || null}
          onChange={(url) => onChange({ ...block.data, background_image_url: url })}
          disabled={disabled}
        />
      </div>
    );
  }
  if (block.block_type === "rules" || block.block_type === "themes") {
    const items: string[] = block.data.items || [];
    const isThemes = block.block_type === "themes";
    return (
      <div className="space-y-2">
        {isThemes && (
          <Input placeholder="Título do slide" value={block.data.title || ""} onChange={(e) => onChange({ ...block.data, title: e.target.value })} disabled={disabled} />
        )}
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-xs text-muted-foreground pt-2.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <Textarea
              value={it}
              rows={2}
              placeholder={isThemes ? "Tema" : "Regra / instrução"}
              onChange={(e) => onChange({ ...block.data, items: items.map((x, j) => (j === i ? e.target.value : x)) })}
              disabled={disabled}
            />
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange({ ...block.data, items: items.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={() => onChange({ ...block.data, items: [...items, ""] })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar item
          </Button>
        )}
        <BackgroundImageField
          value={block.data.background_image_url || null}
          onChange={(url) => onChange({ ...block.data, background_image_url: url })}
          disabled={disabled}
        />
      </div>
    );
  }
  if (isFeedOverview) {
    const images: string[] = block.data.images || [];
    return (
      <div className="space-y-2">
        <Input placeholder="Título" value={block.data.title || ""} onChange={(e) => onChange({ ...block.data, title: e.target.value })} disabled={disabled} />
        <Input placeholder="Subtítulo" value={block.data.subtitle || ""} onChange={(e) => onChange({ ...block.data, subtitle: e.target.value })} disabled={disabled} />
        <div className="grid gap-2 grid-cols-3 max-w-xs">
          {images.map((url, i) => (
            <div key={i} className="relative aspect-square">
              <img src={url} alt="" className="w-full h-full object-cover rounded border" />
              {!disabled && (
                <button
                  onClick={() => onChange({ ...block.data, images: images.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 bg-background/80 rounded p-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!disabled && (
          <label className="cursor-pointer inline-block">
            <Input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />Enviar imagens</span></Button>
          </label>
        )}
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, true)}
            aspect={1}
            instagramFit
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
        <BackgroundImageField
          value={block.data.background_image_url || null}
          onChange={(url) => onChange({ ...block.data, background_image_url: url })}
          disabled={disabled}
        />
      </div>
    );
  }
  if (block.block_type === "banner") {
    return (
      <div className="space-y-2">
        {block.data.url ? (
          <div className="relative">
            <img src={block.data.url} alt="" className="w-full max-h-64 object-cover rounded border" />
            {!disabled && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 text-xs h-7"
                onClick={() => onChange({ ...block.data, url: "" })}
              >
                Trocar imagem
              </Button>
            )}
          </div>
        ) : (
          <div className="h-40 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-sm">
            Nenhuma imagem — o banner ocupa a página inteira
          </div>
        )}
        {!disabled && !block.data.url && (
          <label className="cursor-pointer inline-block">
            <Input type="file" accept="image/*" className="hidden" onChange={handleFiles} />
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />Enviar imagem do banner</span></Button>
          </label>
        )}
        <Input placeholder="Título (opcional, aparece sobre a imagem)" value={block.data.title || ""} onChange={(e) => onChange({ ...block.data, title: e.target.value })} disabled={disabled} />
        <Input placeholder="Subtítulo (opcional)" value={block.data.subtitle || ""} onChange={(e) => onChange({ ...block.data, subtitle: e.target.value })} disabled={disabled} />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Posição do texto:</Label>
          <ToggleGroup
            type="single"
            value={block.data.text_position || "bottom"}
            onValueChange={(v) => v && onChange({ ...block.data, text_position: v })}
            size="sm"
          >
            <ToggleGroupItem value="top" className="text-xs h-7 px-2">Topo</ToggleGroupItem>
            <ToggleGroupItem value="center" className="text-xs h-7 px-2">Centro</ToggleGroupItem>
            <ToggleGroupItem value="bottom" className="text-xs h-7 px-2">Base</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, false)}
            aspect="free"
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (block.block_type === "canvas") {
    return (
      <CanvasEditor
        data={block.data as CanvasData}
        onChange={(d) => onChange(d)}
        disabled={disabled}
      />
    );
  }
  if (block.block_type === "header") {
    return (
      <div className="space-y-2">
        <Input placeholder="Título" value={block.data.title || ""} onChange={(e) => onChange({ ...block.data, title: e.target.value })} disabled={disabled} />
        <Input placeholder="Subtítulo" value={block.data.subtitle || ""} onChange={(e) => onChange({ ...block.data, subtitle: e.target.value })} disabled={disabled} />
        <BackgroundImageField
          value={block.data.background_image_url || null}
          onChange={(url) => onChange({ ...block.data, background_image_url: url })}
          disabled={disabled}
        />
      </div>
    );
  }

  if (block.block_type === "text") {
    return (
      <div>
        <Textarea placeholder="Escreva aqui..." value={block.data.content || ""} onChange={(e) => onChange({ ...block.data, content: e.target.value })} rows={6} disabled={disabled} />
        <BackgroundImageField
          value={block.data.background_image_url || null}
          onChange={(url) => onChange({ ...block.data, background_image_url: url })}
          disabled={disabled}
        />
      </div>
    );
  }
  if (isSingleImage) {
    return (
      <div className="space-y-2">
        {block.data.url ? (
          <img src={block.data.url} alt="" className="max-h-64 rounded border" />
        ) : (
          <div className="h-40 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">Nenhuma imagem</div>
        )}
        {!disabled && (
          <label className="cursor-pointer inline-block">
            <Input type="file" accept="image/*" className="hidden" onChange={handleFiles} />
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />Enviar e recortar</span></Button>
          </label>
        )}
        <Input placeholder="Legenda" value={block.data.caption || ""} onChange={(e) => onChange({ ...block.data, caption: e.target.value })} disabled={disabled} />
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, false)}
            aspect={aspect}
            instagramFit
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (isInsta) {
    const feedItems = getFeedItems(block.data);
    const layout: "feed_only" | "full_profile" = block.data.layout || "feed_only";
    const highlights: { id: string; title: string; cover_url: string }[] = block.data.highlights || [];
    const activeLayout = INSTA_LAYOUTS.find((l) => l.value === layout) || INSTA_LAYOUTS[0];

    function moveFeedItem(from: number, to: number) {
      if (to < 0 || to >= feedItems.length) return;
      const reordered = Array.from(feedItems);
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      setFeedItems(reordered);
    }

    return (
      <div className={cn(LEMA_PANEL, "p-4 md:p-5 space-y-6")}>
        <div className="space-y-2">
          <FieldLabel>Formato da apresentação</FieldLabel>
          <div className="inline-flex rounded-full bg-black/[0.06] p-1" role="radiogroup">
            {INSTA_LAYOUTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={layout === opt.value}
                disabled={disabled}
                onClick={() => onChange({ ...block.data, layout: opt.value })}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                  layout === opt.value ? "bg-[#1B1BC7] text-white shadow-sm" : "text-[#141414]/60 hover:text-[#141414]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#141414]/55">{activeLayout.hint}</p>
        </div>

        {layout === "full_profile" && (
          <ProfileFieldsEditor block={block} onChange={onChange} disabled={disabled} highlights={highlights} />
        )}

        <div className="space-y-2">
          <FieldLabel>Feed</FieldLabel>
          <p className="text-[11px] text-[#141414]/55 leading-snug">
            Arraste os tiles pra reordenar e marque cada post como foto, carrossel ou vídeo. Imagens podem ser
            formatadas sem cortar (recomendado 1:1); vídeos sobem direto, até {MAX_MEDIA_MB}MB por arquivo.
          </p>
          <Droppable droppableId={`feed-items:${block.id}`} direction="horizontal" isDropDisabled={disabled}>
            {(dprov) => (
              <div ref={dprov.innerRef} {...dprov.droppableProps} className="grid gap-2 grid-cols-3 max-w-sm">
                {feedItems.map((item, i) => (
                  <Draggable key={`feed-item:${block.id}:${i}`} draggableId={`feed-item:${block.id}:${i}`} index={i} isDragDisabled={disabled}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className={cn(
                          "group relative aspect-square rounded-xl overflow-hidden bg-black/5",
                          !disabled && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        {detectMediaType(item.url) === "video" ? (
                          <video src={item.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                        ) : (
                          <img src={item.url} alt="" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute top-1.5 left-1.5 h-5 min-w-5 px-1 rounded-full bg-white/95 text-[#141414] text-[10px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
                          {i + 1}
                        </span>
                        <FeedTypeBadge type={item.type} className={cn(!disabled && "transition-opacity group-hover:opacity-0")} />
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => setFeedItems(feedItems.filter((_, j) => j !== i))}
                            className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-white/95 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {!disabled && (
                          <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => moveFeedItem(i, i - 1)}
                              disabled={i === 0}
                              className="h-5 w-5 shrink-0 rounded-full bg-white/95 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:!opacity-0"
                              title="Mover pra esquerda"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <FeedTypeSelect
                              value={item.type}
                              onChange={(type) => setFeedItems(feedItems.map((it, j) => (j === i ? { ...it, type } : it)))}
                            />
                            <button
                              type="button"
                              onClick={() => moveFeedItem(i, i + 1)}
                              disabled={i === feedItems.length - 1}
                              className="h-5 w-5 shrink-0 rounded-full bg-white/95 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:!opacity-0"
                              title="Mover pra direita"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {dprov.placeholder}
                {!disabled && (
                  <label
                    className={cn(
                      "aspect-square rounded-xl border-2 border-dashed border-[#1B1BC7]/30 text-[#1B1BC7] flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#1B1BC7]/5 hover:border-[#1B1BC7]/60 transition-colors",
                      uploadingGallery && "pointer-events-none opacity-60",
                    )}
                    title="Adicionar imagens ou vídeos do feed"
                  >
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFeedFiles} disabled={uploadingGallery} />
                    {uploadingGallery ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {uploadingGallery ? "Enviando" : "Adicionar"}
                    </span>
                  </label>
                )}
              </div>
            )}
          </Droppable>
        </div>
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, true)}
            aspect={aspect}
            instagramFit
            remainingCount={queue.length}
            onApplyToRemaining={handleApplyToRemaining}
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (isGallery) {
    const items: MediaItem[] = getGalleryItems(block.data);
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Imagens são recortadas em 1:1 para um layout consistente; vídeos não são recortados automaticamente, envie já no formato desejado.
        </p>
        <Droppable droppableId={`gallery-items:${block.id}`} direction="horizontal" isDropDisabled={disabled}>
          {(dprov) => (
            <div ref={dprov.innerRef} {...dprov.droppableProps} className="grid gap-2 grid-cols-3 sm:grid-cols-4">
              {items.map((item, i) => (
                <Draggable key={`gallery-item:${block.id}:${i}`} draggableId={`gallery-item:${block.id}:${i}`} index={i} isDragDisabled={disabled}>
                  {(p) => (
                    <div ref={p.innerRef} {...p.draggableProps} className="relative aspect-square">
                      {item.type === "video" ? (
                        <video src={item.url} muted loop autoPlay playsInline className="w-full h-full object-cover rounded border" />
                      ) : (
                        <img src={item.url} alt="" className="w-full h-full object-cover rounded border" />
                      )}
                      {item.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Play className="h-6 w-6 text-white drop-shadow" fill="white" />
                        </div>
                      )}
                      {!disabled && (
                        <div
                          {...p.dragHandleProps}
                          className="absolute top-1 left-1 h-5 w-5 rounded bg-background/80 flex items-center justify-center cursor-grab"
                          title="Arrastar para reordenar"
                        >
                          <GripVertical className="h-3 w-3" />
                        </div>
                      )}
                      {!disabled && (
                        <button
                          onClick={() => {
                            const { images: _legacy, ...rest } = block.data;
                            onChange({ ...rest, items: items.filter((_, j) => j !== i) });
                          }}
                          className="absolute top-1 right-1 bg-background/80 rounded p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {dprov.placeholder}
            </div>
          )}
        </Droppable>
        {!disabled && (
          <>
            <label className="cursor-pointer inline-block">
              <Input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleGalleryFiles} disabled={uploadingGallery} />
              <Button asChild variant="outline" size="sm" disabled={uploadingGallery}>
                <span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploadingGallery ? "Enviando vídeo..." : "Adicionar mídia"}</span>
              </Button>
            </label>
            <p className="text-[10px] text-muted-foreground">
              Vídeos grandes podem demorar pra carregar — recomendado até {MAX_MEDIA_MB}MB por arquivo.
            </p>
          </>
        )}
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, true)}
            aspect={aspect}
            instagramFit
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (block.block_type === "posts_plan") {
    return (
      <div className={cn(LEMA_PANEL, "p-4 md:p-5 space-y-4")}>
        <div className="space-y-3">
          {posts.length === 0 && <p className="text-xs text-[#141414]/55">Nenhum post planejado ainda.</p>}
          {posts.map((p: Post) => (
            <PostEditor
              key={p.id}
              post={p}
              media={(postMedia as PostMediaRow[]).filter((m) => m.post_id === p.id)}
              onPatch={(patch) => onPatchPost(p.id, patch)}
              onRemove={() => onRemovePost(p.id)}
              onAddMedia={onAddPostMedia}
              onRemoveMedia={onRemovePostMedia}
              onReorderMedia={(from: number, to: number) => onReorderPostMedia(p.id, from, to)}
              disabled={disabled}
            />
          ))}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onAddPost}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#1B1BC7] px-4 py-2 text-sm font-semibold text-[#1B1BC7] hover:bg-[#1B1BC7]/5 transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar post
          </button>
        )}
      </div>
    );
  }
  return null;
}

function PostEditor({
  post,
  media,
  onPatch,
  onRemove,
  onAddMedia,
  onRemoveMedia,
  onReorderMedia,
  disabled,
}: {
  post: Post;
  media: PostMediaRow[];
  onPatch: (p: Partial<Post>) => void;
  onRemove: () => void;
  onAddMedia: (postId: string, url: string, type: "image" | "video") => void;
  onRemoveMedia: (mediaId: string) => void;
  onReorderMedia: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [imageQueue, setImageQueue] = useState<File[]>([]);
  const [croppingFile, setCroppingFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const items = getPostMediaItems(post, media);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const videos = files.filter((f) => detectMediaType(f.name) === "video");
    const images = files.filter((f) => detectMediaType(f.name) !== "video");

    if (videos.length > 0) {
      setUploadingVideo(true);
      for (const file of videos) {
        const { url, error } = await uploadRawMedia(file, "presentations/posts");
        if (error) {
          toast({ title: "Erro ao enviar vídeo", description: error, variant: "destructive" });
        } else if (url) {
          await onAddMedia(post.id, url, "video");
        }
      }
      setUploadingVideo(false);
    }
    if (images.length > 0) {
      if (croppingFile) {
        setImageQueue((prev) => [...prev, ...images]);
      } else {
        setCroppingFile(images[0]);
        setImageQueue(images.slice(1));
      }
    }
  }

  function handleCropped(url: string) {
    onAddMedia(post.id, url, "image");
    if (imageQueue.length > 0) {
      const [next, ...rest] = imageQueue;
      setCroppingFile(next);
      setImageQueue(rest);
    } else {
      setCroppingFile(null);
    }
  }

  async function handleApplyToRemaining(mode: string) {
    const filesToProcess = [croppingFile, ...imageQueue].filter((f): f is File => !!f);
    setImageQueue([]);
    setCroppingFile(null);
    for (const f of filesToProcess) {
      try {
        const blob = await processInstagramFile(f, mode);
        const url = await uploadProcessedImage(blob, `presentations/posts/${crypto.randomUUID()}.png`);
        onAddMedia(post.id, url, "image");
      } catch (err) {
        console.error("Falha ao processar imagem em lote", err);
      }
    }
  }

  function removeItem(item: PostMediaRow) {
    if (isLegacyPostMedia(item.id)) onPatch({ image_url: null });
    else onRemoveMedia(item.id);
  }

  return (
    <div className="relative rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(20,20,20,0.04)] p-4 flex flex-col md:flex-row gap-4 md:gap-5">
      <div className="space-y-1.5 md:w-[180px] shrink-0">
        {items.length === 0 ? (
          <div className="aspect-[4/5] w-full border-2 border-dashed border-black/10 rounded-xl flex items-center justify-center text-[#141414]/30">
            <ImageIcon className="h-5 w-5" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="group relative w-20 h-20 shrink-0 rounded-xl border border-black/[0.06] overflow-hidden"
              >
                {item.media_type === "video" ? (
                  <video src={item.media_url} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                )}
                {item.media_type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="h-4 w-4 text-white drop-shadow" fill="white" />
                  </div>
                )}
                <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-foreground text-background text-[9px] flex items-center justify-center font-medium pointer-events-none">
                  {i + 1}
                </span>
                {!disabled && (
                  <button
                    onClick={() => removeItem(item)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {!disabled && !isLegacyPostMedia(item.id) && items.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-0.5 pb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onReorderMedia(i, i - 1)}
                      disabled={i === 0}
                      className="h-5 w-5 rounded-full bg-background/90 border border-border flex items-center justify-center disabled:opacity-30"
                      title="Mover pra esquerda"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onReorderMedia(i, i + 1)}
                      disabled={i === items.length - 1}
                      className="h-5 w-5 rounded-full bg-background/90 border border-border flex items-center justify-center disabled:opacity-30"
                      title="Mover pra direita"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {!disabled && (
          <>
            <label className="cursor-pointer block">
              <Input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPick} disabled={uploadingVideo} />
              <Button asChild variant="ghost" size="sm" className="w-full text-xs h-7" disabled={uploadingVideo}>
                <span>{uploadingVideo ? "Enviando vídeo..." : "Adicionar mídia"}</span>
              </Button>
            </label>
            <p className="text-[9px] text-muted-foreground leading-snug">
              Escolha manter a imagem original ou formatar para o Instagram (a foto inteira é preservada, sem cortes). Vídeos não são ajustados automaticamente, envie já no formato desejado. Recomendado até {MAX_MEDIA_MB}MB por arquivo.
            </p>
          </>
        )}
        {croppingFile && (
          <ImageCropper
            file={croppingFile}
            open
            onClose={() => { setCroppingFile(null); setImageQueue([]); }}
            onCropped={handleCropped}
            aspect="choice"
            instagramFit
            remainingCount={imageQueue.length}
            onApplyToRemaining={handleApplyToRemaining}
            uploadPath={`presentations/posts/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className={cn("flex flex-wrap items-center gap-2", !disabled && "pr-9")}>
          <input
            placeholder="Formato"
            list="post-format-suggestions"
            value={post.format_type || ""}
            onChange={(e) => onPatch({ format_type: e.target.value })}
            disabled={disabled}
            className="h-8 w-32 rounded-full bg-[#1B1BC7]/10 px-3.5 text-xs font-semibold text-[#1B1BC7] placeholder:text-[#1B1BC7]/50 outline-none focus-visible:ring-2 focus-visible:ring-[#1B1BC7]/30 disabled:opacity-70"
          />
          <datalist id="post-format-suggestions">
            <option value="Reels" />
            <option value="Carrossel" />
            <option value="Estático" />
          </datalist>
          <input
            placeholder="Título do post"
            value={post.title || ""}
            onChange={(e) => onPatch({ title: e.target.value })}
            disabled={disabled}
            className="h-8 flex-1 min-w-[160px] rounded-lg bg-transparent px-1.5 text-base font-semibold text-[#141414] placeholder:text-[#141414]/35 outline-none hover:bg-black/[0.03] focus-visible:bg-black/[0.03] disabled:opacity-70"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-[#141414] focus-within:ring-2 focus-within:ring-[#1B1BC7]/30">
            <Calendar className="h-3.5 w-3.5 text-[#1B1BC7]" />
            <input
              type="date"
              value={post.publish_date || ""}
              onChange={(e) => onPatch({ publish_date: e.target.value })}
              disabled={disabled}
              aria-label="Data de publicação"
              className="bg-transparent outline-none disabled:opacity-70"
            />
          </label>
          <label className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-[#141414] focus-within:ring-2 focus-within:ring-[#1B1BC7]/30">
            <Clock className="h-3.5 w-3.5 text-[#1B1BC7]" />
            <input
              type="time"
              value={post.publish_time || ""}
              onChange={(e) => onPatch({ publish_time: e.target.value })}
              disabled={disabled}
              aria-label="Horário de publicação"
              className="bg-transparent outline-none disabled:opacity-70"
            />
          </label>
        </div>
        <div className="rounded-xl bg-[#F6F4EF] px-3.5 pt-2.5 pb-2 focus-within:ring-2 focus-within:ring-[#1B1BC7]/20">
          <FieldLabel>Legenda</FieldLabel>
          <textarea
            placeholder="Copy / texto do post"
            value={post.copy || ""}
            onChange={(e) => onPatch({ copy: e.target.value })}
            rows={3}
            disabled={disabled}
            className="mt-1 w-full resize-y bg-transparent text-sm leading-relaxed text-[#141414] placeholder:text-[#141414]/35 outline-none disabled:opacity-70"
          />
        </div>
      </div>
      {!disabled && (
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 text-[#141414]/50 hover:text-[#141414]" onClick={onRemove} title="Remover post">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ProfileFieldsEditor({
  block,
  onChange,
  disabled,
  highlights,
}: {
  block: any;
  onChange: (data: any) => void;
  disabled?: boolean;
  highlights: { id: string; title: string; cover_url: string }[];
}) {
  const [avatarPending, setAvatarPending] = useState<File | null>(null);
  const [highlightPending, setHighlightPending] = useState<{ id: string; file: File } | null>(null);

  function patch(p: any) {
    onChange({ ...block.data, ...p });
  }
  function addHighlight() {
    const next = [...highlights, { id: crypto.randomUUID(), title: "Novo", cover_url: "" }];
    patch({ highlights: next });
  }
  function patchHighlight(id: string, p: Partial<{ title: string; cover_url: string }>) {
    patch({ highlights: highlights.map((h) => (h.id === id ? { ...h, ...p } : h)) });
  }
  function removeHighlight(id: string) {
    patch({ highlights: highlights.filter((h) => h.id !== id) });
  }

  return (
    <div className="space-y-4 pt-5 border-t border-black/[0.08]">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {block.data.avatar_url ? (
            <img src={block.data.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <div className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">Avatar</div>
          )}
          {!disabled && (
            <label className="cursor-pointer block mt-1">
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setAvatarPending(f);
                }}
              />
              <Button asChild variant="ghost" size="sm" className="text-[10px] h-6 px-2 w-16"><span>Trocar</span></Button>
            </label>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <FieldLabel>@usuário</FieldLabel>
            <Input className={LEMA_INPUT} placeholder="@username" value={block.data.username || ""} onChange={(e) => patch({ username: e.target.value })} disabled={disabled} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Nome de exibição</FieldLabel>
            <Input className={LEMA_INPUT} placeholder="Nome de exibição" value={block.data.display_name || ""} onChange={(e) => patch({ display_name: e.target.value })} disabled={disabled} />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>Bio</FieldLabel>
        <Textarea className={LEMA_INPUT} placeholder="Bio (use quebras de linha)" value={block.data.bio || ""} onChange={(e) => patch({ bio: e.target.value })} rows={3} disabled={disabled} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <FieldLabel>Posts</FieldLabel>
          <Input className={LEMA_INPUT} placeholder="683" value={block.data.posts_count ?? ""} onChange={(e) => patch({ posts_count: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Followers</FieldLabel>
          <Input className={LEMA_INPUT} placeholder="14,1 mil" value={block.data.followers_count ?? ""} onChange={(e) => patch({ followers_count: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Following</FieldLabel>
          <Input className={LEMA_INPUT} placeholder="1 000" value={block.data.following_count ?? ""} onChange={(e) => patch({ following_count: e.target.value })} disabled={disabled} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Story Highlights</Label>
          {!disabled && highlights.length < 8 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addHighlight}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </div>
        {highlights.length === 0 && <p className="text-[10px] text-muted-foreground">Nenhum destaque ainda.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {highlights.map((h) => (
            <div key={h.id} className="border rounded p-2 space-y-1.5">
              <div className="flex justify-center">
                {h.cover_url ? (
                  <img src={h.cover_url} alt="" className="h-12 w-12 rounded-full object-cover border" />
                ) : (
                  <div className="h-12 w-12 rounded-full border-2 border-dashed flex items-center justify-center text-[9px] text-muted-foreground">Capa</div>
                )}
              </div>
              <Input
                placeholder="Título"
                value={h.title}
                onChange={(e) => patchHighlight(h.id, { title: e.target.value })}
                disabled={disabled}
                className="h-7 text-xs"
              />
              {!disabled && (
                <div className="flex gap-1">
                  <label className="cursor-pointer flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) setHighlightPending({ id: h.id, file: f });
                      }}
                    />
                    <Button asChild variant="ghost" size="sm" className="w-full text-[10px] h-6"><span>Capa</span></Button>
                  </label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeHighlight(h.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {avatarPending && (
        <ImageCropper
          file={avatarPending}
          open
          onClose={() => setAvatarPending(null)}
          onCropped={(url) => { patch({ avatar_url: url }); setAvatarPending(null); }}
          aspect={1}
          circular
          uploadPath={`presentations/avatars/${crypto.randomUUID()}.png`}
        />
      )}
      {highlightPending && (
        <ImageCropper
          file={highlightPending.file}
          open
          onClose={() => setHighlightPending(null)}
          onCropped={(url) => { patchHighlight(highlightPending.id, { cover_url: url }); setHighlightPending(null); }}
          aspect={1}
          circular
          uploadPath={`presentations/highlights/${crypto.randomUUID()}.png`}
        />
      )}
    </div>
  );
}
