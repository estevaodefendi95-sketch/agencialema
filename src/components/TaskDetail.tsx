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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, CheckSquare, History, Image, Upload, X, Trash2, Pencil, Save, FileText, Download, ChevronDown, ChevronUp, User, Check } from "lucide-react";

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  profiles?: { full_name: string | null; nickname?: string | null; email: string | null; avatar_url: string | null } | null;
}

interface Props {
  taskId: string;
  onClose: () => void;
  onTaskDeleted?: () => void;
  projectMembers?: ProjectMember[];
}

interface Comment { id: string; content: string; created_at: string; user_id: string; profiles?: { full_name: string | null; nickname?: string | null } | null; }
interface ChecklistItem { id: string; title: string; completed: boolean; position: number; }
interface HistoryItem { id: string; action: string; details: any; created_at: string; profiles?: { full_name: string | null; nickname?: string | null } | null; }

const displayName = (p?: { full_name?: string | null; nickname?: string | null } | null) =>
  p?.nickname?.trim() || p?.full_name || "Usuário";
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
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editAssigneeName, setEditAssigneeName] = useState("");
  const [freeNameInput, setFreeNameInput] = useState("");
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Comment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  // Checklist editing
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);
  const [editCheckTitle, setEditCheckTitle] = useState("");

  // Comments panel
  const [commentsOpen, setCommentsOpen] = useState(false);

  const load = async () => {
    const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    setTask(t);
    if (t) {
      setEditTitle(t.title);
      setEditDesc(t.description || "");
      setEditPriority(t.priority);
      setEditDueDate(t.due_date || "");
      setEditAssignedTo(t.assigned_to || "");
      setEditAssigneeName((t as any).assignee_name || "");
      setFreeNameInput((t as any).assignee_name || "");
    }

    const { data: c, error: cErr } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at");
    if (cErr) {
      console.error("Erro ao carregar comentários:", cErr);
      toast({ title: "Erro ao carregar comentários", variant: "destructive" });
    }
    let enrichedComments: any[] = c || [];
    if (c && c.length > 0) {
      const userIds = Array.from(new Set(c.map((x: any) => x.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, nickname")
          .in("id", userIds);
        const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
        enrichedComments = c.map((x: any) => ({ ...x, profiles: profMap.get(x.user_id) || null }));
      }
    }
    setComments(enrichedComments);
    // Sempre inicia minimizado ao abrir a tarefa

    const { data: cl } = await supabase.from("task_checklists").select("*").eq("task_id", taskId).order("position");
    setChecklist(cl || []);

    const { data: h } = await supabase.from("task_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
    let enrichedHistory: any[] = h || [];
    if (h && h.length > 0) {
      const hUserIds = Array.from(new Set(h.map((x: any) => x.user_id).filter(Boolean)));
      if (hUserIds.length > 0) {
        const { data: hProfs } = await supabase
          .from("profiles")
          .select("id, full_name, nickname")
          .in("id", hUserIds);
        const hMap = new Map((hProfs || []).map((p: any) => [p.id, p]));
        enrichedHistory = h.map((x: any) => ({ ...x, profiles: x.user_id ? hMap.get(x.user_id) || null : null }));
      }
    }
    setHistory(enrichedHistory);

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
    if (editAssignedTo !== (task.assigned_to || "")) { updates.assigned_to = editAssignedTo || null; changes.push("Responsável atualizado"); }
    if (editAssigneeName !== ((task as any).assignee_name || "")) { updates.assignee_name = editAssigneeName || null; changes.push("Responsável (nome) atualizado"); }
    // Mutual exclusion: if registered user picked, clear free name; if free name picked, clear user
    if (editAssignedTo) updates.assignee_name = null;
    else if (editAssigneeName) updates.assigned_to = null;

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

  const reloadHistory = async () => {
    const { data: h } = await supabase.from("task_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
    let enriched: any[] = h || [];
    if (h && h.length > 0) {
      const ids = Array.from(new Set(h.map((x: any) => x.user_id).filter(Boolean)));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, nickname").in("id", ids);
        const map = new Map((profs || []).map((p: any) => [p.id, p]));
        enriched = h.map((x: any) => ({ ...x, profiles: x.user_id ? map.get(x.user_id) || null : null }));
      }
    }
    setHistory(enriched);
  };

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    if (!commentsOpen) setCommentsOpen(true);
    const content = newComment;
    setNewComment("");
    const { data: inserted, error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, user_id: user.id, content })
      .select("*")
      .single();
    if (error || !inserted) {
      setNewComment(content);
      toast({ title: "Erro ao comentar", variant: "destructive" });
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, nickname")
      .eq("id", user.id)
      .maybeSingle();
    setComments((prev) => [...prev, { ...inserted, profiles: prof || null } as any]);
    toast({ title: "Comentário adicionado" });
    supabase
      .from("task_history")
      .insert({ task_id: taskId, user_id: user.id, action: "Comentou", details: { content } })
      .then(() => reloadHistory());
  };

  const deleteComment = async (id: string) => {
    await supabase.from("task_comments").delete().eq("id", id);
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Comentário excluído" });
  };

  const updateComment = async (id: string) => {
    if (!editCommentContent.trim()) return;
    const content = editCommentContent;
    await supabase.from("task_comments").update({ content }).eq("id", id);
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
    setEditingCommentId(null);
    toast({ title: "Comentário atualizado" });
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
      const videoExts = ["mp4", "webm", "mov"];
      const docExts = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"];
      const fileType = videoExts.includes(ext) ? "video" : docExts.includes(ext) ? "document" : "image";
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
    if (field === "assigned_to") setEditAssignedTo(value);
    setHasChanges(true);
  };

  const assignedProfile = editAssignedTo
    ? projectMembers.find((m) => m.user_id === editAssignedTo)?.profiles || null
    : null;
  const assigneeDisplayName = assignedProfile
    ? (assignedProfile as any).nickname?.trim() || assignedProfile.full_name || (assignedProfile as any).email || "Usuário"
    : editAssigneeName?.trim() || "";
  const assigneeInitial = (assigneeDisplayName || "?").charAt(0).toUpperCase();

  const pickMember = (userId: string) => {
    setEditAssignedTo(userId);
    setEditAssigneeName("");
    setFreeNameInput("");
    setHasChanges(true);
    setAssigneePopoverOpen(false);
  };
  const clearAssignee = () => {
    setEditAssignedTo("");
    setEditAssigneeName("");
    setFreeNameInput("");
    setHasChanges(true);
    setAssigneePopoverOpen(false);
  };
  const applyFreeName = () => {
    const name = freeNameInput.trim();
    if (!name) return;
    setEditAssigneeName(name);
    setEditAssignedTo("");
    setHasChanges(true);
    setAssigneePopoverOpen(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0 pr-14">
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

          {/* Responsável */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Responsável:</span>
            {canEdit ? (
              <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-6 w-6">
                      {(assignedProfile as any)?.avatar_url && (
                        <AvatarImage src={(assignedProfile as any).avatar_url} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {assigneeDisplayName ? assigneeInitial : <User className="h-3 w-3" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`text-sm ${assigneeDisplayName ? "" : "italic text-muted-foreground"}`}>
                      {assigneeDisplayName || "Sem responsável"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onClick={clearAssignee}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                    >
                      <Avatar className="h-6 w-6"><AvatarFallback><User className="h-3 w-3" /></AvatarFallback></Avatar>
                      <span className="italic text-muted-foreground">Sem responsável</span>
                      {!editAssignedTo && !editAssigneeName && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </button>
                    {projectMembers.map((m) => {
                      const name = (m.profiles as any)?.nickname?.trim() || (m.profiles as any)?.full_name || (m.profiles as any)?.email || "Sem nome";
                      const isSelected = editAssignedTo === m.user_id;
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => pickMember(m.user_id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                        >
                          <Avatar className="h-6 w-6">
                            {(m.profiles as any)?.avatar_url && <AvatarImage src={(m.profiles as any).avatar_url} />}
                            <AvatarFallback className="text-[10px]">{name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{name}</span>
                          {isSelected && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Ou usar nome livre</Label>
                    <div className="flex gap-1.5">
                      <Input
                        value={freeNameInput}
                        onChange={(e) => setFreeNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyFreeName()}
                        placeholder="Ex: João Cliente"
                        className="h-8 text-sm"
                      />
                      <Button size="sm" onClick={applyFreeName} className="shrink-0">Aplicar</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1">
                <Avatar className="h-6 w-6">
                  {(assignedProfile as any)?.avatar_url && <AvatarImage src={(assignedProfile as any).avatar_url} />}
                  <AvatarFallback className="text-[10px]">
                    {assigneeDisplayName ? assigneeInitial : <User className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className={`text-sm ${assigneeDisplayName ? "" : "italic text-muted-foreground"}`}>
                  {assigneeDisplayName || "Sem responsável"}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 px-6 py-4">
          <div className="space-y-6">
            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              {editingDesc && canEdit ? (
                <Textarea
                  value={editDesc}
                  onChange={(e) => { setEditDesc(e.target.value); setHasChanges(true); }}
                  onBlur={() => setEditingDesc(false)}
                  autoFocus
                  className="min-h-[80px] text-sm resize-y"
                />
              ) : (
                <p
                  className={`text-sm ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""} ${!editDesc ? "text-muted-foreground italic" : ""}`}
                  onClick={() => canEdit && setEditingDesc(true)}
                >
                  {editDesc || "Clique para adicionar descrição..."}
                </p>
              )}
            </div>

            {/* Priority, Due Date & Assignee */}
            {canEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prioridade</Label>
                  <Select value={editPriority} onValueChange={(v) => checkFieldChange("priority", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prazo</Label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => checkFieldChange("due_date", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* Media & Documents */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4" />
                <Label className="font-semibold">Mídias e Documentos</Label>
                {media.length > 0 && <span className="text-xs text-muted-foreground">({media.length})</span>}
              </div>

              {media.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {media.map((m) => (
                    <div key={m.id} className="relative group rounded-lg overflow-hidden border">
                      {m.file_type === "video" ? (
                        <video src={m.file_url} controls className="w-full h-24 object-cover" />
                      ) : m.file_type === "document" ? (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 bg-muted/50 hover:bg-muted transition-colors">
                          <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground">Abrir</span>
                        </a>
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
                {uploading ? "Enviando..." : "Adicionar mídias ou documentos"}
                <input type="file" accept="image/*,video/mp4,video/webm,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" multiple className="hidden" onChange={uploadMedia} disabled={uploading} />
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
                  className="h-9 text-sm"
                />
                <Button variant="outline" onClick={addCheckItem} className="h-9"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <Separator />

            {/* History timeline only */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4" />
                <Label className="font-semibold">Histórico</Label>
              </div>
              <div className="space-y-2">
                {history.filter((h) => h.action !== "Comentou").length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade</p>
                ) : (
                  history
                    .filter((h) => h.action !== "Comentou")
                    .map((h) => (
                      <div key={`h-${h.id}`} className="flex items-start gap-2 text-xs text-muted-foreground px-1">
                        <span className="font-medium">{displayName(h.profiles as any) === "Usuário" ? "Sistema" : displayName(h.profiles as any)}</span>
                        <span>— {h.action}</span>
                        <span className="ml-auto shrink-0">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Comments Panel - collapsible */}
        <div className="border-t bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={() => setCommentsOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <Send className="h-4 w-4" />
            <Label className="font-semibold text-sm cursor-pointer">Comentários</Label>
            <span className="text-xs text-muted-foreground">({comments.length})</span>
            <span className="ml-auto text-muted-foreground">
              {commentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {commentsOpen && (
            <div className="px-6 pb-3">
              <div className="flex gap-2 mb-3">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[50px] text-sm resize-none"
                />
                <Button size="sm" onClick={addComment} className="self-end"><Send className="h-4 w-4" /></Button>
              </div>

              <ScrollArea className="h-[200px] pr-3">
                <div className="space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum comentário ainda</p>
                  ) : (
                    [...comments]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((c) => (
                        <div key={`c-${c.id}`} className="bg-background border rounded-lg p-2.5 group">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-semibold">{displayName(c.profiles as any)}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
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
                            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex justify-start px-6 py-2 border-t shrink-0">
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
