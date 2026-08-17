import { useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Type, Image as ImageIcon, Trash2, AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react";

export type CanvasElement = {
  id: string;
  type: "text" | "image";
  x: number; // % da largura do canvas (0-100)
  y: number; // % da altura do canvas (0-100)
  width: number; // %
  height: number; // %
  zIndex: number;
  content?: string;
  fontSize?: number; // em cqw (% da largura do canvas) — escala com o tamanho da tela
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  url?: string;
};

export type CanvasData = {
  background_color?: string | null;
  background_image_url?: string | null;
  elements: CanvasElement[];
};

async function uploadCanvasImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `presentations/canvas/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (error) return null;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl + "?t=" + Date.now();
}

export default function CanvasEditor({
  data,
  onChange,
  disabled,
}: {
  data: CanvasData;
  onChange: (d: CanvasData) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const elements = data.elements || [];
  const selected = elements.find((e) => e.id === selectedId) || null;

  function updateElements(next: CanvasElement[]) {
    onChange({ ...data, elements: next });
  }

  function addElement(type: "text" | "image", url?: string) {
    const id = crypto.randomUUID();
    const maxZ = elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const el: CanvasElement =
      type === "text"
        ? { id, type, x: 10, y: 40, width: 45, height: 18, zIndex: maxZ + 1, content: "Novo texto", fontSize: 4, color: "#141414", align: "left", bold: false }
        : { id, type, x: 10, y: 10, width: 35, height: 35, zIndex: maxZ + 1, url };
    updateElements([...elements, el]);
    setSelectedId(id);
    if (type === "text") setEditingId(id);
  }

  function patchElement(id: string, patch: Partial<CanvasElement>) {
    updateElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeElement(id: string) {
    updateElements(elements.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadCanvasImage(file);
    if (url) addElement("image", url);
  }

  async function handleBgImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadCanvasImage(file);
    if (url) onChange({ ...data, background_image_url: url });
  }

  const px = (pct: number, total: number) => (pct / 100) * total;
  const toPct = (val: number, total: number) => (total > 0 ? (val / total) * 100 : 0);

  const textStyle = (el: CanvasElement): React.CSSProperties => ({
    fontSize: `${el.fontSize || 4}cqw`,
    color: el.color || "#141414",
    fontWeight: el.bold ? 700 : 400,
    textAlign: el.align || "left",
    lineHeight: 1.15,
  });

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-muted/40 border">
          <Button variant="outline" size="sm" onClick={() => addElement("text")}>
            <Type className="h-3.5 w-3.5 mr-1.5" /> Adicionar texto
          </Button>
          <label className="cursor-pointer inline-block">
            <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            <Button asChild variant="outline" size="sm"><span><ImageIcon className="h-3.5 w-3.5 mr-1.5" />Adicionar imagem</span></Button>
          </label>
          <div className="w-px h-6 bg-border mx-1" />
          <span className="text-xs text-muted-foreground">Fundo:</span>
          <input
            type="color"
            value={data.background_color || "#F6F4EF"}
            onChange={(e) => onChange({ ...data, background_color: e.target.value })}
            className="h-7 w-9 rounded border bg-background p-0.5"
          />
          <label className="cursor-pointer inline-block">
            <input type="file" accept="image/*" className="hidden" onChange={handleBgImagePick} />
            <Button asChild variant="ghost" size="sm" className="text-xs h-7"><span>Imagem de fundo</span></Button>
          </label>
          {data.background_image_url && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onChange({ ...data, background_image_url: null })}>
              Remover fundo
            </Button>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-md border overflow-hidden select-none"
        style={{
          background: data.background_image_url
            ? `center/cover no-repeat url(${data.background_image_url})`
            : data.background_color || "#F6F4EF",
        }}
        onMouseDown={(e) => {
          // Só desmarca se o clique foi direto no fundo, não em um filho.
          if (e.target === e.currentTarget) {
            setSelectedId(null);
            setEditingId(null);
          }
        }}
      >
        {elements.map((el) => {
          const w = containerRef.current?.offsetWidth || 800;
          const h = containerRef.current?.offsetHeight || 450;
          const isEditing = editingId === el.id;
          return (
            <Rnd
              key={el.id}
              size={{ width: px(el.width, w), height: px(el.height, h) }}
              position={{ x: px(el.x, w), y: px(el.y, h) }}
              bounds="parent"
              disableDragging={disabled || isEditing}
              enableResizing={!disabled && !isEditing}
              lockAspectRatio={false}
              style={{ zIndex: isEditing ? 1000 : el.zIndex }}
              onDragStop={(_, d) => {
                const cw = containerRef.current?.offsetWidth || w;
                const ch = containerRef.current?.offsetHeight || h;
                patchElement(el.id, { x: toPct(d.x, cw), y: toPct(d.y, ch) });
              }}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                const cw = containerRef.current?.offsetWidth || w;
                const ch = containerRef.current?.offsetHeight || h;
                const newWidth = toPct(ref.offsetWidth, cw);
                const newHeight = toPct(ref.offsetHeight, ch);
                const patch: Partial<CanvasElement> = {
                  width: newWidth,
                  height: newHeight,
                  x: toPct(pos.x, cw),
                  y: toPct(pos.y, ch),
                };
                // Redimensionar a caixa de texto também escala a fonte,
                // igual no Canva — usa a mudança de altura como referência.
                if (el.type === "text" && el.height > 0) {
                  const scale = newHeight / el.height;
                  patch.fontSize = Math.max(1, Math.round((el.fontSize || 4) * scale * 10) / 10);
                }
                patchElement(el.id, patch);
              }}
              onMouseDown={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSelectedId(el.id);
              }}
              onDoubleClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (el.type === "text") {
                  setSelectedId(el.id);
                  setEditingId(el.id);
                }
              }}
              className={cn(selectedId === el.id && !disabled && "ring-2 ring-primary")}
            >
              {el.type === "text" ? (
                isEditing ? (
                  <textarea
                    autoFocus
                    value={el.content || ""}
                    onChange={(e) => patchElement(el.id, { content: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full h-full resize-none border-none outline-none bg-transparent px-1"
                    style={textStyle(el)}
                  />
                ) : (
                  <div
                    className="w-full h-full overflow-hidden px-1"
                    style={{ ...textStyle(el), whiteSpace: "pre-wrap" }}
                  >
                    {el.content || <span className="opacity-40">Clique duas vezes pra editar</span>}
                  </div>
                )
              ) : (
                <img src={el.url} alt="" className="w-full h-full object-cover pointer-events-none" />
              )}
            </Rnd>
          );
        })}
        {elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            Página em branco — adicione texto ou imagem acima
          </div>
        )}
      </div>

      {selected && !disabled && (
        <div className="p-3 rounded-md border bg-background space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {selected.type === "text" ? "Texto selecionado — duplo clique no canvas pra digitar" : "Imagem selecionada"}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeElement(selected.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          </div>
          {selected.type === "text" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Tamanho</span>
                <Slider
                  min={1.5}
                  max={12}
                  step={0.5}
                  value={[selected.fontSize || 4]}
                  onValueChange={([v]) => patchElement(selected.id, { fontSize: v })}
                  className="w-28"
                />
                <span className="text-[10px] text-muted-foreground w-8 tabular-nums">{(selected.fontSize || 4).toFixed(1)}</span>
              </div>
              <input
                type="color"
                value={selected.color || "#141414"}
                onChange={(e) => patchElement(selected.id, { color: e.target.value })}
                className="h-7 w-9 rounded border bg-background p-0.5"
              />
              <ToggleGroup
                type="single"
                value={selected.align || "left"}
                onValueChange={(v) => v && patchElement(selected.id, { align: v as any })}
                size="sm"
              >
                <ToggleGroupItem value="left" className="h-7 w-7 p-0"><AlignLeft className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="center" className="h-7 w-7 p-0"><AlignCenter className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="right" className="h-7 w-7 p-0"><AlignRight className="h-3.5 w-3.5" /></ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant={selected.bold ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => patchElement(selected.id, { bold: !selected.bold })}
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Arraste pra mover, puxe os cantos pra redimensionar (a fonte acompanha). Duplo clique num texto pra digitar.
      </p>
    </div>
  );
}
