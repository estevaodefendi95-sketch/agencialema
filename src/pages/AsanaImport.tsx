import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet, ArrowLeft, ArrowRight } from "lucide-react";

type Company = { id: string; name: string };
type ProjectOption = { id: string; name: string; company_id: string };

type FieldKey =
  | "title"
  | "description"
  | "section"
  | "assigneeEmail"
  | "dueDate"
  | "tags"
  | "parentTask"
  | "completedAt";

type FieldMap = Record<FieldKey, string | null>;

type MappedRow = {
  title: string;
  description: string;
  section: string;
  assigneeEmail: string;
  dueDateRaw: string;
  dueDateIso: string | null;
  isCompleted: boolean;
  parentTask: string;
  isSubitem: boolean;
};

type ImportSummary = {
  tasksCreated: number;
  columnsCreated: number;
  unassignedCount: number;
  subitemsCreated: number;
  rowErrors: number;
  projectId: string;
};

// Mesmas colunas padrão criadas lazily pelo KanbanBoard quando um projeto ainda não tem nenhuma
const DEFAULT_COLUMNS = [
  { slug: "a_fazer", label: "A Fazer", color: "#94a3b8", position: 0 },
  { slug: "em_andamento", label: "Em Andamento", color: "#3B82F6", position: 1 },
  { slug: "concluido", label: "Concluído", color: "#22c55e", position: 2 },
  { slug: "aprovado", label: "Aprovado", color: "#16a34a", position: 3 },
];

const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Título (Name)",
  description: "Descrição (Notes)",
  section: "Coluna (Section)",
  assigneeEmail: "Responsável (Assignee Email)",
  dueDate: "Prazo (Due Date)",
  tags: "Tags (anexadas à descrição)",
  parentTask: "Tarefa-pai (Parent Task)",
  completedAt: "Concluída em (Completed At)",
};

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  title: ["name"],
  description: ["notes"],
  section: ["section", "section/column", "section / column", "column"],
  assigneeEmail: ["assignee email", "assignee e-mail"],
  dueDate: ["due date", "duedate"],
  tags: ["tags"],
  parentTask: ["parent task", "parenttask"],
  completedAt: ["completed at", "completedat"],
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function autoDetectFieldMap(headers: string[]): FieldMap {
  const map = {} as FieldMap;
  (Object.keys(HEADER_ALIASES) as FieldKey[]).forEach((key) => {
    const aliases = HEADER_ALIASES[key];
    const found = headers.find((h) => aliases.includes(normalizeHeader(h)));
    map[key] = found || null;
  });
  return map;
}

// Asana exporta datas como M/D/YYYY (sem zero à esquerda); convertemos para YYYY-MM-DD
function convertAsanaDate(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, month, day, year] = m;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyCompany(s: string) {
  return (
    stripDiacritics(s.toLowerCase())
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `empresa-${Date.now()}`
  );
}

function slugifyColumn(s: string, used: Set<string>) {
  const base =
    stripDiacritics(s.toLowerCase())
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "") || "coluna";
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) candidate = `${base}_${i++}`;
  used.add(candidate);
  return candidate;
}

export default function AsanaImport() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Etapa 1 — Destino
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [createNewCompany, setCreateNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [createNewProject, setCreateNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Etapa 2 — Upload e mapeamento
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({
    title: null,
    description: null,
    section: null,
    assigneeEmail: null,
    dueDate: null,
    tags: null,
    parentTask: null,
    completedAt: null,
  });
  const [profileEmails, setProfileEmails] = useState<Set<string>>(new Set());

  // Etapa 3 — Importar
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoadingRefs(true);
      const [{ data: c }, { data: p }, { data: profiles }] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("projects").select("id, name, company_id").eq("archived", false).order("name"),
        supabase.from("profiles").select("email"),
      ]);
      setCompanies((c || []) as Company[]);
      setAllProjects((p || []) as ProjectOption[]);
      setProfileEmails(new Set(((profiles || []) as any[]).map((pr) => (pr.email || "").toLowerCase()).filter(Boolean)));
      setLoadingRefs(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const projectsOfCompany = useMemo(
    () => allProjects.filter((p) => p.company_id === companyId),
    [allProjects, companyId],
  );

  const handleCompanyChange = (value: string) => {
    setCompanyId(value);
    setProjectId("");
    setCreateNewProject(false);
    setNewProjectName("");
  };

  const handleCreateNewCompanyChange = (checked: boolean) => {
    setCreateNewCompany(checked);
    setCompanyId("");
    if (checked) {
      // Empresa nova não tem projetos existentes ainda
      setCreateNewProject(true);
      setProjectId("");
    }
  };

  const step1Valid =
    (createNewCompany ? newCompanyName.trim().length > 0 : !!companyId) &&
    (createNewProject ? newProjectName.trim().length > 0 : !!projectId);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCsvFile(file);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvRows(results.data);
        setFieldMap(autoDetectFieldMap(headers));
      },
      error: (err) => {
        toast({ title: "Erro ao ler CSV", description: err.message, variant: "destructive" });
      },
    });
  }

  const mappedRows: MappedRow[] = useMemo(() => {
    return csvRows.map((row) => {
      const title = (fieldMap.title ? row[fieldMap.title] : "") || "";
      const rawDesc = (fieldMap.description ? row[fieldMap.description] : "") || "";
      // Fase 2 (tags nativas): quando o sistema tiver tags de verdade, isso deve virar uma relação
      // separada em vez de texto anexado à descrição.
      const tagsRaw = (fieldMap.tags ? row[fieldMap.tags] : "") || "";
      const description = tagsRaw.trim()
        ? `${rawDesc}${rawDesc.trim() ? "\n\n" : ""}Tags: ${tagsRaw.trim()}`
        : rawDesc;
      const section = ((fieldMap.section ? row[fieldMap.section] : "") || "").trim();
      const assigneeEmail = ((fieldMap.assigneeEmail ? row[fieldMap.assigneeEmail] : "") || "").trim();
      const dueDateRaw = (fieldMap.dueDate ? row[fieldMap.dueDate] : "") || "";
      const completedAtRaw = ((fieldMap.completedAt ? row[fieldMap.completedAt] : "") || "").trim();
      const parentTask = ((fieldMap.parentTask ? row[fieldMap.parentTask] : "") || "").trim();

      return {
        title: title.trim(),
        description,
        section,
        assigneeEmail,
        dueDateRaw,
        dueDateIso: convertAsanaDate(dueDateRaw),
        isCompleted: !!completedAtRaw,
        parentTask,
        isSubitem: !!parentTask,
      };
    });
  }, [csvRows, fieldMap]);

  const unmatchedAssigneeCount = useMemo(
    () => mappedRows.filter((r) => r.assigneeEmail && !profileEmails.has(r.assigneeEmail.toLowerCase())).length,
    [mappedRows, profileEmails],
  );

  const step2Valid = !!fieldMap.title && csvRows.length > 0;

  async function runImport() {
    if (!user) return;
    setImporting(true);
    const errors: string[] = [];
    let tasksCreated = 0;
    let unassignedCount = 0;
    let subitemsCreated = 0;
    let columnsCreated = 0;

    try {
      // 1. Empresa / projeto de destino
      let targetCompanyId = companyId;
      if (createNewCompany) {
        const { data, error } = await supabase
          .from("companies")
          .insert({ name: newCompanyName.trim(), slug: slugifyCompany(newCompanyName) })
          .select()
          .single();
        if (error || !data) throw new Error(`Empresa: ${error?.message || "erro desconhecido"}`);
        targetCompanyId = data.id;
      }

      let targetProjectId = projectId;
      if (createNewProject) {
        const { data, error } = await supabase
          .from("projects")
          .insert({ name: newProjectName.trim(), company_id: targetCompanyId })
          .select()
          .single();
        if (error || !data) throw new Error(`Projeto: ${error?.message || "erro desconhecido"}`);
        targetProjectId = data.id;
      }
      if (!targetCompanyId || !targetProjectId) throw new Error("Selecione a empresa e o projeto de destino.");

      // 2. Colunas existentes (seed com o padrão do Kanban se o projeto ainda não tiver nenhuma,
      // igual ao que o KanbanBoard faz na primeira visita — garante que exista uma coluna
      // "concluido"/"aprovado" para a regra do Completed At abaixo)
      const { data: existingColumnsData } = await supabase
        .from("project_columns")
        .select("id, slug, label, position")
        .eq("project_id", targetProjectId)
        .order("position", { ascending: true });
      let existingColumns = (existingColumnsData || []) as { id: string; slug: string; label: string; position: number }[];

      if (existingColumns.length === 0) {
        const { data: seeded, error } = await supabase
          .from("project_columns")
          .insert(DEFAULT_COLUMNS.map((c) => ({ project_id: targetProjectId, ...c })))
          .select();
        if (error) throw new Error(`Colunas padrão: ${error.message}`);
        existingColumns = (seeded || []) as any[];
      }

      const usedSlugs = new Set(existingColumns.map((c) => c.slug));

      // 3. Valores distintos de Section, na ordem de primeira aparição
      const sectionsInOrder: string[] = [];
      const seenSections = new Set<string>();
      mappedRows.forEach((r) => {
        if (r.section && !seenSections.has(r.section.toLowerCase())) {
          seenSections.add(r.section.toLowerCase());
          sectionsInOrder.push(r.section);
        }
      });

      let nextPosition = existingColumns.reduce((max, c) => Math.max(max, c.position), -1) + 1;
      const sectionToColumn = new Map<string, { id: string; slug: string; label: string }>();

      for (const section of sectionsInOrder) {
        const existing = existingColumns.find((c) => c.label.toLowerCase() === section.toLowerCase());
        if (existing) {
          sectionToColumn.set(section.toLowerCase(), existing);
          continue;
        }
        const slug = slugifyColumn(section, usedSlugs);
        const { data: created, error } = await supabase
          .from("project_columns")
          .insert({ project_id: targetProjectId, slug, label: section, color: "#94a3b8", position: nextPosition })
          .select()
          .single();
        if (error || !created) {
          errors.push(`Coluna "${section}": ${error?.message || "erro desconhecido"}`);
          continue;
        }
        nextPosition += 1;
        columnsCreated += 1;
        existingColumns.push(created as any);
        sectionToColumn.set(section.toLowerCase(), created as any);
      }

      const completedColumn =
        existingColumns.find((c) => c.slug === "concluido") || existingColumns.find((c) => c.slug === "aprovado") || null;

      // 4. E-mail → id de usuário
      const { data: profilesData } = await supabase.from("profiles").select("id, email");
      const emailToUserId = new Map<string, string>();
      (profilesData || []).forEach((p: any) => {
        if (p.email) emailToUserId.set(p.email.toLowerCase(), p.id);
      });

      // 5. Tarefas de topo (sem Parent Task)
      const titleToTaskId = new Map<string, string>();
      const topLevelRows = mappedRows.filter((r) => !r.isSubitem && r.title);
      let position = 0;

      for (const row of topLevelRows) {
        try {
          let status = existingColumns[0]?.slug || "a_fazer";
          const matched = row.section ? sectionToColumn.get(row.section.toLowerCase()) : null;
          if (matched) status = matched.slug;
          if (row.isCompleted && completedColumn) status = completedColumn.slug;

          const assignedTo = row.assigneeEmail ? emailToUserId.get(row.assigneeEmail.toLowerCase()) || null : null;
          if (!assignedTo) unassignedCount += 1;

          const { data: createdTask, error } = await supabase
            .from("tasks")
            .insert({
              project_id: targetProjectId,
              title: row.title,
              description: row.description || null,
              status,
              due_date: row.dueDateIso,
              assigned_to: assignedTo,
              priority: "media",
              created_by: user.id,
              position: position++,
            })
            .select()
            .single();

          if (error || !createdTask) {
            errors.push(`Tarefa "${row.title}": ${error?.message || "erro desconhecido"}`);
            continue;
          }
          tasksCreated += 1;
          titleToTaskId.set(row.title.toLowerCase(), createdTask.id);
        } catch (err: any) {
          errors.push(`Tarefa "${row.title}": ${err.message}`);
        }
      }

      // 6. Subitens (com Parent Task) viram itens de checklist da tarefa-pai
      const subitemRows = mappedRows.filter((r) => r.isSubitem && r.title);
      for (const row of subitemRows) {
        try {
          const parentId = titleToTaskId.get(row.parentTask.toLowerCase());
          if (!parentId) {
            errors.push(`Subitem "${row.title}": tarefa-pai "${row.parentTask}" não encontrada`);
            continue;
          }
          const { error } = await supabase
            .from("task_checklists")
            .insert({ task_id: parentId, title: row.title, completed: row.isCompleted });
          if (error) {
            errors.push(`Subitem "${row.title}": ${error.message}`);
            continue;
          }
          subitemsCreated += 1;
        } catch (err: any) {
          errors.push(`Subitem "${row.title}": ${err.message}`);
        }
      }

      setSummary({
        tasksCreated,
        columnsCreated,
        unassignedCount,
        subitemsCreated,
        rowErrors: errors.length,
        projectId: targetProjectId,
      });
      toast({ title: "Importação concluída", description: `${tasksCreated} tarefa(s) criada(s).` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function resetAll() {
    setStep(1);
    setCompanyId("");
    setCreateNewCompany(false);
    setNewCompanyName("");
    setProjectId("");
    setCreateNewProject(false);
    setNewProjectName("");
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setSummary(null);
  }

  const STEP_LABELS = ["Destino", "Upload e mapeamento", "Importar"];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Importar do Asana</h2>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {i + 1}
            </span>
            <span className={step === i + 1 ? "text-foreground font-medium" : ""}>{label}</span>
            {i < STEP_LABELS.length - 1 && <span className="mx-1">→</span>}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 1 — Destino</CardTitle>
            <CardDescription>Escolha para onde as tarefas do Asana serão importadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={createNewCompany} onCheckedChange={(v) => handleCreateNewCompanyChange(!!v)} />
                Criar nova empresa
              </Label>
              {createNewCompany ? (
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Nome da nova empresa"
                />
              ) : (
                <Select value={companyId} onValueChange={handleCompanyChange} disabled={loadingRefs}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={createNewProject}
                  onCheckedChange={(v) => setCreateNewProject(!!v)}
                  disabled={createNewCompany}
                />
                Criar novo projeto
              </Label>
              {createNewProject ? (
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Nome do novo projeto"
                />
              ) : (
                <Select value={projectId} onValueChange={setProjectId} disabled={!companyId}>
                  <SelectTrigger><SelectValue placeholder={companyId ? "Selecione o projeto" : "Selecione a empresa primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {projectsOfCompany.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {projectsOfCompany.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum projeto nesta empresa</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
          <CardContent className="flex justify-end pt-0">
            <Button onClick={() => setStep(2)} disabled={!step1Valid} className="gap-2">
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 2 — Upload e mapeamento</CardTitle>
            <CardDescription>Envie o CSV exportado do Asana e confira o mapeamento das colunas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="cursor-pointer inline-block">
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              <Button asChild variant="outline">
                <span><Upload className="h-4 w-4 mr-2" />{csvFile ? `Trocar arquivo (${csvFile.name})` : "Selecionar arquivo CSV"}</span>
              </Button>
            </label>

            {csvRows.length > 0 && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mapeamento de colunas</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{FIELD_LABELS[key]}</Label>
                        <Select
                          value={fieldMap[key] || "__none__"}
                          onValueChange={(v) => setFieldMap((prev) => ({ ...prev, [key]: v === "__none__" ? null : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhuma coluna</SelectItem>
                            {csvHeaders.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {unmatchedAssigneeCount > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                    <p className="text-warning">
                      {unmatchedAssigneeCount} {unmatchedAssigneeCount === 1 ? "tarefa ficará" : "tarefas ficarão"} sem
                      responsável (e-mail não encontrado em nenhum usuário cadastrado).
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Pré-visualização (primeiras {Math.min(20, mappedRows.length)} de {mappedRows.length} linhas)
                  </p>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Coluna</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Concluída?</TableHead>
                          <TableHead>É subitem de?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedRows.slice(0, 20).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[160px] truncate">{r.title || "—"}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{r.description || "—"}</TableCell>
                            <TableCell className="text-xs">{r.section || "—"}</TableCell>
                            <TableCell className="text-xs">{r.assigneeEmail || "—"}</TableCell>
                            <TableCell className="text-xs">{r.dueDateIso || (r.dueDateRaw ? "inválida" : "—")}</TableCell>
                            <TableCell className="text-xs">{r.isCompleted ? "Sim" : "Não"}</TableCell>
                            <TableCell className="text-xs">{r.isSubitem ? r.parentTask : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardContent className="flex justify-between pt-0">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep(3)} disabled={!step2Valid} className="gap-2">
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 3 — Importar</CardTitle>
            <CardDescription>
              {summary ? "Importação concluída." : "Confira o resumo abaixo e confirme a importação."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!summary ? (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{mappedRows.length} linha(s) no CSV.</p>
                <p>{mappedRows.filter((r) => !r.isSubitem && r.title).length} tarefa(s) serão criadas.</p>
                <p>{mappedRows.filter((r) => r.isSubitem && r.title).length} viraram itens de checklist de uma tarefa-pai.</p>
                {unmatchedAssigneeCount > 0 && (
                  <p className="text-warning">{unmatchedAssigneeCount} sem responsável correspondente.</p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p>{summary.tasksCreated} tarefas criadas</p>
                  <p>{summary.columnsCreated} colunas criadas</p>
                  <p>{summary.unassignedCount} tarefas sem responsável (revise depois)</p>
                  <p>{summary.subitemsCreated} viraram subitens de checklist</p>
                  {summary.rowErrors > 0 && <p className="text-destructive">{summary.rowErrors} linhas com erro</p>}
                </div>
              </div>
            )}
          </CardContent>
          <CardContent className="flex justify-between pt-0">
            {!summary ? (
              <>
                <Button variant="outline" onClick={() => setStep(2)} disabled={importing} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button onClick={runImport} disabled={importing} className="gap-2">
                  {importing ? "Importando..." : "Confirmar Importação"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={resetAll}>Nova importação</Button>
                <Button onClick={() => navigate(`/projetos/${summary.projectId}`)} className="gap-2">
                  Ver projeto <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
