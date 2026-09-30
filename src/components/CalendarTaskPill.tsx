import { cn } from "@/lib/utils";
import { TaskDualAvatar } from "@/components/TaskDualAvatar";
import { Check, CornerDownRight } from "lucide-react";
import { formatDueTime } from "@/lib/taskReminders";

export type CalendarTaskLike = {
  id: string;
  title: string;
  due_time?: string | null;
  priority: string;
  assigned_to?: string | null;
  assignee_name?: string | null;
  status: string;
  parent_task_id?: string | null;
  projects?: { companies?: ({ name?: string | null; logo_url?: string | null } & Record<string, unknown>) | null } | null;
  assignee?: { full_name?: string | null; nickname?: string | null; avatar_url?: string | null } | null;
};

/**
 * Pílula de tarefa usada nas grades de calendário (Mês/Semana). Compartilhada
 * entre a aba Calendário e a aba Minhas Tarefas — os dois DEVEM usar este
 * mesmo componente pra nunca ficarem visualmente dessincronizados.
 */
export function CalendarTaskPill<T extends CalendarTaskLike>({
  task,
  color,
  colorMode,
  priorityColor,
  onOpen,
  onToggleDone,
}: {
  task: T;
  color: string;
  colorMode: "empresa" | "responsavel";
  priorityColor: Record<string, string>;
  onOpen: (task: T) => void;
  onToggleDone: (task: T, e?: React.MouseEvent) => void;
}) {
  const assigneeName = (task.assignee as any)?.nickname?.trim() || task.assignee?.full_name || task.assignee_name || null;
  const done = task.status === "concluido";
  const companyLogo = task.projects?.companies?.logo_url;
  const companyName = task.projects?.companies?.name;
  const hasAssignee = !!(task.assigned_to || task.assignee_name);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(task); }}
      className="relative w-full text-left px-2.5 py-1.5 pb-6 rounded-md text-[13px] flex items-start gap-2 overflow-hidden group/pill"
      style={{ backgroundColor: `${color}30`, boxShadow: `inset 3px 0 0 0 ${color}` }}
      title={task.title}
    >
      <span
        role="button"
        onClick={(e) => onToggleDone(task, e)}
        className={cn(
          "relative h-5 w-5 md:h-3.5 md:w-3.5 mt-0.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors bg-background/70",
          "before:content-[''] before:absolute before:-inset-1.5 md:before:hidden",
          done ? "bg-primary border-primary" : "border-muted-foreground/50 hover:border-primary",
        )}
        title={done ? "Marcar como não concluída" : "Marcar como concluída"}
      >
        {done && <Check className="h-3.5 w-3.5 md:h-2.5 md:w-2.5 text-primary-foreground" strokeWidth={3} />}
      </span>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-2", priorityColor[task.priority])} />
      {task.parent_task_id && (
        <span title="Subtarefa" className="shrink-0 mt-0.5"><CornerDownRight className="h-3 w-3" /></span>
      )}
      {/* Título e horário ocupam a linha inteira que sobra — checkbox e
          bolinha de prioridade são os únicos irmãos dessa coluna. A foto fica
          fora do fluxo (canto inferior esquerdo, position: absolute), então
          não disputa largura com o texto. pb-6 no card garante respiro pra
          ela nunca ficar em cima do horário ou de um título de 2 linhas. */}
      <div className="min-w-0 flex-1 flex flex-col">
        <span className={cn("line-clamp-2 leading-snug break-normal", done && "line-through opacity-60")}>
          {task.title}
        </span>
        {task.due_time && (
          <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{formatDueTime(task.due_time)}</span>
        )}
      </div>
      {colorMode === "responsavel" && hasAssignee && (
        <TaskDualAvatar
          primaryUrl={task.assignee?.avatar_url}
          primaryName={assigneeName}
          secondaryUrl={companyLogo}
          size="h-6 w-6"
          className="absolute left-1.5 bottom-1 z-10"
        />
      )}
      {colorMode === "empresa" && companyLogo && (
        <TaskDualAvatar
          primaryUrl={companyLogo}
          primaryName={companyName}
          secondaryUrl={hasAssignee ? task.assignee?.avatar_url : null}
          size="h-6 w-6"
          className="absolute left-1.5 bottom-1 z-10"
        />
      )}
    </button>
  );
}

export default CalendarTaskPill;
