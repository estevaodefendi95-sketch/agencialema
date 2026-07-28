import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, CheckSquare, History, Image, Upload, X, Trash2, Pencil, Save, FileText, Download, ChevronDown, ChevronUp, User, Check, Clock, ListTree } from "lucide-react";
import { REMINDER_OPTIONS } from "@/lib/taskReminders";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";

const DONE_LIKE_STATUSES = ["aprovado", "concluido"];

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
  /**
   * user_ids com acesso liberado à empresa do projeto — quando informado,
   * restringe as listas de SELEÇÃO de responsável (não afeta a exibição do
   * responsável já atribuído, mesmo que o acesso dele tenha sido revogado
   * depois). Sem essa prop, nenhuma restrição é aplicada.
   */
  companyAccessUserIds?: Set<string>;
}

interface Comment { id: string; content: string; created_at: string; user_id: string; profiles?: { full_name: string | null; nickname?: string | null } | null; }
interface ChecklistItem { id: string; title: string; completed: boolean; position: number; }
interface HistoryItem { id: string; action: string; details: any; created_at: string; profiles?: { full_name: string | null; nickname?: string | null } | null; }

const displayName = (p?: { full_name?: string | null; nickname?: string | null } | null) =>
  p?.nickname?.trim() || p?.full_name || "Usuário";
interface MediaItem { id: string; file_url: string; file_name: string; file_type: string; created_at: string; }

export default function TaskDetail({ taskId, onClose, onTaskDeleted, projectMembers = [], companyAccessUserIds }: Props) {
  const assignableMembers = companyAccessUserIds
    ? projectMembers.filter((m) => m.user_id && companyAccessUserIds.has(m.user_id))
    : projectMembers;
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
  const [hasDueTime, setHasDueTime] = useState(false);
  const [editDueTime, setEditDueTime] = useState("");
  const [editReminderMinutes, setEditReminderMinutes] = useState("none");
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

  // Activity panel (comentários + histórico intercalados)
  const [activityOpen, setActivityOpen] = useState(false);
  const activityBottomRef = useRef<HTMLDivElement>(null);

  // Subtarefas
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState("");
  const [newSubtaskPriority, setNewSubtaskPriority] = useState("media");
  const [newSubtaskDue, setNewSubtaskDue] = useState("");
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [viewingSubtaskId, setViewingSubtaskId] = useState<string | null>(null);

  const load = async () => {
    const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    setTask(t);
    if (t) {
      setEditTitle(t.title);
      setEditDesc(t.description || "");
      setEditPriority(t.priority);
      setEditDueDate(t.due_date || "");
      setHasDueTime(!!t.due_time);
      setEditDueTime(t.due_time ? t.due_time.slice(0, 5) : "");
      setEditReminderMinutes(t.reminder_minutes_before != null ? String(t.reminder_minutes_before) : "none");
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

    const { data: st } = await supabase
      .from("tasks")
      .select("id, title, status, priority, assigned_to, assignee_name")
      .eq("parent_task_id", taskId)
      .order("created_at", { ascending: true });
    setSubtasks(st || []);
  };

  useEffect(() => { load(); }, [taskId]);

  useEffect(() => {
    if (activityOpen) activityBottomRef.current?.scrollIntoView({ block: "end" });
  }, [activityOpen, comments.length, history.length]);

  // Save task edits
  const saveTaskEdits = async () => {
    if (!task || !user) return;
    const updates: any = {};
    const changes: string[] = [];
    if (editTitle !== task.title) { updates.title = editTitle; changes.push(`Título: "${task.title}" → "${editTitle}"`); }
    if (editDesc !== (task.description || "")) { updates.description = editDesc || null; changes.push("Descrição atualizada"); }
    if (editPriority !== task.priority) { updates.priority = editPriority; changes.push(`Prioridade: ${task.priority} → ${editPriority}`); }
    if (editDueDate !== (task.due_date || "")) { updates.due_date = editDueDate || null; changes.push("Prazo atualizado"); }

    const newDueTime = hasDueTime && editDueTime ? editDueTime : null;
    const currentDueTime = task.due_time ? task.due_time.slice(0, 5) : null;
    if (newDueTime !== currentDueTime) { updates.due_time = newDueTime; changes.push("Horário atualizado"); }

    const newReminder = newDueTime && editReminderMinutes !== "none" ? parseInt(editReminderMinutes, 10) : null;
    if (newReminder !== (task.reminder_minutes_before ?? null)) { updates.reminder_minutes_before = newReminder; changes.push("Lembrete atualizado"); }

    // Se prazo/horário/lembrete mudou e já existia um lembrete enviado, reseta pra disparar de novo.
    if ((updates.due_date !== undefined || updates.due_time !== undefined || updates.reminder_minutes_before !== undefined) && task.reminder_sent_at) {
      updates.reminder_sent_at = null;
    }

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
    // task_history tem ON DELETE CASCADE em task_id, então some junto com a
    // tarefa — registra a exclusão em project_history (que sobrevive) pra
    // aparecer no Histórico do Projeto mesmo depois que a tarefa não existe mais.
    if (task.project_id) {
      await (supabase.from as any)("project_history").insert({
        project_id: task.project_id,
        action: "delete_task",
        previous_data: { title: task.title },
        user_id: user?.id,
      });
    }
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
    if (!activityOpen) setActivityOpen(true);
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

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);

    for (const file of list) {
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
  };

  const uploadMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) uploadFiles(files);
    e.target.value = "";
  };

  // Cola uma imagem do clipboard (Ctrl+V) direto como anexo, sem precisar
  // abrir o seletor de arquivos.
  const handleMediaPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const images: File[] = [];
    Array.from(items).forEach((item) => {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    });
    if (images.length > 0) {
      e.preventDefault();
      uploadFiles(images);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim() || !user || !task) return;
    setSavingSubtask(true);

    let initialStatus = "a_fazer";
    if (task.project_id) {
      const { data: cols } = await supabase
        .from("project_columns")
        .select("slug")
        .eq("project_id", task.project_id)
        .order("position", { ascending: true })
        .limit(1);
      initialStatus = cols?.[0]?.slug || "a_fazer";
    }

    const { error } = await supabase.from("tasks").insert({
      project_id: task.project_id,
      parent_task_id: taskId,
      title: newSubtaskTitle.trim(),
      priority: newSubtaskPriority,
      due_date: newSubtaskDue || null,
      assigned_to: newSubtaskAssignee || user.id,
      status: initialStatus,
      created_by: user.id,
      position: 0,
    } as any);

    setSavingSubtask(false);
    if (error) {
      toast({ title: "Erro ao criar subtarefa", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Subtarefa criada" });
    setNewSubtaskTitle(""); setNewSubtaskAssignee(""); setNewSubtaskPriority("media"); setNewSubtaskDue("");
    setAddingSubtask(false);
    load();
  };

  if (!task) return null;

  const completedCount = checklist.filter((c) => c.completed).length;
  const priorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

  // Feed único de atividade: comentários reais + histórico (exceto "Comentou",
  // que já é representado pelo próprio comentário — evita duplicar), em ordem
  // cronológica crescente (mais recente embaixo, como uma timeline de conversa).
  type ActivityItem =
    | { kind: "comment"; id: string; created_at: string; comment: Comment }
    | { kind: "history"; id: string; created_at: string; entry: HistoryItem };
  const activity: ActivityItem[] = [
    ...comments.map((c): ActivityItem => ({ kind: "comment", id: `c-${c.id}`, created_at: c.created_at, comment: c })),
    ...history
      .filter((h) => h.action !== "Comentou")
      .map((h): ActivityItem => ({ kind: "history", id: `h-${h.id}`, created_at: h.created_at, entry: h })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
    <>
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
                    {assignableMembers.map((m) => {
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

            <Separator />

            {/* Subtarefas */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListTree className="h-4 w-4" />
                <Label className="font-semibold">Subtarefas</Label>
                {subtasks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({subtasks.filter((st) => DONE_LIKE_STATUSES.includes(st.status)).length}/{subtasks.length})
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1 mb-2">
                  {subtasks.map((st) => {
                    const isDone = DONE_LIKE_STATUSES.includes(st.status);
                    const profile = st.assigned_to ? projectMembers.find((m) => m.user_id === st.assigned_to)?.profiles : null;
                    const name = (profile as any)?.nickname?.trim() || profile?.full_name || st.assignee_name || null;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setViewingSubtaskId(st.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                      >
                        <Checkbox checked={isDone} className="pointer-events-none shrink-0" />
                        <span className={`text-sm flex-1 min-w-0 truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                          {st.title}
                        </span>
                        {(st.assigned_to || st.assignee_name) && (
                          <AssigneeAvatar url={(profile as any)?.avatar_url} name={name} className="h-5 w-5 shrink-0" />
                        )}
                        <Badge variant="outline" className="text-[10px] shrink-0">{priorityLabels[st.priority] || st.priority}</Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              {canEdit && (
                addingSubtask ? (
                  <div className="border rounded-lg p-3 space-y-2">
                    <Input
                      placeholder="Título da subtarefa"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className="h-9 text-sm"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newSubtaskAssignee || (user?.id ?? "")} onValueChange={setNewSubtaskAssignee}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Responsável" /></SelectTrigger>
                        <SelectContent>
                          {user && (
                            <SelectItem value={user.id}>
                              <span className="flex items-center gap-2"><AssigneeAvatar name="Eu" />Eu mesmo</span>
                            </SelectItem>
                          )}
                          {assignableMembers.filter((m) => m.user_id !== user?.id).map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              <span className="flex items-center gap-2">
                                <AssigneeAvatar url={(m.profiles as any)?.avatar_url} name={(m.profiles as any)?.nickname || (m.profiles as any)?.full_name} />
                                {(m.profiles as any)?.nickname || (m.profiles as any)?.full_name || "Sem nome"}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newSubtaskPriority} onValueChange={setNewSubtaskPriority}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="date"
                      value={newSubtaskDue}
                      onChange={(e) => setNewSubtaskDue(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(""); setNewSubtaskAssignee(""); setNewSubtaskPriority("media"); setNewSubtaskDue(""); }}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={addSubtask} disabled={!newSubtaskTitle.trim() || savingSubtask}>
                        {savingSubtask ? "Salvando..." : "Adicionar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddingSubtask(true)}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar subtarefa
                  </Button>
                )
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

                <div className="col-span-2 flex items-center gap-2">
                  <Switch
                    checked={hasDueTime}
                    onCheckedChange={(checked) => {
                      setHasDueTime(checked);
                      if (!checked) { setEditDueTime(""); setEditReminderMinutes("none"); }
                      setHasChanges(true);
                    }}
                  />
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Definir horário
                  </Label>
                </div>

                {hasDueTime && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input
                      type="time"
                      value={editDueTime}
                      onChange={(e) => { setEditDueTime(e.target.value); setHasChanges(true); }}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                {hasDueTime && editDueTime && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notificar</Label>
                    <Select value={editReminderMinutes} onValueChange={(v) => { setEditReminderMinutes(v); setHasChanges(true); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REMINDER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Media & Documents */}
            <div tabIndex={0} onPaste={handleMediaPaste} className="outline-none">
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
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={m.file_url}
                          download={m.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-background/80 backdrop-blur-sm border border-border rounded-full p-0.5 hover:bg-background"
                          title="Baixar"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                        {canEdit && (
                          <button
                            onClick={() => deleteMedia(m)}
                            className="bg-destructive text-destructive-foreground rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{m.file_name}</p>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Adicionar mídias ou documentos (ou cole uma imagem com Ctrl+V)"}
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

          </div>
        </ScrollArea>

        {/* Atividade: comentários e histórico intercalados em ordem cronológica */}
        <div className="border-t bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={() => setActivityOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <History className="h-4 w-4" />
            <Label className="font-semibold text-sm cursor-pointer">Atividade</Label>
            <span className="text-xs text-muted-foreground">({activity.length})</span>
            <span className="ml-auto text-muted-foreground">
              {activityOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {activityOpen && (
            <div className="px-6 pb-3">
              <ScrollArea className="h-[240px] pr-3 mb-3">
                <div className="space-y-2">
                  {activity.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Nenhuma atividade ainda</p>
                  ) : (
                    activity.map((item) =>
                      item.kind === "history" ? (
                        <div key={item.id} className="flex items-start gap-2 text-xs text-muted-foreground px-1 py-1">
                          <span className="font-medium">{displayName(item.entry.profiles as any) === "Usuário" ? "Sistema" : displayName(item.entry.profiles as any)}</span>
                          <span>— {item.entry.action}</span>
                          <span className="ml-auto shrink-0">{new Date(item.entry.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ) : (
                        <div key={item.id} className="bg-background border rounded-lg p-2.5 group">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-semibold">{displayName(item.comment.profiles as any)}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">{new Date(item.comment.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              {(item.comment.user_id === user?.id || isAdmin) && (
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.comment.user_id === user?.id && (
                                    <button onClick={() => { setEditingCommentId(item.comment.id); setEditCommentContent(item.comment.content); }} className="text-muted-foreground hover:text-foreground">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button onClick={() => deleteComment(item.comment.id)} className="text-muted-foreground hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {editingCommentId === item.comment.id ? (
                            <div className="flex gap-2">
                              <Textarea
                                value={editCommentContent}
                                onChange={(e) => setEditCommentContent(e.target.value)}
                                className="min-h-[40px] text-sm flex-1"
                                autoFocus
                              />
                              <div className="flex flex-col gap-1">
                                <Button size="sm" onClick={() => updateComment(item.comment.id)}><Save className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{item.comment.content}</p>
                          )}
                        </div>
                      ),
                    )
                  )}
                  <div ref={activityBottomRef} />
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[50px] text-sm resize-none"
                />
                <Button size="sm" onClick={addComment} className="self-end"><Send className="h-4 w-4" /></Button>
              </div>
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
    {viewingSubtaskId && (
      <TaskDetail
        taskId={viewingSubtaskId}
        onClose={() => { setViewingSubtaskId(null); load(); }}
        onTaskDeleted={() => { setViewingSubtaskId(null); load(); }}
        projectMembers={projectMembers}
        companyAccessUserIds={companyAccessUserIds}
      />
    )}
    </>
  );
}
