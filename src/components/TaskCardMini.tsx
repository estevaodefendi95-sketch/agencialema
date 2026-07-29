import type { ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";

// Corpo compartilhado do card de tarefa (Kanban e Minhas Tarefas, visão
// Cards) — título, linha de badges (prioridade/prazo/meta, montada por
// quem chama) e a linha do responsável, sempre na mesma posição relativa:
// própria linha, abaixo da linha de badges, avatar à esquerda seguido do
// nome. Não inclui o wrapper de drag-and-drop nem blocos específicos de
// cada tela (preview de mídia, botões de aprovar/ajustar) — esses
// continuam em cada arquivo, compostos ao redor deste componente.

interface AssigneeInfo {
  avatarUrl?: string | null;
  name: string;
}

interface TaskCardMiniProps {
  title: string;
  isSubtask?: boolean;
  completed?: boolean;
  onTitleClick?: () => void;
  /** Slot ao lado do título (ex: botão de mostrar/ocultar mídia). */
  titleTrailingSlot?: ReactNode;
  description?: string | null;
  /** Conteúdo da linha de badges (prioridade, prazo, projeto/empresa, comentários, cor...), montado por quem chama. */
  badgesRow?: ReactNode;
  assignee?: AssigneeInfo | null;
  className?: string;
}

export function TaskCardMini({
  title,
  isSubtask,
  completed,
  onTitleClick,
  titleTrailingSlot,
  description,
  badgesRow,
  assignee,
  className,
}: TaskCardMiniProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-1.5">
        <p
          className={cn(
            "font-medium text-sm truncate flex-1 flex items-center gap-1",
            completed && "line-through text-muted-foreground",
            onTitleClick && "cursor-pointer hover:text-primary",
          )}
          onClick={onTitleClick}
        >
          {isSubtask && (
            <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
          )}
          <span className="truncate">{title}</span>
        </p>
        {titleTrailingSlot}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
      )}

      {badgesRow && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {badgesRow}
        </div>
      )}

      {assignee && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <AssigneeAvatar url={assignee.avatarUrl} name={assignee.name} className="h-5 w-5 shrink-0" />
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{assignee.name}</span>
        </div>
      )}
    </div>
  );
}

export default TaskCardMini;
