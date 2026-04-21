import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, GripVertical, Trash2, Image as ImageIcon, Type, Smartphone, ListOrdered, Eye, ExternalLink, Copy, Heading, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ImageCropper from "@/components/ImageCropper";

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
};

type Block = {
  id: string;
  presentation_id: string;
  block_type: "header" | "text" | "image" | "gallery" | "instagram_preview" | "posts_plan";
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
  copy: string | null;
};

const BLOCK_META = {
  header: { label: "Cabeçalho", icon: Heading },
  text: { label: "Texto", icon: Type },
  image: { label: "Imagem", icon: ImageIcon },
  gallery: { label: "Galeria", icon: ImageIcon },
  instagram_preview: { label: "Preview Instagram", icon: Smartphone },
  posts_plan: { label: "Planejamento de Posts", icon: ListOrdered },
};

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

async function uploadImage(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
  if (error) {
    console.error(error);
    return null;
  }
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}

export default function PresentationBuilder({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { canEdit } = useAuth();
  const { toast } = useToast();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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

    let p: Presentation | null = existing as any;
    if (!p && canEdit) {
      const baseSlug = slugify(projectName) || projectId.slice(0, 8);
      const slug = `${baseSlug}-${projectId.slice(0, 6)}`;
      const { data: created, error } = await supabase
        .from("project_presentations")
        .insert({ project_id: projectId, slug, hero_title: projectName })
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
      setBlocks((b || []) as any);
      setPosts((po || []) as any);
    }
    setLoading(false);
  }

  // Persist presentation
  async function patchPres(patch: Partial<Presentation>) {
    if (!pres) return;
    const next = { ...pres, ...patch };
    setPres(next);
    await supabase.from("project_presentations").update(patch).eq("id", pres.id);
  }

  async function addBlock(type: Block["block_type"]) {
    if (!pres) return;
    const position = blocks.length;
    const defaults: Record<string, any> = {
      header: { title: "", subtitle: "" },
      text: { content: "" },
      image: { url: "", caption: "" },
      gallery: { images: [] },
      instagram_preview: { images: [] },
      posts_plan: {},
    };
    const { data, error } = await supabase
      .from("presentation_blocks")
      .insert({ presentation_id: pres.id, block_type: type, position, data: defaults[type] })
      .select("*").single();
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    setBlocks((prev) => [...prev, data as any]);
  }

  async function patchBlock(id: string, data: any) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)));
    await supabase.from("presentation_blocks").update({ data }).eq("id", id);
  }

  async function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("presentation_blocks").delete().eq("id", id);
  }

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const reord = Array.from(blocks);
    const [moved] = reord.splice(r.source.index, 1);
    reord.splice(r.destination.index, 0, moved);
    setBlocks(reord);
    await Promise.all(reord.map((b, idx) => supabase.from("presentation_blocks").update({ position: idx }).eq("id", b.id)));
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
    await supabase.from("presentation_posts").delete().eq("id", id);
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Status</Label>
            <Select value={pres.status} onValueChange={(v) => patchPres({ status: v as any })} disabled={!canEdit}>
              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Liberar para o cliente</Label>
            <Switch checked={pres.released} onCheckedChange={(v) => patchPres({ released: v })} disabled={!canEdit} />
          </div>
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

      {/* Hero / Logos */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <LogoField label="Logo do cliente" value={pres.client_logo_url} onChange={(url) => patchPres({ client_logo_url: url })} disabled={!canEdit} folder="presentations/logos" />
          <LogoField label="Logo da agência" value={pres.agency_logo_url} onChange={(url) => patchPres({ agency_logo_url: url })} disabled={!canEdit} folder="presentations/logos" />
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={pres.hero_title || ""} onChange={(e) => patchPres({ hero_title: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição da campanha</Label>
            <Textarea value={pres.hero_description || ""} onChange={(e) => patchPres({ hero_description: e.target.value })} disabled={!canEdit} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Blocks */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="blocks">
          {(prov) => (
            <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-3">
              {blocks.map((b, idx) => (
                <Draggable key={b.id} draggableId={b.id} index={idx} isDragDisabled={!canEdit}>
                  {(p) => (
                    <Card ref={p.innerRef} {...p.draggableProps}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {canEdit && (
                            <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </span>
                          )}
                          <Badge variant="secondary">{BLOCK_META[b.block_type].label}</Badge>
                          <div className="flex-1" />
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(b.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <BlockEditor
                          block={b}
                          onChange={(d) => patchBlock(b.id, d)}
                          posts={posts}
                          onAddPost={addPost}
                          onPatchPost={patchPost}
                          onRemovePost={removePost}
                          disabled={!canEdit}
                        />
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              ))}
              {prov.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add block */}
      {canEdit && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Adicionar bloco</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BLOCK_META) as Block["block_type"][]).map((k) => {
                const Icon = BLOCK_META[k].icon;
                return (
                  <Button key={k} variant="outline" size="sm" onClick={() => addBlock(k)}>
                    <Icon className="h-4 w-4 mr-1.5" /> {BLOCK_META[k].label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogoField({ label, value, onChange, disabled, folder }: { label: string; value: string | null; onChange: (url: string | null) => void; disabled?: boolean; folder: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, folder);
    setUploading(false);
    if (url) onChange(url);
    else toast({ title: "Erro no upload", variant: "destructive" });
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt={label} className="h-14 w-14 object-contain border rounded bg-muted/30 p-1" />
        ) : (
          <div className="h-14 w-14 border rounded flex items-center justify-center text-muted-foreground bg-muted/30">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {!disabled && (
          <>
            <label className="cursor-pointer">
              <Input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={uploading} />
              <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Enviando..." : "Enviar"}</span></Button>
            </label>
            {value && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Remover</Button>}
          </>
        )}
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, posts, onAddPost, onPatchPost, onRemovePost, disabled }: any) {
  const [queue, setQueue] = useState<File[]>([]);
  const [current, setCurrent] = useState<File | null>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setQueue(files.slice(1));
    setCurrent(files[0]);
  }

  function handleCropped(url: string, isMulti: boolean) {
    if (isMulti) {
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

  function cancelCrop() {
    setCurrent(null);
    setQueue([]);
  }

  // Determine aspect for each block type
  const isInsta = block.block_type === "instagram_preview";
  const isGallery = block.block_type === "gallery";
  const isSingleImage = block.block_type === "image";
  const aspect: number | "free" | "choice" = isInsta ? 1 : isGallery ? 1 : "choice";
  const isMulti = isGallery || isInsta;

  if (block.block_type === "header") {
    return (
      <div className="space-y-2">
        <Input placeholder="Título" value={block.data.title || ""} onChange={(e) => onChange({ ...block.data, title: e.target.value })} disabled={disabled} />
        <Input placeholder="Subtítulo" value={block.data.subtitle || ""} onChange={(e) => onChange({ ...block.data, subtitle: e.target.value })} disabled={disabled} />
      </div>
    );
  }
  if (block.block_type === "text") {
    return (
      <Textarea placeholder="Escreva aqui..." value={block.data.content || ""} onChange={(e) => onChange({ ...block.data, content: e.target.value })} rows={6} disabled={disabled} />
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
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (isGallery || isInsta) {
    const images: string[] = block.data.images || [];
    const layout: "feed_only" | "full_profile" = block.data.layout || "feed_only";
    const highlights: { id: string; title: string; cover_url: string }[] = block.data.highlights || [];
    return (
      <div className="space-y-3">
        {isInsta && (
          <div className="space-y-3 p-3 rounded-md bg-muted/40 border">
            <div>
              <Label className="text-xs">Formato da apresentação</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...block.data, layout: "feed_only" })}
                  className={cn(
                    "text-xs px-3 py-2 rounded border text-left transition-colors",
                    layout === "feed_only" ? "border-primary bg-primary/10 text-primary font-medium" : "border-input hover:bg-accent",
                  )}
                >
                  📱 Só feed
                  <span className="block text-[10px] opacity-70 font-normal mt-0.5">Apenas o grid 3×N</span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...block.data, layout: "full_profile" })}
                  className={cn(
                    "text-xs px-3 py-2 rounded border text-left transition-colors",
                    layout === "full_profile" ? "border-primary bg-primary/10 text-primary font-medium" : "border-input hover:bg-accent",
                  )}
                >
                  👤 Perfil completo
                  <span className="block text-[10px] opacity-70 font-normal mt-0.5">Cabeçalho + stories + feed</span>
                </button>
              </div>
            </div>
            {layout === "full_profile" && (
              <ProfileFieldsEditor block={block} onChange={onChange} disabled={disabled} highlights={highlights} />
            )}
          </div>
        )}
        {isGallery && <p className="text-xs text-muted-foreground">Cada imagem será recortada em 1:1 para um layout consistente.</p>}
        {isInsta && <p className="text-xs text-muted-foreground">Imagens do feed em 1:1 (recorte obrigatório).</p>}
        <div className={cn("grid gap-2", isInsta ? "grid-cols-3 max-w-xs" : "grid-cols-3 sm:grid-cols-4")}>
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
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />Adicionar imagens do feed</span></Button>
          </label>
        )}
        {current && (
          <ImageCropper
            file={current}
            open
            onClose={cancelCrop}
            onCropped={(url) => handleCropped(url, true)}
            aspect={aspect}
            uploadPath={`presentations/media/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
    );
  }
  if (block.block_type === "posts_plan") {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {posts.length === 0 && <p className="text-xs text-muted-foreground">Nenhum post planejado ainda.</p>}
          {posts.map((p: Post) => (
            <PostEditor key={p.id} post={p} onPatch={(patch) => onPatchPost(p.id, patch)} onRemove={() => onRemovePost(p.id)} disabled={disabled} />
          ))}
        </div>
        {!disabled && (
          <Button variant="outline" size="sm" onClick={onAddPost}><Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar post</Button>
        )}
      </div>
    );
  }
  return null;
}

function PostEditor({ post, onPatch, onRemove, disabled }: { post: Post; onPatch: (p: Partial<Post>) => void; onRemove: () => void; disabled?: boolean }) {
  const [pending, setPending] = useState<File | null>(null);
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setPending(f);
  }
  return (
    <div className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-3">
      <div>
        {post.image_url ? (
          <img src={post.image_url} alt="" className="aspect-[4/5] w-full object-cover rounded" />
        ) : (
          <div className="aspect-[4/5] w-full border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {!disabled && (
          <label className="cursor-pointer block mt-1">
            <Input type="file" accept="image/*" className="hidden" onChange={onPick} />
            <Button asChild variant="ghost" size="sm" className="w-full text-xs h-7"><span>Enviar e recortar</span></Button>
          </label>
        )}
        {pending && (
          <ImageCropper
            file={pending}
            open
            onClose={() => setPending(null)}
            onCropped={(url) => { onPatch({ image_url: url }); setPending(null); }}
            aspect={4 / 5}
            uploadPath={`presentations/posts/${crypto.randomUUID()}.png`}
          />
        )}
      </div>
      <div className="space-y-2">
        <Input placeholder="Título do post" value={post.title || ""} onChange={(e) => onPatch({ title: e.target.value })} disabled={disabled} />
        <Input type="date" value={post.publish_date || ""} onChange={(e) => onPatch({ publish_date: e.target.value })} disabled={disabled} />
        <Textarea placeholder="Copy / texto do post" value={post.copy || ""} onChange={(e) => onPatch({ copy: e.target.value })} rows={3} disabled={disabled} />
      </div>
      {!disabled && (
        <Button variant="ghost" size="icon" className="self-start h-8 w-8" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
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
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-start gap-3">
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
        <div className="flex-1 space-y-2">
          <Input placeholder="@username" value={block.data.username || ""} onChange={(e) => patch({ username: e.target.value })} disabled={disabled} />
          <Input placeholder="Nome de exibição" value={block.data.display_name || ""} onChange={(e) => patch({ display_name: e.target.value })} disabled={disabled} />
        </div>
      </div>
      <Textarea placeholder="Bio (use quebras de linha)" value={block.data.bio || ""} onChange={(e) => patch({ bio: e.target.value })} rows={3} disabled={disabled} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Posts</Label>
          <Input placeholder="683" value={block.data.posts_count ?? ""} onChange={(e) => patch({ posts_count: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Followers</Label>
          <Input placeholder="14,1 mil" value={block.data.followers_count ?? ""} onChange={(e) => patch({ followers_count: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Following</Label>
          <Input placeholder="1 000" value={block.data.following_count ?? ""} onChange={(e) => patch({ following_count: e.target.value })} disabled={disabled} />
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
