import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, GripVertical, Calendar, ThumbsUp, RotateCcw, ImageIcon, Play, LayoutGrid, List, ArrowUpDown, Pencil, Check, X, Trash2, Palette, History, Undo2, Users, UserPlus, FileText, CheckSquare, Upload, Printer, MessageSquare } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import TaskDetail from "@/components/TaskDetail";
import PrintProjectView from "@/components/PrintProjectView";
import { useAppSettings } from "@/hooks/useAppSettings";

const COLOR_PALETTE = [
  "#94a3b8", "#3B82F6", "#22c55e", "#eab308",
  "#ef4444", "#a855f7", "#ec4899", "#f97316",
];

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  position: number;
  assigned_to: string | null;
  assignee_name: string | null;
  project_id: string;
  color: string | null;
}

interface Column {
  id: string;
  slug: string;
  label: string;
  color: string;
  position: number;
}

interface HistoryEntry {
  id: string;
  project_id: string;
  action: string;
  previous_data: any;
  new_data: any;
  user_id: string | null;
  created_at: string;
  profiles?: { full_name: string | null; nickname?: string | null } | null;
}

interface ProjectMember {
  id: string;
  user_id: string | null;
  role: string;
  status?: string;
  invited_email?: string | null;
  profiles?: { full_name: string | null; nickname?: string | null; email: string | null; avatar_url: string | null } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Projeto criado",
  update: "Projeto atualizado",
  archive: "Projeto arquivado",
  unarchive: "Projeto desarquivado",
  delete: "Projeto excluído",
  undo: "Alteração desfeita",
};
interface MediaInfo {
  file_url: string;
  file_type: string;
  count: number;
}

const DEFAULT_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer", color: "#94a3b8", position: 0 },
  { slug: "em_andamento", label: "Em Andamento", color: "#3B82F6", position: 1 },
  { slug: "concluido", label: "Concluído", color: "#22c55e", position: 2 },
  { slug: "aprovado", label: "Aprovado", color: "#16a34a", position: 3 },
];

const PRIORITY_COLORS: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/20 text-primary",
  alta: "bg-warning/20 text-warning",
  urgente: "bg-destructive/20 text-destructive",
};

export default function KanbanBoard() {
  const { id: projectId } = useParams<{ id: string }>();
  const { isAdmin, user, canEdit } = useAuth();
  const { toast } = useToast();
  const appSettings = useAppSettings();

  // Print
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedPrintIds, setSelectedPrintIds] = useState<Set<string>>(new Set());
  const [printMediaByTask, setPrintMediaByTask] = useState<Record<string, { id: string; file_url: string; file_name: string; file_type: string }[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [taskMedia, setTaskMedia] = useState<Record<string, MediaInfo>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [projectName, setProjectName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<string>("media");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<string>("a_fazer");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const [newCheckItems, setNewCheckItems] = useState<string[]>([]);
  const [newCheckInput, setNewCheckInput] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // Team management
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Inline column editing
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnLabel, setEditColumnLabel] = useState("");
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"kanban" | "lista">(() => {
    if (!projectId) return "kanban";
    return (localStorage.getItem(`view-mode-${projectId}`) as "kanban" | "lista") || "kanban";
  });
  const [sortPrazo, setSortPrazo] = useState<"asc" | "desc">(() =>
    (localStorage.getItem(`sort-prazo-${projectId}`) as "asc" | "desc") || "asc"
  );
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const loadColumns = useCallback(async () => {
    if (!projectId) return;
    const { data } = await (supabase.from as any)("project_columns")
      .select("*")
      .eq("project_id", projectId)
      .order("position");

    if (data && data.length > 0) {
      setColumns(data.map((c: any) => ({ id: c.id, slug: c.slug, label: c.label, color: c.color, position: c.position })));
    } else {
      // Create default columns
      const inserts = DEFAULT_COLUMNS.map((c) => ({
        project_id: projectId,
        slug: c.slug,
        label: c.label,
        color: c.color,
        position: c.position,
      }));
      const { data: created } = await (supabase.from as any)("project_columns").insert(inserts).select();
      if (created) {
        setColumns(created.map((c: any) => ({ id: c.id, slug: c.slug, label: c.label, color: c.color, position: c.position })));
      }
    }
  }, [projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    const { data: proj } = await supabase.from("projects").select("name, company_id, companies(name, logo_url)").eq("id", projectId).single();
    setProjectName(proj?.name || "");
    setCompanyName((proj?.companies as any)?.name || "");
    setCompanyLogo((proj?.companies as any)?.logo_url || null);
    const { data } = await supabase.from("tasks").select("*").eq("project_id", projectId).order("position");
    const taskList = ((data as any[]) || []).map((t) => ({ ...t, status: t.status || "a_fazer", color: t.color || null })) as Task[];
    setTasks(taskList);

    const taskIds = taskList.map((t) => t.id);
    if (taskIds.length > 0) {
      const [{ data: mediaData }, { data: commentData }] = await Promise.all([
        supabase
          .from("task_media")
          .select("task_id, file_url, file_type")
          .in("task_id", taskIds)
          .order("created_at"),
        supabase
          .from("task_comments")
          .select("task_id")
          .in("task_id", taskIds),
      ]);

      const mediaMap: Record<string, MediaInfo> = {};
      (mediaData || []).forEach((m) => {
        if (!mediaMap[m.task_id]) {
          mediaMap[m.task_id] = { file_url: m.file_url, file_type: m.file_type, count: 1 };
        } else {
          mediaMap[m.task_id].count++;
        }
      });
      setTaskMedia(mediaMap);

      const counts: Record<string, number> = {};
      (commentData || []).forEach((c: any) => {
        counts[c.task_id] = (counts[c.task_id] || 0) + 1;
      });
      setCommentCounts(counts);
    } else {
      setTaskMedia({});
      setCommentCounts({});
    }
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    const { data: rawMembers } = await (supabase.from as any)("project_members")
      .select("*")
      .eq("project_id", projectId);
    const list = rawMembers || [];
    const userIds = list.map((m: any) => m.user_id).filter(Boolean);
    let profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, email, avatar_url")
        .in("id", userIds);
      (profs || []).forEach((p: any) => { profilesById[p.id] = p; });
    }
    const enriched = list.map((m: any) => ({
      ...m,
      profiles: m.user_id ? (profilesById[m.user_id] || null) : null,
    }));
    setMembers(enriched);
  }, [projectId]);

  const inviteMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !projectId) return;
    setInviting(true);

    // Look up project's company id
    const { data: proj } = await supabase.from("projects").select("company_id").eq("id", projectId).single();
    const companyId = proj?.company_id;

    // Check if profile exists
    const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("email", email).maybeSingle();

    let userId: string | null = null;
    let isActive = false;

    if (profile && companyId) {
      // Check company access
      const { data: access } = await (supabase.from as any)("user_company_access")
        .select("id")
        .eq("user_id", profile.id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (access) {
        userId = profile.id;
        isActive = true;
      }
    }

    // Prevent duplicates
    const dup = members.some((m) =>
      (userId && m.user_id === userId) ||
      (!userId && (m.invited_email || "").toLowerCase() === email)
    );
    if (dup) {
      toast({ title: "Já é membro ou convidado", variant: "destructive" });
      setInviting(false);
      return;
    }

    const { error } = await (supabase.from as any)("project_members").insert({
      project_id: projectId,
      user_id: userId,
      invited_email: isActive ? null : email,
      status: isActive ? "ativo" : "pendente",
    });

    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
      setInviting(false);
      return;
    }

    setInviteEmail("");
    toast({
      title: isActive
        ? `${profile?.full_name || email} adicionado à equipe`
        : `Convite enviado para ${email}`,
      description: isActive ? undefined : "Aguardando o usuário ganhar acesso à empresa.",
    });
    setInviting(false);
    loadMembers();
  };

  const removeMember = async (memberId: string) => {
    await (supabase.from as any)("project_members").delete().eq("id", memberId);
    toast({ title: "Membro removido" });
    loadMembers();
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadColumns(); }, [loadColumns]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    if (!printOpen) return;
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length === 0) {
      setPrintMediaByTask({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("task_media")
        .select("id, task_id, file_url, file_name, file_type")
        .in("task_id", taskIds)
        .order("created_at");
      const map: Record<string, { id: string; file_url: string; file_name: string; file_type: string }[]> = {};
      (data || []).forEach((m: any) => {
        if (!map[m.task_id]) map[m.task_id] = [];
        map[m.task_id].push({ id: m.id, file_url: m.file_url, file_name: m.file_name, file_type: m.file_type });
      });
      setPrintMediaByTask(map);
    })();
  }, [printOpen, tasks]);

  const toggleViewMode = (mode: "kanban" | "lista") => {
    setViewMode(mode);
    if (projectId) localStorage.setItem(`view-mode-${projectId}`, mode);
  };

  const toggleSortPrazo = () => {
    const newDir = sortPrazo === "asc" ? "desc" : "asc";
    setSortPrazo(newDir);
    if (projectId) localStorage.setItem(`sort-prazo-${projectId}`, newDir);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    const newPos = result.destination.index;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, position: newPos } : t))
    );

    await (supabase.from("tasks").update as any)({ status: newStatus, position: newPos }).eq("id", taskId);
  };

  const createTask = async () => {
    if (!projectId) return;
    const colTasks = tasks.filter((t) => t.status === newStatus);
    const maxPos = colTasks.reduce((max, t) => Math.max(max, t.position), -1);
    const { data: created } = await (supabase.from("tasks") as any).insert({
      project_id: projectId,
      title: newTitle,
      description: newDesc || null,
      priority: newPriority,
      due_date: newDueDate || null,
      status: newStatus,
      position: maxPos + 1,
      created_by: user?.id,
      assigned_to: newAssignedTo && newAssignedTo !== "none" ? newAssignedTo : null,
      color: newColor,
    }).select().single();

    if (created) {
      // Create checklist items
      if (newCheckItems.length > 0) {
        const items = newCheckItems.map((title, i) => ({ task_id: created.id, title, position: i }));
        await supabase.from("task_checklists").insert(items);
      }
      // Upload files
      for (const file of newFiles) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const videoExts = ["mp4", "webm", "mov"];
        const docExts = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"];
        const fileType = videoExts.includes(ext) ? "video" : docExts.includes(ext) ? "document" : "image";
        const path = `task-media/${created.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("attachments").upload(path, file);
        if (!error) {
          const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
          await supabase.from("task_media").insert({ task_id: created.id, file_url: urlData.publicUrl, file_name: file.name, file_type: fileType });
        }
      }
    }

    setNewTaskOpen(false);
    setNewTitle(""); setNewDesc(""); setNewPriority("media"); setNewDueDate(""); setNewStatus("a_fazer");
    setNewAssignedTo(""); setNewColor(null); setNewCheckItems([]); setNewCheckInput(""); setNewFiles([]);
    toast({ title: "Tarefa criada" });
    load();
  };

  const approveTask = async (taskId: string) => {
    await (supabase.from("tasks").update as any)({ status: "aprovado" }).eq("id", taskId);
    toast({ title: "Tarefa aprovada!" });
    load();
  };

  const requestAdjust = async (taskId: string) => {
    await (supabase.from("tasks").update as any)({ status: "em_andamento" }).eq("id", taskId);
    toast({ title: "Ajuste solicitado — tarefa retornou para 'Em Andamento'" });
    load();
  };

  const matchesAssignee = (t: Task) => {
    if (assigneeFilter === "all") return true;
    if (assigneeFilter === "none") return !t.assigned_to && !t.assignee_name;
    return t.assigned_to === assigneeFilter;
  };

  const getColumnTasks = (slug: string) =>
    tasks.filter((t) => t.status === slug && matchesAssignee(t)).sort((a, b) => a.position - b.position);

  const getAssigneeDisplay = (task: Task): { name: string; avatarUrl?: string | null; initial: string } | null => {
    if (task.assigned_to) {
      const m = members.find((x) => x.user_id === task.assigned_to);
      const p: any = m?.profiles;
      const full = (p?.nickname?.trim()) || p?.full_name || p?.email || "";
      const first = full.split(" ")[0] || "?";
      return { name: first, avatarUrl: p?.avatar_url, initial: first.charAt(0).toUpperCase() };
    }
    if (task.assignee_name) {
      const first = task.assignee_name.split(" ")[0];
      return { name: first, avatarUrl: null, initial: first.charAt(0).toUpperCase() };
    }
    return null;
  };

  // Column management
  const saveColumnLabel = async (col: Column) => {
    if (!editColumnLabel.trim()) return;
    await (supabase.from as any)("project_columns").update({ label: editColumnLabel.trim() }).eq("id", col.id);
    setEditingColumnId(null);
    loadColumns();
  };

  const addColumn = async () => {
    if (!projectId) return;
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1);
    const slug = `coluna_${Date.now()}`;
    await (supabase.from as any)("project_columns").insert({
      project_id: projectId,
      slug,
      label: "Nova Coluna",
      color: "#6b7280",
      position: maxPos + 1,
    });
    loadColumns();
  };

  const deleteColumn = async (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    if (!col || columns.length <= 1) return;
    const firstOther = columns.find((c) => c.id !== colId);
    if (!firstOther) return;
    // Move tasks to first remaining column
    const colTasks = tasks.filter((t) => t.status === col.slug);
    for (const task of colTasks) {
      await (supabase.from("tasks").update as any)({ status: firstOther.slug }).eq("id", task.id);
    }
    await (supabase.from as any)("project_columns").delete().eq("id", colId);
    setDeleteColumnId(null);
    loadColumns();
    load();
  };

  const getColumnColor = (slug: string) => {
    const col = columns.find((c) => c.slug === slug);
    return col?.color || "#94a3b8";
  };

  const saveColumnColor = async (colId: string, color: string) => {
    await (supabase.from as any)("project_columns").update({ color }).eq("id", colId);
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, color } : c)));
  };

  const saveTaskColor = async (taskId: string, color: string | null) => {
    await (supabase.from("tasks").update as any)({ color }).eq("id", taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, color } : t)));
  };

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    const { data } = await (supabase.from as any)("project_history")
      .select("*, profiles:user_id(full_name, nickname)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory(data || []);
  }, [projectId]);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  const undoHistory = async (entry: HistoryEntry) => {
    if (!entry.previous_data || !projectId) return;
    // Restore previous data
    const updates: any = {};
    if (entry.previous_data.name !== undefined) updates.name = entry.previous_data.name;
    if (entry.previous_data.description !== undefined) updates.description = entry.previous_data.description;
    if (entry.previous_data.due_date !== undefined) updates.due_date = entry.previous_data.due_date;
    if (entry.previous_data.archived !== undefined) updates.archived = entry.previous_data.archived;

    if (Object.keys(updates).length === 0) return;

    await supabase.from("projects").update(updates).eq("id", projectId);
    await (supabase.from as any)("project_history").insert({
      project_id: projectId,
      action: "undo",
      previous_data: entry.new_data,
      new_data: entry.previous_data,
      user_id: user?.id,
    });

    if (updates.name) setProjectName(updates.name);
    toast({ title: "Alteração desfeita" });
    loadHistory();
    load();
  };

  const formatHistoryDetails = (entry: HistoryEntry) => {
    const parts: string[] = [];
    if (entry.previous_data?.name && entry.new_data?.name) {
      parts.push(`Nome: "${entry.previous_data.name}" → "${entry.new_data.name}"`);
    }
    if (entry.previous_data?.description !== undefined || entry.new_data?.description !== undefined) {
      parts.push("Descrição alterada");
    }
    if (entry.previous_data?.due_date !== undefined || entry.new_data?.due_date !== undefined) {
      const prev = entry.previous_data?.due_date ? new Date(entry.previous_data.due_date).toLocaleDateString("pt-BR") : "sem prazo";
      const next = entry.new_data?.due_date ? new Date(entry.new_data.due_date).toLocaleDateString("pt-BR") : "sem prazo";
      parts.push(`Prazo: ${prev} → ${next}`);
    }
    return parts.join(" | ") || ACTION_LABELS[entry.action] || entry.action;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            {companyName && <p className="text-xs text-muted-foreground">{companyName}</p>}
            <h2 className="text-2xl font-bold">{projectName}</h2>
          </div>
          {/* Team Avatars */}
          {members.filter((m) => m.status !== "pendente").length > 0 && (
            <TooltipProvider>
              <div className="flex -space-x-2">
                {members.filter((m) => m.status !== "pendente").slice(0, 5).map((m) => (
                  <Tooltip key={m.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7 border-2 border-background">
                        <AvatarImage src={(m.profiles as any)?.avatar_url || ""} />
                        <AvatarFallback className="text-[10px]">
                          {(((m.profiles as any)?.nickname?.trim()) || (m.profiles as any)?.full_name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent><p>{((m.profiles as any)?.nickname?.trim()) || (m.profiles as any)?.full_name || (m.profiles as any)?.email}</p></TooltipContent>
                  </Tooltip>
                ))}
                {members.filter((m) => m.status !== "pendente").length > 5 && (
                  <Avatar className="h-7 w-7 border-2 border-background">
                    <AvatarFallback className="text-[10px]">+{members.filter((m) => m.status !== "pendente").length - 5}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => toggleViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" /> Card
            </Button>
            <Button
              variant={viewMode === "lista" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => toggleViewMode("lista")}
            >
              <List className="h-4 w-4" /> Lista
            </Button>
          </div>
          {viewMode === "lista" && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={toggleSortPrazo}>
              <ArrowUpDown className="h-3.5 w-3.5" />
              Prazo {sortPrazo === "asc" ? "↑" : "↓"}
            </Button>
          )}
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {members
                .filter((m) => m.user_id && m.status !== "pendente")
                .map((m) => {
                  const p: any = m.profiles;
                  const name = (p?.nickname?.trim()) || p?.full_name || p?.email || "Sem nome";
                  return (
                    <SelectItem key={m.id} value={m.user_id as string}>
                      {name}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
          {/* Team Sheet */}
          <Sheet open={teamOpen} onOpenChange={setTeamOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" /> Equipe
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[450px]">
              <SheetHeader>
                <SheetTitle>Equipe do Projeto</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {canEdit && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="E-mail do usuário..."
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={inviteMember} disabled={inviting}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <ScrollArea className="h-[calc(100vh-160px)]">
                  <div className="space-y-2">
                    {members.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro adicionado</p>
                    )}
                    {members.map((m) => {
                      const isPending = m.status === "pendente";
                      const displayName = isPending
                        ? (m.invited_email || "Convidado")
                        : (((m.profiles as any)?.nickname?.trim()) || (m.profiles as any)?.full_name || "Sem nome");
                      const subtitle = isPending ? "Aguardando aprovação" : (m.profiles as any)?.email;
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={(m.profiles as any)?.avatar_url || ""} />
                            <AvatarFallback className="text-xs">
                              {(displayName || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                          </div>
                          {isPending ? (
                            <Badge variant="secondary" className="bg-warning/20 text-warning text-[10px] shrink-0">
                              Pendente
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/20 text-success text-[10px] shrink-0">
                              Ativo
                            </Badge>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember(m.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" /> Histórico
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[450px]">
              <SheetHeader>
                <SheetTitle>Histórico do Projeto</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)] mt-4 pr-4">
                <div className="space-y-3">
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro</p>
                  )}
                  {history.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{ACTION_LABELS[entry.action] || entry.action}</span>
                        {entry.previous_data && entry.action !== "create" && entry.action !== "delete" && (
                          <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => undoHistory(entry)}>
                            <Undo2 className="h-3 w-3" /> Desfazer
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatHistoryDetails(entry)}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{((entry.profiles as any)?.nickname?.trim()) || (entry.profiles as any)?.full_name || "Sistema"}</span>
                        <span>{new Date(entry.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              setSelectedPrintIds(new Set(tasks.map((t) => t.id)));
              setPrintOpen(true);
            }}
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          {canEdit && (
            <Button onClick={() => setNewTaskOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {viewMode === "lista" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {columns.map((col) => {
              const colTasks = tasks
                .filter((t) => t.status === col.slug && matchesAssignee(t))
                .sort((a, b) => {
                  if (a.due_date && b.due_date) {
                    const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                    return sortPrazo === "asc" ? diff : -diff;
                  }
                  if (!a.due_date && !b.due_date) return a.position - b.position;
                  return a.due_date ? -1 : 1;
                });

              return (
                <div key={col.slug} className="space-y-1 group">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    {editingColumnId === col.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editColumnLabel}
                          onChange={(e) => setEditColumnLabel(e.target.value)}
                          className="h-6 text-xs w-32"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveColumnLabel(col); if (e.key === "Escape") setEditingColumnId(null); }}
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => saveColumnLabel(col)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingColumnId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="h-4 w-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: col.color }} />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <div className="flex gap-1.5 items-center">
                              {COLOR_PALETTE.map((c) => (
                                <button key={c} className={`h-6 w-6 rounded-full border-2 ${col.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => saveColumnColor(col.id, c)} />
                              ))}
                              <label className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer" title="Cor personalizada">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                <input type="color" className="sr-only" value={col.color} onChange={(e) => saveColumnColor(col.id, e.target.value)} />
                              </label>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Badge
                          className="text-xs cursor-pointer"
                          variant="secondary"
                          style={{ backgroundColor: `${col.color}20`, color: col.color }}
                          onClick={() => { if (canEdit) { setEditingColumnId(col.id); setEditColumnLabel(col.label); } }}
                        >
                          {col.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({colTasks.length})</span>
                        {canEdit && columns.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => setDeleteColumnId(col.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <Droppable droppableId={col.slug}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="rounded-lg border divide-y min-h-[40px]">
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer ${snapshot.isDragging ? "bg-muted shadow-lg" : ""}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  borderLeft: task.color ? `4px solid ${task.color}` : undefined,
                                }}
                              >
                                <div {...provided.dragHandleProps} className="cursor-grab shrink-0">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                {canEdit && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="h-3.5 w-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: task.color || "transparent" }} />
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2" align="start">
                                      <div className="flex gap-1.5 items-center">
                                        <button className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground" onClick={() => saveTaskColor(task.id, null)} title="Sem cor" />
                                        {COLOR_PALETTE.map((c) => (
                                          <button key={c} className={`h-6 w-6 rounded-full border-2 ${task.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => saveTaskColor(task.id, c)} />
                                        ))}
                                        <label className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer" title="Cor personalizada">
                                          <Pencil className="h-3 w-3 text-muted-foreground" />
                                          <input type="color" className="sr-only" value={task.color || "#000000"} onChange={(e) => saveTaskColor(task.id, e.target.value)} />
                                        </label>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                <p
                                  className="flex-1 text-sm font-medium truncate hover:text-primary min-w-0"
                                  onClick={() => setSelectedTask(task.id)}
                                >
                                  {task.title}
                                </p>
                                {task.description && (
                                  <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[200px] shrink-0">
                                    {task.description}
                                  </span>
                                )}
                                {taskMedia[task.id] && (
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                                    <ImageIcon className="h-3 w-3" />{taskMedia[task.id].count}
                                  </span>
                                )}
                                {commentCounts[task.id] > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0" title="Comentários">
                                    <MessageSquare className="h-3 w-3" />{commentCounts[task.id]}
                                  </span>
                                )}
                                <Badge className={`text-[10px] shrink-0 ${PRIORITY_COLORS[task.priority] || ""}`} variant="secondary">
                                  {task.priority}
                                </Badge>
                                {task.due_date && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" onClick={() => setSelectedTask(task.id)}>
                                    <Calendar className="h-3 w-3" />
                                    {new Date(task.due_date).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                                {(() => {
                                  const a = getAssigneeDisplay(task);
                                  if (!a) return null;
                                  return (
                                    <span className="flex items-center gap-1 shrink-0" title={a.name}>
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={a.avatarUrl || ""} />
                                        <AvatarFallback className="text-[9px]">{a.initial}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">{a.name}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colTasks.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            Nenhuma tarefa
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setNewStatus(col.slug); setNewTaskOpen(true); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addColumn}>
                <Plus className="h-3 w-3" /> Adicionar coluna
              </Button>
            )}
          </div>
        </DragDropContext>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-proximity scrollbar-hide px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {columns.map((col) => (
              <div key={col.slug} className="group rounded-lg p-3 min-h-[200px] min-w-[280px] w-[280px] shrink-0 snap-start flex flex-col" style={{ backgroundColor: `${col.color}10` }}>
                <div className="flex items-center justify-between mb-3">
                  {editingColumnId === col.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editColumnLabel}
                        onChange={(e) => setEditColumnLabel(e.target.value)}
                        className="h-6 text-xs w-24"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveColumnLabel(col); if (e.key === "Escape") setEditingColumnId(null); }}
                      />
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => saveColumnLabel(col)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-4 w-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: col.color }} />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="flex gap-1.5 items-center">
                            {COLOR_PALETTE.map((c) => (
                              <button key={c} className={`h-6 w-6 rounded-full border-2 ${col.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => saveColumnColor(col.id, c)} />
                            ))}
                            <label className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer" title="Cor personalizada">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                              <input type="color" className="sr-only" value={col.color} onChange={(e) => saveColumnColor(col.id, e.target.value)} />
                            </label>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <h3
                        className="font-semibold text-sm cursor-pointer hover:text-primary"
                        onClick={() => { if (canEdit) { setEditingColumnId(col.id); setEditColumnLabel(col.label); } }}
                      >
                        {col.label}
                      </h3>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">{getColumnTasks(col.slug).length}</Badge>
                    {canEdit && columns.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => setDeleteColumnId(col.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <Droppable droppableId={col.slug}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[100px]">
                      {getColumnTasks(col.slug).map((task, index) => {
                        const media = taskMedia[task.id];
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-card rounded-lg border overflow-hidden shadow-sm transition-shadow ${
                                  snapshot.isDragging ? "shadow-lg" : "hover:shadow-md"
                                }`}
                                style={{
                                  ...provided.draggableProps.style,
                                  borderLeft: task.color ? `4px solid ${task.color}` : undefined,
                                }}
                              >
                                {media && (
                                  <div className="relative h-28 w-full cursor-pointer" onClick={() => setSelectedTask(task.id)}>
                                    {media.file_type === "video" ? (
                                      <div className="relative h-full w-full bg-muted flex items-center justify-center">
                                        <Play className="h-8 w-8 text-muted-foreground" />
                                      </div>
                                    ) : (
                                      <img src={media.file_url} alt="" className="w-full h-full object-cover" />
                                    )}
                                    {media.count > 1 && (
                                      <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 bg-background/80 backdrop-blur-sm">
                                        <ImageIcon className="h-3 w-3 mr-0.5" />+{media.count - 1}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <div className="p-3">
                                  <div className="flex items-start gap-2">
                                    <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm cursor-pointer hover:text-primary truncate" onClick={() => setSelectedTask(task.id)}>
                                        {task.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || ""}`} variant="secondary">
                                          {task.priority}
                                        </Badge>
                                        {task.due_date && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(task.due_date).toLocaleDateString("pt-BR")}
                                          </span>
                                        )}
                                        {commentCounts[task.id] > 0 && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Comentários">
                                            <MessageSquare className="h-3 w-3" />{commentCounts[task.id]}
                                          </span>
                                        )}
                                        {(() => {
                                          const a = getAssigneeDisplay(task);
                                          if (!a) return null;
                                          return (
                                            <span className="flex items-center gap-1" title={a.name}>
                                              <Avatar className="h-5 w-5">
                                                <AvatarImage src={a.avatarUrl || ""} />
                                                <AvatarFallback className="text-[9px]">{a.initial}</AvatarFallback>
                                              </Avatar>
                                              <span className="text-xs text-muted-foreground truncate max-w-[80px]">{a.name}</span>
                                            </span>
                                          );
                                        })()}
                                        {canEdit && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button className="h-3.5 w-3.5 rounded-full shrink-0 border border-border ml-auto" style={{ backgroundColor: task.color || "transparent" }} />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2" align="start">
                                              <div className="flex gap-1.5 items-center">
                                                <button className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground" onClick={() => saveTaskColor(task.id, null)} title="Sem cor" />
                                                {COLOR_PALETTE.map((c) => (
                                                  <button key={c} className={`h-6 w-6 rounded-full border-2 ${task.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => saveTaskColor(task.id, c)} />
                                                ))}
                                                <label className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer" title="Cor personalizada">
                                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                                  <input type="color" className="sr-only" value={task.color || "#000000"} onChange={(e) => saveTaskColor(task.id, e.target.value)} />
                                                </label>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                      {!isAdmin && task.status === "concluido" && (
                                        <div className="flex gap-2 mt-2">
                                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => approveTask(task.id)}>
                                            <ThumbsUp className="h-3 w-3" /> Aprovar
                                          </Button>
                                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => requestAdjust(task.id)}>
                                            <RotateCcw className="h-3 w-3" /> Ajuste
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                {canEdit && (
                  <div className="flex justify-center mt-auto pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setNewStatus(col.slug); setNewTaskOpen(true); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="flex items-center justify-center shrink-0 min-h-[200px]">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border-2 border-dashed border-muted text-muted-foreground hover:text-foreground hover:border-foreground" onClick={addColumn}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DragDropContext>
      )}

      {/* New Task Dialog */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título da tarefa" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Coluna</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                    <SelectTrigger><SelectValue placeholder="Selecione um responsável..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {members.filter((m) => m.user_id && m.status !== "pendente").map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id!}>
                          {((m.profiles as any)?.nickname?.trim()) || (m.profiles as any)?.full_name || (m.profiles as any)?.email || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {members.filter((m) => m.user_id && m.status !== "pendente").length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum membro ativo. Adicione membros à equipe do projeto.
                    </p>
                  )}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Cor da tarefa</Label>
                <div className="flex gap-1.5 items-center">
                  <button
                    className={`h-6 w-6 rounded-full border-2 ${!newColor ? "border-foreground" : "border-transparent"} bg-muted`}
                    onClick={() => setNewColor(null)}
                    title="Sem cor"
                  />
                  {COLOR_PALETTE.map((c) => (
                    <button key={c} className={`h-6 w-6 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setNewColor(c)} />
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <Label>Checklist</Label>
                {newCheckItems.length > 0 && (
                  <div className="space-y-1">
                    {newCheckItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1">{item}</span>
                        <button onClick={() => setNewCheckItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo item..."
                    value={newCheckInput}
                    onChange={(e) => setNewCheckInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCheckInput.trim()) {
                        e.preventDefault();
                        setNewCheckItems((prev) => [...prev, newCheckInput.trim()]);
                        setNewCheckInput("");
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => { if (newCheckInput.trim()) { setNewCheckItems((prev) => [...prev, newCheckInput.trim()]); setNewCheckInput(""); } }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Mídias e Documentos</Label>
                {newFiles.length > 0 && (
                  <div className="space-y-1">
                    {newFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <button onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Adicionar arquivos
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={createTask} disabled={!newTitle}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTask && (
        <TaskDetail taskId={selectedTask} onClose={() => { setSelectedTask(null); load(); }} onTaskDeleted={load} projectMembers={members} />
      )}

      <AlertDialog open={!!deleteColumnId} onOpenChange={(open) => { if (!open) setDeleteColumnId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna "{columns.find((c) => c.id === deleteColumnId)?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              As tarefas desta coluna serão movidas para a primeira coluna restante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteColumnId && deleteColumn(deleteColumnId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print selection dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preparar impressão</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedPrintIds(new Set(tasks.map((t) => t.id)))}>
              Selecionar todas
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedPrintIds(new Set())}>
              Limpar seleção
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedPrintIds.size} de {tasks.length} selecionadas
            </span>
          </div>
          <ScrollArea className="flex-1 pr-3 -mr-3">
            <div className="space-y-4">
              {columns.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.slug);
                if (colTasks.length === 0) return null;
                const allSelected = colTasks.every((t) => selectedPrintIds.has(t.id));
                return (
                  <div key={col.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          setSelectedPrintIds((prev) => {
                            const next = new Set(prev);
                            colTasks.forEach((t) => {
                              if (checked) next.add(t.id);
                              else next.delete(t.id);
                            });
                            return next;
                          });
                        }}
                      />
                      <span className="font-medium text-sm" style={{ color: col.color }}>
                        {col.label}
                      </span>
                      <span className="text-xs text-muted-foreground">({colTasks.length})</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {colTasks.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        >
                          <Checkbox
                            checked={selectedPrintIds.has(t.id)}
                            onCheckedChange={(checked) => {
                              setSelectedPrintIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(t.id);
                                else next.delete(t.id);
                                return next;
                              });
                            }}
                          />
                          <span className="flex-1">{t.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>Cancelar</Button>
            <Button
              disabled={selectedPrintIds.size === 0}
              onClick={() => {
                setPrintOpen(false);
                setTimeout(() => window.print(), 200);
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintProjectView
        projectName={projectName}
        companyName={companyName}
        appName={appSettings.app_name}
        logoUrl={appSettings.logo_url}
        tasks={tasks.filter((t) => selectedPrintIds.has(t.id))}
        columns={columns}
        members={members}
        mediaByTask={printMediaByTask}
      />
    </div>
  );
}
