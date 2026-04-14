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
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, GripVertical, Calendar, MessageSquare, CheckSquare, ThumbsUp, RotateCcw } from "lucide-react";
import TaskDetail from "@/components/TaskDetail";

type TaskStatus = "a_fazer" | "em_andamento" | "concluido" | "aprovado";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  position: number;
  assigned_to: string | null;
  project_id: string;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "a_fazer", label: "A Fazer", color: "bg-muted" },
  { id: "em_andamento", label: "Em Andamento", color: "bg-primary/10" },
  { id: "concluido", label: "Concluído", color: "bg-success/10" },
  { id: "aprovado", label: "Aprovado", color: "bg-success/20" },
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<string>("media");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("a_fazer");

  const load = useCallback(async () => {
    if (!projectId) return;
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    setProjectName(proj?.name || "");
    const { data } = await supabase.from("tasks").select("*").eq("project_id", projectId).order("position");
    setTasks((data as Task[]) || []);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const newPos = result.destination.index;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, position: newPos } : t))
    );

    await supabase.from("tasks").update({ status: newStatus, position: newPos }).eq("id", taskId);
  };

  const createTask = async () => {
    if (!projectId) return;
    const maxPos = tasks.filter((t) => t.status === newStatus).reduce((max, t) => Math.max(max, t.position), -1);
    await supabase.from("tasks").insert({
      project_id: projectId,
      title: newTitle,
      description: newDesc || null,
      priority: newPriority as any,
      due_date: newDueDate || null,
      status: newStatus,
      position: maxPos + 1,
      created_by: user?.id,
    });
    setNewTaskOpen(false);
    setNewTitle(""); setNewDesc(""); setNewPriority("media"); setNewDueDate(""); setNewStatus("a_fazer");
    toast({ title: "Tarefa criada" });
    load();
  };

  const approveTask = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "aprovado" as any }).eq("id", taskId);
    toast({ title: "Tarefa aprovada!" });
    load();
  };

  const requestAdjust = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "em_andamento" as any }).eq("id", taskId);
    toast({ title: "Ajuste solicitado — tarefa retornou para 'Em Andamento'" });
    load();
  };

  const getColumnTasks = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{projectName}</h2>
        {isAdmin && (
          <Button onClick={() => setNewTaskOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-lg p-3 ${col.color} min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <Badge variant="secondary" className="text-xs">{getColumnTasks(col.id).length}</Badge>
              </div>
              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[100px]">
                    {getColumnTasks(col.id).map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-card rounded-lg border p-3 shadow-sm transition-shadow ${
                              snapshot.isDragging ? "shadow-lg" : "hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className="font-medium text-sm cursor-pointer hover:text-primary truncate"
                                  onClick={() => setSelectedTask(task.id)}
                                >
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
                                </div>
                                {/* Approval buttons for clients on "concluido" tasks */}
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
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* New Task Dialog */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
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
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={createTask} disabled={!newTitle}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail */}
      {selectedTask && (
        <TaskDetail taskId={selectedTask} onClose={() => { setSelectedTask(null); load(); }} />
      )}
    </div>
  );
}
