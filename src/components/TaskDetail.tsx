import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, CheckSquare, History, Image, Upload, X, Trash2, Pencil, Save, FileText, Download } from "lucide-react";

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  profiles?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface Props {
  taskId: string;
  onClose: () => void;
  onTaskDeleted?: () => void;
  projectMembers?: ProjectMember[];
}

interface Comment { id: string; content: string; created_at: string; user_id: string; profiles?: { full_name: string | null } | null; }
interface ChecklistItem { id: string; title: string; completed: boolean; position: number; }
interface HistoryItem { id: string; action: string; details: any; created_at: string; profiles?: { full_name: string | null } | null; }
interface MediaItem { id: string; file_url: string; file_name: string; file_type: string; created_at: string; }

export default function TaskDetail({ taskId, onClose, onTaskDeleted, projectMembers = [] }: Props) {
  const { user, isAdmin, canEdit } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [uploading, setUploading] = useState(false);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Comment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  // Checklist editing
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);
  const [editCheckTitle, setEditCheckTitle] = useState("");

  const load = async () => {
    const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    setTask(t);
    if (t) {
      setEditTitle(t.title);
      setEditDesc(t.description || "");
      setEditPriority(t.priority);
      setEditDueDate(t.due_date || "");
    }

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

  // Save task edits
  const saveTaskEdits = async () => {
    if (!task || !user) return;
    const updates: any = {};
    const changes: string[] = [];
    if (editTitle !== task.title) { updates.title = editTitle; changes.push(`Título: "${task.title}" → "${editTitle}"`); }
    if (editDesc !== (task.description || "")) { updates.description = editDesc || null; changes.push("Descrição atualizada"); }
    if (editPriority !== task.priority) { updates.priority = editPriority; changes.push(`Prioridade: ${task.priority} → ${editPriority}`); }
    if (editDueDate !== (task.due_date || "")) { updates.due_date = editDueDate || null; changes.push("Prazo atualizado"); }

    if (Object.keys(updates).length === 0) return;
    await supabase.from("tasks").update(updates).eq("id", taskId);
    await supabase.from("task_history").insert({ task_id: taskId, user_id: user.id, action: "Editou tarefa", details: { changes } });
    setHasChanges(false);
    toast({ title: "Tarefa atualizada" });
    load();
  };

  const deleteTask = async () => {
    await supabase.from("task_checklists").delete().eq("task_id", taskId);
    await supabase.from("task_comments").delete().eq("task_id", taskId);
    await supabase.from("task_history").delete().eq("task_id", taskId);
    await supabase.from("task_media").delete().eq("task_id", taskId);
    await supabase.from("task_attachments").delete().eq("task_id", taskId);
    await supabase.from("tasks").delete().eq("id", taskId);
    toast({ title: "Tarefa excluída" });
    onTaskDeleted?.();
    onClose();
  };

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    await supabase.from("task_comments").insert({ task_id: taskId, user_id: user.id, content: newComment });
    await supabase.from("task_history").insert({ task_id: taskId, user_id: user.id, action: "Comentou", details: { content: newComment } });
    setNewComment("");
    toast({ title: "Comentário adicionado" });
    load();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("task_comments").delete().eq("id", id);
    toast({ title: "Comentário excluído" });
    load();
  };

  const updateComment = async (id: string) => {
    if (!editCommentContent.trim()) return;
    await supabase.from("task_comments").update({ content: editCommentContent }).eq("id", id);
    setEditingCommentId(null);
    toast({ title: "Comentário atualizado" });
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

  const deleteCheckItem = async (id: string) => {
    await supabase.from("task_checklists").delete().eq("id", id);
    load();
  };

  const updateCheckItem = async (id: string) => {
    if (!editCheckTitle.trim()) return;
    await supabase.from("task_checklists").update({ title: editCheckTitle }).eq("id", id);
    setEditingCheckId(null);
    load();
  };

  const deleteMedia = async (item: MediaItem) => {
    // Extract path from URL
    const urlParts = item.file_url.split("/storage/v1/object/public/attachments/");
    if (urlParts[1]) {
      await supabase.storage.from("attachments").remove([urlParts[1].split("?")[0]]);
    }
    await supabase.from("task_media").delete().eq("id", item.id);
    toast({ title: "Mídia excluída" });
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
  const priorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

  const checkFieldChange = (field: string, value: string) => {
    if (field === "priority") setEditPriority(value);
    if (field === "due_date") setEditDueDate(value);
    setHasChanges(true);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            {editingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => { setEditTitle(e.target.value); setHasChanges(true); }}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                autoFocus
                className="text-lg font-semibold"
              />
            ) : (
              <DialogTitle
                className={canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""}
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {editTitle || task.title}
              </DialogTitle>
            )}
            {canEdit && hasChanges && (
              <Button size="sm" onClick={saveTaskEdits} className="shrink-0"><Save className="h-3 w-3 mr-1" />Salvar</Button>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              {editingDesc && canEdit ? (
                <Textarea
                  value={editDesc}
                  onChange={(e) => { setEditDesc(e.target.value); setHasChanges(true); }}
                  onBlur={() => setEditingDesc(false)}
                  autoFocus
                  className="mt-1 text-sm"
                />
              ) : (
                <p
                  className={`text-sm mt-1 ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""} ${!editDesc ? "text-muted-foreground italic" : ""}`}
                  onClick={() => canEdit && setEditingDesc(true)}
                >
                  {editDesc || "Clique para adicionar descrição..."}
                </p>
              )}
            </div>

            {/* Priority & Due Date */}
            {canEdit && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Prioridade</Label>
                  <Select value={editPriority} onValueChange={(v) => checkFieldChange("priority", v)}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Prazo</Label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => checkFieldChange("due_date", e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
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
                      {canEdit && (
                        <button
                          onClick={() => deleteMedia(m)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox checked={item.completed} onCheckedChange={() => toggleCheck(item)} />
                    {editingCheckId === item.id ? (
                      <Input
                        value={editCheckTitle}
                        onChange={(e) => setEditCheckTitle(e.target.value)}
                        onBlur={() => updateCheckItem(item.id)}
                        onKeyDown={(e) => e.key === "Enter" && updateCheckItem(item.id)}
                        autoFocus
                        className="h-7 text-sm flex-1"
                      />
                    ) : (
                      <span
                        className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""} ${canEdit ? "cursor-pointer" : ""}`}
                        onClick={() => { if (canEdit) { setEditingCheckId(item.id); setEditCheckTitle(item.title); } }}
                      >
                        {item.title}
                      </span>
                    )}
                    {canEdit && (
                      <button onClick={() => deleteCheckItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
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
                  <div key={c.id} className="bg-muted/50 rounded-lg p-3 group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{(c.profiles as any)?.full_name || "Usuário"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                        {(c.user_id === user?.id || isAdmin) && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.user_id === user?.id && (
                              <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className="min-h-[40px] text-sm flex-1"
                          autoFocus
                        />
                        <div className="flex flex-col gap-1">
                          <Button size="sm" onClick={() => updateComment(c.id)}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{c.content}</p>
                    )}
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

        {canEdit && (
          <div className="flex justify-start pt-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5 text-xs">
                  <Trash2 className="h-3 w-3" /> Excluir tarefa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os dados da tarefa serão removidos.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTask}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
