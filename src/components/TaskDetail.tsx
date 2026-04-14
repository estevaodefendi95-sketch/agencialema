import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, CheckSquare, History, Image, Film, Upload, X } from "lucide-react";

interface Props {
  taskId: string;
  onClose: () => void;
}

interface Comment { id: string; content: string; created_at: string; user_id: string; profiles?: { full_name: string | null } | null; }
interface ChecklistItem { id: string; title: string; completed: boolean; position: number; }
interface HistoryItem { id: string; action: string; details: any; created_at: string; profiles?: { full_name: string | null } | null; }
interface MediaItem { id: string; file_url: string; file_name: string; file_type: string; created_at: string; }

export default function TaskDetail({ taskId, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    setTask(t);

    const { data: c } = await supabase.from("task_comments").select("*, profiles(full_name)").eq("task_id", taskId).order("created_at");
    setComments(c as any || []);

    const { data: cl } = await supabase.from("task_checklists").select("*").eq("task_id", taskId).order("position");
    setChecklist(cl || []);

    const { data: h } = await supabase.from("task_history").select("*, profiles:user_id(full_name)").eq("task_id", taskId).order("created_at", { ascending: false });
    setHistory(h as any || []);

    const { data: m } = await supabase.from("task_media").select("*").eq("task_id", taskId).order("created_at");
    setMedia(m || []);
  };

  useEffect(() => { load(); }, [taskId]);

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    await supabase.from("task_comments").insert({ task_id: taskId, user_id: user.id, content: newComment });
    setNewComment("");
    toast({ title: "Comentário adicionado" });
    load();
  };

  const addCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const maxPos = checklist.reduce((m, c) => Math.max(m, c.position), -1);
    await supabase.from("task_checklists").insert({ task_id: taskId, title: newCheckItem, position: maxPos + 1 });
    setNewCheckItem("");
    load();
  };

  const toggleCheck = async (item: ChecklistItem) => {
    await supabase.from("task_checklists").update({ completed: !item.completed }).eq("id", item.id);
    load();
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isVideo = ["mp4", "webm", "mov"].includes(ext);
      const fileType = isVideo ? "video" : "image";
      const path = `task-media/${taskId}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) {
        toast({ title: `Erro ao enviar ${file.name}`, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
      await supabase.from("task_media").insert({
        task_id: taskId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: fileType,
      });
    }

    setUploading(false);
    toast({ title: "Mídias enviadas" });
    load();
    e.target.value = "";
  };

  if (!task) return null;

  const completedCount = checklist.filter((c) => c.completed).length;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {task.description && (
              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm mt-1">{task.description}</p>
              </div>
            )}

            <Separator />

            {/* Media */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4" />
                <Label className="font-semibold">Mídias</Label>
                {media.length > 0 && <span className="text-xs text-muted-foreground">({media.length})</span>}
              </div>

              {media.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {media.map((m) => (
                    <div key={m.id} className="relative group rounded-lg overflow-hidden border">
                      {m.file_type === "video" ? (
                        <video src={m.file_url} controls className="w-full h-24 object-cover" />
                      ) : (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={m.file_url} alt={m.file_name} className="w-full h-24 object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{m.file_name}</p>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Adicionar imagens ou vídeos"}
                <input type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={uploadMedia} disabled={uploading} />
              </label>
            </div>

            <Separator />

            {/* Checklist */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="h-4 w-4" />
                <Label className="font-semibold">Checklist</Label>
                {checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">({completedCount}/{checklist.length})</span>
                )}
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox checked={item.completed} onCheckedChange={() => toggleCheck(item)} />
                    <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Novo item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addCheckItem}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>

            <Separator />

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4" />
                <Label className="font-semibold">Comentários</Label>
              </div>
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{(c.profiles as any)?.full_name || "Usuário"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <Button size="sm" onClick={addComment} className="self-end"><Send className="h-4 w-4" /></Button>
              </div>
            </div>

            <Separator />

            {/* History */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4" />
                <Label className="font-semibold">Histórico</Label>
              </div>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{(h.profiles as any)?.full_name || "Sistema"}</span>
                    <span>— {h.action}</span>
                    <span className="ml-auto">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
                {history.length === 0 && <p className="text-xs text-muted-foreground">Nenhum histórico</p>}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
