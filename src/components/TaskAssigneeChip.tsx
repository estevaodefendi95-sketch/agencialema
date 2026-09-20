import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { cn } from "@/lib/utils";

/**
 * Avatar + nome do responsável de uma tarefa, com a mesma prioridade de
 * nome usada em todo o app (apelido > nome completo > nome livre).
 * Compartilhado entre o Dia do TaskCalendar e o Dia de MyTasks pra não
 * ficarem dessincronizados.
 */
export function TaskAssigneeChip({
  assignee,
  assigneeName,
  className,
}: {
  assignee?: { full_name?: string | null; nickname?: string | null; avatar_url?: string | null } | null;
  assigneeName?: string | null;
  className?: string;
}) {
  const name = assignee?.nickname?.trim() || assignee?.full_name || assigneeName || null;
  if (!name) return null;

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <AssigneeAvatar url={assignee?.avatar_url} name={name} />
      <span>{name}</span>
    </span>
  );
}

export default TaskAssigneeChip;
