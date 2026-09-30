import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { cn } from "@/lib/utils";

interface Props {
  /** Foto grande/principal — segue o filtro ativo (Por Empresa/Por Responsável). */
  primaryUrl?: string | null;
  /** Nome usado pro fallback de iniciais da foto principal (reaproveita AssigneeAvatar). */
  primaryName?: string | null;
  /** Foto pequena sobreposta no canto — a outra metade do par (empresa ou responsável). */
  secondaryUrl?: string | null;
  /** Classe de tamanho da foto principal (ex: "h-5 w-5"). */
  size?: string;
  /** Classe de tamanho do selo pequeno (padrão 14px) — reduza junto se a principal encolher muito. */
  secondarySize?: string;
  className?: string;
}

/**
 * Duas fotos sobrepostas numa tarefa do calendário: a principal (grande, cor
 * da barra segue o filtro ativo) e uma pequena "selo" no canto inferior
 * direito com a outra foto (empresa ou responsável, o que não for a
 * principal). Se a foto secundária não existir, só a principal aparece —
 * layout não quebra.
 */
export function TaskDualAvatar({ primaryUrl, primaryName, secondaryUrl, size = "h-5 w-5", secondarySize = "w-3.5 h-3.5", className }: Props) {
  return (
    <span className={cn("relative inline-flex shrink-0", size, className)}>
      <AssigneeAvatar url={primaryUrl} name={primaryName} className={cn(size, "w-full h-full")} />
      {secondaryUrl && (
        <img
          src={secondaryUrl}
          alt=""
          className={cn("absolute -bottom-0.5 -right-0.5 rounded-full object-cover border-2 border-background", secondarySize)}
        />
      )}
    </span>
  );
}

export default TaskDualAvatar;
