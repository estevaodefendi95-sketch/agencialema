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
          <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
            <Eye className="h-4 w-4 mr-1.5" /> Pré-visualizar
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
  const [uploading, setUploading] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, multi = false) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      const u = await uploadImage(f, "presentations/media");
      if (u) urls.push(u);
    }
    setUploading(false);
    if (multi) onChange({ ...block.data, images: [...(block.data.images || []), ...urls] });
    else onChange({ ...block.data, url: urls[0] });
  }

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
  if (block.block_type === "image") {
    return (
      <div className="space-y-2">
        {block.data.url ? (
          <img src={block.data.url} alt="" className="max-h-64 rounded border" />
        ) : (
          <div className="h-40 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">Nenhuma imagem</div>
        )}
        {!disabled && (
          <label className="cursor-pointer inline-block">
            <Input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e, false)} />
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Enviando..." : "Enviar imagem"}</span></Button>
          </label>
        )}
        <Input placeholder="Legenda" value={block.data.caption || ""} onChange={(e) => onChange({ ...block.data, caption: e.target.value })} disabled={disabled} />
      </div>
    );
  }
  if (block.block_type === "gallery" || block.block_type === "instagram_preview") {
    const images: string[] = block.data.images || [];
    const isInsta = block.block_type === "instagram_preview";
    return (
      <div className="space-y-3">
        {isInsta && <p className="text-xs text-muted-foreground">As imagens serão exibidas como feed do Instagram em formato 1:1.</p>}
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
            <Input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onUpload(e, true)} />
            <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Enviando..." : "Adicionar imagens"}</span></Button>
          </label>
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
  const [uploading, setUploading] = useState(false);
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const url = await uploadImage(f, "presentations/posts");
    setUploading(false);
    if (url) onPatch({ image_url: url });
  }
  return (
    <div className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-3">
      <div>
        {post.image_url ? (
          <img src={post.image_url} alt="" className="aspect-square w-full object-cover rounded" />
        ) : (
          <div className="aspect-square w-full border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {!disabled && (
          <label className="cursor-pointer block mt-1">
            <Input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            <Button asChild variant="ghost" size="sm" className="w-full text-xs h-7"><span>{uploading ? "..." : "Enviar"}</span></Button>
          </label>
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
