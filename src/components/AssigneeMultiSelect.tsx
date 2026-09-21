import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/AssigneeAvatar";
import { Check, ChevronDown, Users } from "lucide-react";

type Profile = { id: string; full_name?: string | null; nickname?: string | null; avatar_url?: string | null; email?: string | null };

function displayName(p: Profile) {
  return p.nickname?.trim() || p.full_name || p.email || "Sem nome";
}

/**
 * Seletor de vários responsáveis por tarefa. O primeiro id em `selected`
 * vira o responsável principal (tasks.assigned_to); os demais viram
 * responsáveis adicionais (task_assignees) — a ordem de seleção decide isso.
 */
export function AssigneeMultiSelect({
  profiles,
  selected,
  onChange,
  currentUserId,
  disabled,
  placeholder = "Selecione um ou mais responsáveis...",
  hidePrimaryNote,
  workflowUserIds,
  workflowLabels,
}: {
  profiles: Profile[];
  selected: string[];
  onChange: (ids: string[]) => void;
  currentUserId?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Some a nota "é o responsável principal" — usa quando a seleção não tem essa noção (ex: Fluxo Operacional). */
  hidePrimaryNote?: boolean;
  /** Ids de quem tem alguma função no Fluxo Operacional da empresa — quando presente, agrupa a lista em "Fluxo da empresa" / "Sem atribuição nesta empresa" e mostra o botão "Selecionar todo o fluxo". */
  workflowUserIds?: string[];
  /** id -> nomes das funções (ex: "Copy, Postagem Story"), mostrado entre parênteses ao lado do nome no grupo "Fluxo da empresa". */
  workflowLabels?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const hasWorkflowGroups = !!workflowUserIds && workflowUserIds.length > 0;
  const nonCurrentProfiles = profiles.filter((p) => p.id !== currentUserId);
  const workflowProfiles = hasWorkflowGroups ? nonCurrentProfiles.filter((p) => workflowUserIds!.includes(p.id)) : [];
  const otherProfiles = hasWorkflowGroups ? nonCurrentProfiles.filter((p) => !workflowUserIds!.includes(p.id)) : nonCurrentProfiles;

  const nameFor = (id: string) => {
    if (id === currentUserId) return "Eu mesmo";
    const p = profiles.find((x) => x.id === id);
    return p ? displayName(p) : "Usuário";
  };
  const avatarFor = (id: string) => (id === currentUserId ? undefined : profiles.find((x) => x.id === id)?.avatar_url);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between h-auto min-h-9 py-1.5 font-normal"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1 items-center">
              {selected.map((id) => (
                <span key={id} className="flex items-center gap-1 bg-accent rounded-full pl-0.5 pr-2 py-0.5 text-xs">
                  <AssigneeAvatar url={avatarFor(id)} name={nameFor(id)} className="h-5 w-5" />
                  {nameFor(id)}
                </span>
              ))}
            </div>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {hasWorkflowGroups && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 text-xs mb-1"
            onClick={() => onChange(Array.from(new Set([...selected, ...workflowUserIds!])))}
          >
            <Users className="h-3.5 w-3.5" /> Selecionar todo o fluxo
          </Button>
        )}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {currentUserId && (
            <button
              type="button"
              onClick={() => toggle(currentUserId)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
            >
              <AssigneeAvatar name="Eu" className="h-6 w-6" />
              <span className="flex-1">Eu mesmo</span>
              {selected.includes(currentUserId) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          )}
          {hasWorkflowGroups ? (
            <>
              {workflowProfiles.length > 0 && (
                <>
                  <div className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Fluxo da empresa</div>
                  {workflowProfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                    >
                      <AssigneeAvatar url={p.avatar_url} name={displayName(p)} className="h-6 w-6" />
                      <span className="flex-1 truncate">
                        {displayName(p)}
                        {workflowLabels?.[p.id] && <span className="text-muted-foreground"> ({workflowLabels[p.id]})</span>}
                      </span>
                      {selected.includes(p.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                </>
              )}
              {otherProfiles.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Sem atribuição nesta empresa</div>
                  {otherProfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                    >
                      <AssigneeAvatar url={p.avatar_url} name={displayName(p)} className="h-6 w-6" />
                      <span className="flex-1 truncate">{displayName(p)}</span>
                      {selected.includes(p.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </>
          ) : (
            otherProfiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
              >
                <AssigneeAvatar url={p.avatar_url} name={displayName(p)} className="h-6 w-6" />
                <span className="flex-1 truncate">{displayName(p)}</span>
                {selected.includes(p.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
        {!hidePrimaryNote && selected.length > 0 && (
          <p className="text-[10px] text-muted-foreground px-2 pt-2 border-t mt-1">
            {nameFor(selected[0])} é o responsável principal.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default AssigneeMultiSelect;
