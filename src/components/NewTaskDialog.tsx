import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { FolderKanban, User, Clock } from "lucide-react";
import { REMINDER_OPTIONS } from "@/lib/taskReminders";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Profile = { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null };

export interface CreatedTaskInfo {
  id: string;
  project_id: string | null;
}

export interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  defaultStatusSlug?: string | null;
  defaultPersonal?: boolean;

  /** Projeto fixo (uso do KanbanBoard, já dentro de um projeto) — some os selects de Empresa/Projeto. */
  fixedProjectId?: string;
  /** Responsáveis possíveis quando fixedProjectId está setado (o chamador já tem essa lista carregada). */
  fixedProjectProfiles?: Profile[];

  /** Colunas do board pra escolher a inicial — só quando o chamador tem (KanbanBoard). Sem isso, some o seletor e cai em defaultStatusSlug ou na 1ª coluna do projeto. */
  statusOptions?: { slug: string; label: string }[];
  /** Posição inicial da tarefa dentro da coluna. Default: 0 (igual Calendário/Minhas Tarefas hoje). */
  computePosition?: (statusSlug: string) => number;

  /** Campos extras renderizados dentro do formulário, antes do rodapé (ex: Cor/Checklist/Anexos do Kanban). */
  extraFields?: ReactNode;

  /** "sheet" reproduz o painel lateral do KanbanBoard; default "dialog" (modal central de Calendário/Minhas Tarefas). */
  variant?: "dialog" | "sheet";

  onCreated?: (task: CreatedTaskInfo, extras: { isPersonal: boolean; statusSlug: string }) => void | Promise<void>;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultCompanyId,
  defaultProjectId,
  defaultStatusSlug,
  defaultPersonal,
  fixedProjectId,
  fixedProjectProfiles,
  statusOptions,
  computePosition,
  extraFields,
  variant = "dialog",
  onCreated,
}: NewTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string; company_id: string; is_default: boolean }[]>([]);
  const [companyMembers, setCompanyMembers] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);

  const [isPersonal, setIsPersonal] = useState(false);
  const [ntCompany, setNtCompany] = useState("");
  const [ntProject, setNtProject] = useState("");
  const [ntTitle, setNtTitle] = useState("");
  const [ntDesc, setNtDesc] = useState("");
  const [ntPriority, setNtPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [ntDue, setNtDue] = useState("");
  const [ntHasDueTime, setNtHasDueTime] = useState(false);
  const [ntDueTime, setNtDueTime] = useState("");
  const [ntReminderMinutes, setNtReminderMinutes] = useState("none");
  const [ntAssignees, setNtAssignees] = useState<string[]>([]);
  const [ntStatus, setNtStatus] = useState("");
  const [ntRecurrence, setNtRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [ntRecurrenceDays, setNtRecurrenceDays] = useState<number[]>([]);

  // Empresas/projetos pros selects — só quando não há projeto fixo.
  useEffect(() => {
    if (fixedProjectId) return;
    (async () => {
      const [{ data: companies }, { data: projects }] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        (supabase.from("projects") as any).select("id, name, company_id, is_default").eq("archived", false).order("name"),
      ]);
      setAllCompanies((companies || []) as any);
      setAllProjects((projects || []) as any);
    })();
  }, [fixedProjectId]);

  // Responsáveis possíveis: quem tem acesso à empresa escolhida (sem
  // clientes) + admins — depende só da empresa, não do projeto (que agora é
  // opcional). Só quando não há projeto fixo (que já traz sua própria lista
  // via fixedProjectProfiles).
  useEffect(() => {
    if (fixedProjectId) return;
    if (!ntCompany) {
      setCompanyMembers([]);
      return;
    }
    (async () => {
      const [{ data: accessRows }, { data: adminProfiles }] = await Promise.all([
        (supabase.from as any)("user_company_access")
          .select("user_id, profiles(id, full_name, nickname, avatar_url, status)")
          .eq("company_id", ntCompany),
        (supabase.rpc as any)("get_admin_profiles"),
      ]);
      const candidateIds = Array.from(new Set((accessRows || []).map((r: any) => r.user_id)));
      let roleByUser: Record<string, string> = {};
      if (candidateIds.length > 0) {
        const { data: roleRows } = await (supabase.from as any)("user_roles").select("user_id, role").in("user_id", candidateIds);
        (roleRows || []).forEach((r: any) => { roleByUser[r.user_id] = r.role; });
      }
      const byId: Record<string, Profile> = {};
      (accessRows || []).forEach((r: any) => {
        const p = r.profiles;
        if (p && p.status === "aprovado" && roleByUser[r.user_id] !== "cliente") {
          byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
        }
      });
      (adminProfiles || []).forEach((p: any) => {
        byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
      });
      setCompanyMembers(Object.values(byId));
    })();
  }, [ntCompany, fixedProjectId]);

  // Reseta o formulário a partir dos defaults toda vez que o modal abre.
  useEffect(() => {
    if (!open) return;
    setNtTitle("");
    setNtDesc("");
    setNtPriority("media");
    setNtDue(defaultDate ? format(defaultDate, "yyyy-MM-dd") : "");
    setNtHasDueTime(false);
    setNtDueTime("");
    setNtReminderMinutes("none");
    setNtAssignees(user ? [user.id] : []);
    setNtRecurrence("none");
    setNtRecurrenceDays([]);
    setIsPersonal(!!defaultPersonal);

    if (fixedProjectId) {
      setNtProject(fixedProjectId);
      setNtCompany("");
    } else if (defaultPersonal) {
      setNtProject("");
      setNtCompany("");
    } else {
      setNtProject(defaultProjectId || "");
      if (defaultCompanyId) {
        setNtCompany(defaultCompanyId);
      } else if (defaultProjectId) {
        setNtCompany(allProjects.find((p) => p.id === defaultProjectId)?.company_id || "");
      } else {
        setNtCompany("");
      }
    }

    setNtStatus(defaultStatusSlug || (statusOptions ? statusOptions[0]?.slug || "" : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const assigneeProfiles = fixedProjectId ? (fixedProjectProfiles || []) : companyMembers;
  const showCompanyProjectSelect = !fixedProjectId && !isPersonal;

  const createTask = async () => {
    if (!user || !ntTitle.trim()) return;
    if (!isPersonal && !fixedProjectId && !ntCompany) return;
    setCreating(true);

    let targetProjectId = fixedProjectId || ntProject;
    if (!isPersonal && !targetProjectId) {
      const cached = allProjects.find((p) => p.company_id === ntCompany && p.is_default);
      if (cached) {
        targetProjectId = cached.id;
      } else {
        const { data: defaultProject } = await (supabase.from("projects") as any)
          .select("id")
          .eq("company_id", ntCompany)
          .eq("is_default", true)
          .maybeSingle();
        targetProjectId = defaultProject?.id || "";
      }
    }
    if (!isPersonal && !targetProjectId) {
      setCreating(false);
      toast({ title: "Não foi possível encontrar o projeto padrão dessa empresa", variant: "destructive" });
      return;
    }

    let statusSlug = ntStatus;
    if (isPersonal) {
      statusSlug = "a_fazer";
    } else if (!statusSlug) {
      const { data: cols } = await supabase
        .from("project_columns")
        .select("slug")
        .eq("project_id", targetProjectId)
        .order("position", { ascending: true })
        .limit(1);
      statusSlug = cols?.[0]?.slug || "a_fazer";
    }

    const primaryAssignee = isPersonal ? user.id : (ntAssignees[0] || user.id);
    const extraAssignees = isPersonal ? [] : ntAssignees.slice(1).filter((id) => id !== primaryAssignee);

    const { data: created, error } = await supabase.from("tasks").insert({
      project_id: isPersonal ? null : targetProjectId,
      title: ntTitle.trim(),
      description: ntDesc.trim() || null,
      priority: isPersonal ? "media" : ntPriority,
      due_date: ntDue || null,
      due_time: ntHasDueTime && ntDueTime ? ntDueTime : null,
      reminder_minutes_before: ntHasDueTime && ntDueTime && ntReminderMinutes !== "none" ? parseInt(ntReminderMinutes, 10) : null,
      assigned_to: primaryAssignee,
      status: statusSlug,
      created_by: user.id,
      position: isPersonal ? 0 : (computePosition ? computePosition(statusSlug) : 0),
      ...(isPersonal ? {
        recurrence_type: ntRecurrence,
        recurrence_days: ntRecurrence === "weekly" ? ntRecurrenceDays : null,
      } : {}),
    } as any).select().single();

    if (error) {
      setCreating(false);
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
      return;
    }

    if (created) {
      if (isPersonal) {
        const { error: assigneeError } = await (supabase.from as any)("task_assignees").insert({
          task_id: created.id, user_id: user.id, added_by: user.id,
        });
        if (assigneeError) {
          toast({ title: "Tarefa criada, mas houve erro ao registrar responsável", description: assigneeError.message, variant: "destructive" });
        }
      } else if (extraAssignees.length > 0) {
        const { error: extraError } = await (supabase.from as any)("task_assignees").insert(
          extraAssignees.map((uid) => ({ task_id: created.id, user_id: uid, added_by: user.id })),
        );
        if (extraError) {
          toast({ title: "Tarefa criada, mas houve erro ao adicionar responsáveis extras", description: extraError.message, variant: "destructive" });
        }
      }
    }

    setCreating(false);
    toast({ title: isPersonal ? "Tarefa pessoal criada" : "Tarefa criada" });
    onOpenChange(false);
    if (created) {
      await onCreated?.({ id: created.id, project_id: created.project_id }, { isPersonal, statusSlug });
    }
  };

  const disabled = (!isPersonal && !fixedProjectId && !ntCompany) || !ntTitle.trim() || creating;

  const formBody = (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={isPersonal ? "pessoal" : "projeto"}
        onValueChange={(v) => {
          if (!v) return;
          setIsPersonal(v === "pessoal");
          if (v === "pessoal" && !fixedProjectId) { setNtProject(""); setNtCompany(""); }
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="projeto" className="gap-1.5 text-xs h-8 px-3">
          <FolderKanban className="h-3.5 w-3.5" /> Tarefa de projeto
        </ToggleGroupItem>
        <ToggleGroupItem value="pessoal" className="gap-1.5 text-xs h-8 px-3">
          <User className="h-3.5 w-3.5" /> Tarefa pessoal
        </ToggleGroupItem>
      </ToggleGroup>

      {showCompanyProjectSelect && (
        <div className="space-y-1.5">
          <Label className="text-sm">Empresa *</Label>
          <Select value={ntCompany} onValueChange={(v) => { setNtCompany(v); setNtProject(""); setNtAssignees(user ? [user.id] : []); }}>
            <SelectTrigger><SelectValue placeholder="Selecione uma empresa..." /></SelectTrigger>
            <SelectContent>
              {allCompanies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isPersonal && (
        <div className="space-y-1.5">
          <Label className="text-sm">Responsáveis</Label>
          <AssigneeMultiSelect
            profiles={assigneeProfiles}
            selected={ntAssignees}
            onChange={setNtAssignees}
            currentUserId={user?.id}
            disabled={!fixedProjectId && !ntCompany}
            placeholder={fixedProjectId || ntCompany ? "Selecione um ou mais responsáveis..." : "Escolha uma empresa primeiro"}
          />
        </div>
      )}

      {showCompanyProjectSelect && (
        <div className="space-y-1.5">
          <Label className="text-sm">Projeto</Label>
          <Select value={ntProject || "none"} onValueChange={(v) => setNtProject(v === "none" ? "" : v)} disabled={!ntCompany}>
            <SelectTrigger><SelectValue placeholder="Geral (sem projeto)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geral (sem projeto)</SelectItem>
              {allProjects.filter((p) => p.company_id === ntCompany && !p.is_default).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">Título *</Label>
        <Input value={ntTitle} onChange={(e) => setNtTitle(e.target.value)} placeholder="O que precisa ser feito?" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Descrição</Label>
        <Textarea value={ntDesc} onChange={(e) => setNtDesc(e.target.value)} rows={3} />
      </div>

      {!isPersonal && (
        <div className={cn("grid gap-3", statusOptions ? "grid-cols-2" : "grid-cols-1")}>
          <div className="space-y-1.5">
            <Label className="text-sm">Prioridade</Label>
            <Select value={ntPriority} onValueChange={(v) => setNtPriority(v as typeof ntPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusOptions && (
            <div className="space-y-1.5">
              <Label className="text-sm">Coluna</Label>
              <Select value={ntStatus} onValueChange={setNtStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Prazo</Label>
          <Input type="date" value={ntDue} onChange={(e) => setNtDue(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Definir horário</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={ntHasDueTime}
              onCheckedChange={(checked) => {
                setNtHasDueTime(checked);
                if (!checked) { setNtDueTime(""); setNtReminderMinutes("none"); }
              }}
            />
            {ntHasDueTime && (
              <Input type="time" value={ntDueTime} onChange={(e) => setNtDueTime(e.target.value)} className="h-9" />
            )}
          </div>
        </div>
      </div>

      {isPersonal && (
        <div className="space-y-1.5">
          <Label className="text-sm">Recorrência</Label>
          <Select
            value={ntRecurrence}
            onValueChange={(v) => {
              setNtRecurrence(v as typeof ntRecurrence);
              if (v !== "weekly") setNtRecurrenceDays([]);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não repetir</SelectItem>
              <SelectItem value="daily">Diariamente</SelectItem>
              <SelectItem value="weekly">Semanalmente</SelectItem>
              <SelectItem value="monthly">Mensalmente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isPersonal && ntRecurrence === "weekly" && (
        <div className="space-y-1.5">
          <Label className="text-sm">Repetir nos dias</Label>
          <div className="flex gap-1.5 flex-wrap">
            {WEEKDAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setNtRecurrenceDays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx])}
                className={cn(
                  "h-8 w-8 rounded-full text-xs font-medium border transition-colors",
                  ntRecurrenceDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {ntHasDueTime && ntDueTime && (
        <div className="space-y-1.5">
          <Label className="text-sm">Notificar</Label>
          <Select value={ntReminderMinutes} onValueChange={setNtReminderMinutes}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {extraFields}
    </div>
  );

  if (variant === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl h-full flex flex-col p-0 gap-0 overflow-hidden">
          <SheetHeader className="px-8 pt-8 pb-5 border-b shrink-0 pr-14 text-left">
            <SheetTitle className="text-xl">{isPersonal ? "Nova Tarefa Pessoal" : "Nova Tarefa"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 px-8 py-6">{formBody}</ScrollArea>
          <SheetFooter className="px-8 py-5 border-t shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={createTask} disabled={disabled}>{creating ? "Criando..." : "Criar"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isPersonal ? "Nova Tarefa Pessoal" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={createTask} disabled={disabled}>{creating ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewTaskDialog;
