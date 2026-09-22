import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Pencil, Trash2, Upload, X, LayoutGrid, List, Globe, Camera, Crown, ClipboardList } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
import { CompanyDocuments } from "@/components/CompanyDocuments";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { getEntityColor, PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";
import { WORKFLOW_ROLES } from "@/lib/workflowRoles";
import { useIsMobile } from "@/hooks/use-mobile";

type WorkflowProfile = { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null };
type WorkflowRow = { company_id: string; role_key: string; user_id: string };

// Uma linha por função preenchida (pula as vazias), ex: "Planejamento: Duda"
// e "Copy: Clara, Ana" quando tem mais de uma pessoa. Sem linha nenhuma
// quando ninguém foi atribuído a nenhuma função ainda.
function formatWorkflowLines(rows: WorkflowRow[], profileMap: Record<string, WorkflowProfile>): string[] {
  const byRole = new Map<string, string[]>();
  rows.forEach((r) => {
    const p = profileMap[r.user_id];
    const name = p?.nickname?.trim() || p?.full_name || "Usuário";
    if (!byRole.has(r.role_key)) byRole.set(r.role_key, []);
    byRole.get(r.role_key)!.push(name);
  });
  const lines: string[] = [];
  WORKFLOW_ROLES.forEach((r) => {
    const names = byRole.get(r.key);
    if (names && names.length > 0) lines.push(`${r.label}: ${names.join(", ")}`);
  });
  return lines;
}

interface Company {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  planning_label: string | null;
  is_master: boolean;
  created_at: string;
  color: string | null;
}

export default function Companies() {
  const { isAdmin, isEditor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projectsByCompany, setProjectsByCompany] = useState<Record<string, { id: string; name: string }[]>>({});
  const [planningPopoverFor, setPlanningPopoverFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [planningLabel, setPlanningLabel] = useState("");
  const [companyColor, setCompanyColor] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const canManageDocs = isAdmin || isEditor;
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"card" | "lista">(() =>
    (localStorage.getItem("view-mode-empresas") as "card" | "lista") || "card"
  );

  // Fluxo Operacional: linhas de todas as empresas (pro resumo no card/lista)
  // e perfis resolvidos pra exibir apelido/nome.
  const [workflowRows, setWorkflowRows] = useState<WorkflowRow[]>([]);
  const [workflowProfiles, setWorkflowProfiles] = useState<Record<string, WorkflowProfile>>({});
  // Fluxo Operacional dentro do diálogo Editar/Nova Empresa: quem tem acesso
  // à empresa (pool de seleção) e a seleção atual por função.
  const [workflowMembers, setWorkflowMembers] = useState<WorkflowProfile[]>([]);
  const [workflowSelection, setWorkflowSelection] = useState<Record<string, string[]>>({});

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    // "color" ainda não está nos tipos gerados (coluna nova) — cast pontual,
    // igual já feito pra outras colunas recém-adicionadas no projeto.
    setCompanies((data || []) as any as Company[]);

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, company_id, archived")
      .order("name");
    const grouped: Record<string, { id: string; name: string }[]> = {};
    (projectsData || []).forEach((p: any) => {
      if (!p.company_id || p.archived) return;
      (grouped[p.company_id] ||= []).push({ id: p.id, name: p.name });
    });
    setProjectsByCompany(grouped);

    const { data: workflowData } = await (supabase.from as any)("company_workflow_roles")
      .select("company_id, role_key, user_id");
    const rows = (workflowData || []) as WorkflowRow[];
    setWorkflowRows(rows);
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url")
        .in("id", userIds);
      const map: Record<string, WorkflowProfile> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = p; });
      setWorkflowProfiles(map);
    } else {
      setWorkflowProfiles({});
    }
  };

  useEffect(() => { load(); }, []);

  // Quem tem acesso à empresa em edição (mesmo critério do NewTaskDialog:
  // user_company_access aprovado, sem clientes, + admins) — pool de seleção
  // do Fluxo Operacional. Vazio pra empresa nova (ainda sem acesso liberado).
  useEffect(() => {
    if (!editing) {
      setWorkflowMembers([]);
      return;
    }
    (async () => {
      const [{ data: accessRows }, { data: adminProfiles }] = await Promise.all([
        (supabase.from as any)("user_company_access")
          .select("user_id, profiles(id, full_name, nickname, avatar_url, status)")
          .eq("company_id", editing.id),
        (supabase.rpc as any)("get_admin_profiles"),
      ]);
      const candidateIds = Array.from(new Set((accessRows || []).map((r: any) => r.user_id)));
      let roleByUser: Record<string, string> = {};
      if (candidateIds.length > 0) {
        const { data: roleRows } = await (supabase.from as any)("user_roles").select("user_id, role").in("user_id", candidateIds);
        (roleRows || []).forEach((r: any) => { roleByUser[r.user_id] = r.role; });
      }
      const byId: Record<string, WorkflowProfile> = {};
      (accessRows || []).forEach((r: any) => {
        const p = r.profiles;
        if (p && p.status === "aprovado" && roleByUser[r.user_id] !== "cliente") {
          byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
        }
      });
      (adminProfiles || []).forEach((p: any) => {
        byId[p.id] = { id: p.id, full_name: p.full_name, nickname: p.nickname, avatar_url: p.avatar_url };
      });
      setWorkflowMembers(Object.values(byId));
    })();
  }, [editing]);

  const toggleViewMode = (mode: "card" | "lista") => {
    setViewMode(mode);
    localStorage.setItem("view-mode-empresas", mode);
  };

  const openNew = () => {
    setEditing(null);
    setName(""); setDescription(""); setLogoUrl(null);
    setWebsiteUrl(""); setInstagramUrl(""); setPlanningLabel("");
    setCompanyColor(null);
    setWorkflowSelection({});
    setOpen(true);
  };
  const openEdit = (c: Company) => {
    setEditing(c);
    setName(c.name); setDescription(c.description || ""); setLogoUrl(c.logo_url);
    setWebsiteUrl(c.website_url || ""); setInstagramUrl(c.instagram_url || ""); setPlanningLabel(c.planning_label || "");
    setCompanyColor(c.color || null);
    const selection: Record<string, string[]> = {};
    workflowRows.filter((r) => r.company_id === c.id).forEach((r) => {
      (selection[r.role_key] ||= []).push(r.user_id);
    });
    setWorkflowSelection(selection);
    setOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = "";
  };

  // Sincroniza o Fluxo Operacional da empresa: apaga tudo que já existia e
  // regrava a seleção atual — mais simples que diff, e só admin chega aqui.
  const saveWorkflowRoles = async (companyId: string) => {
    await (supabase.from as any)("company_workflow_roles").delete().eq("company_id", companyId);
    const rows: { company_id: string; role_key: string; user_id: string }[] = [];
    Object.entries(workflowSelection).forEach(([roleKey, userIds]) => {
      userIds.forEach((uid) => rows.push({ company_id: companyId, role_key: roleKey, user_id: uid }));
    });
    if (rows.length > 0) {
      await (supabase.from as any)("company_workflow_roles").insert(rows);
    }
  };

  const save = async () => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const fields = {
      name,
      description,
      slug,
      logo_url: logoUrl,
      website_url: websiteUrl || null,
      instagram_url: instagramUrl || null,
      planning_label: planningLabel || null,
      color: companyColor,
    };
    if (editing) {
      await supabase.from("companies").update(fields as any).eq("id", editing.id);
      await saveWorkflowRoles(editing.id);
      toast({ title: "Empresa atualizada" });
    } else {
      const { data: created } = await supabase.from("companies").insert(fields as any).select().single();
      if (created) await saveWorkflowRoles(created.id);
      toast({ title: "Empresa criada" });
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("companies").delete().eq("id", id);
    toast({ title: "Empresa removida" });
    load();
  };

  const openPlanning = (projectId: string) => {
    setPlanningPopoverFor(null);
    navigate(`/projetos/${projectId}?tab=planejamento`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Empresas</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === "card" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5" onClick={() => toggleViewMode("card")}>
              <LayoutGrid className="h-4 w-4" /> Card
            </Button>
            <Button variant={viewMode === "lista" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5 hidden md:inline-flex" onClick={() => toggleViewMode("lista")}>
              <List className="h-4 w-4" /> Lista
            </Button>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Empresa
            </Button>
          )}
        </div>
      </div>

      {viewMode === "lista" && !isMobile ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Links</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-8 w-8 object-cover rounded-full border" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getEntityColor(c.id, c.color, PROJECT_COLOR_PALETTE) }}
                      />
                      {c.name}
                      {c.is_master && (
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                          <Crown className="h-3 w-3" /> Master
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px]">
                    {(() => {
                      const lines = formatWorkflowLines(workflowRows.filter((r) => r.company_id === c.id), workflowProfiles);
                      return (
                        <>
                          {lines.map((line) => <p key={line} className="text-[11px] truncate">{line}</p>)}
                          <p className="truncate">{c.description || (lines.length > 0 ? "" : "—")}</p>
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.website_url && (
                        <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Link">
                          <Globe className="h-4 w-4" />
                        </a>
                      )}
                      {c.instagram_url && (
                        <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Instagram">
                          <Camera className="h-4 w-4" />
                        </a>
                      )}
                      {!c.website_url && !c.instagram_url && "—"}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => {
              const companyProjects = projectsByCompany[c.id] || [];
              const planningLabel = c.planning_label || "Planejamento";
              const workflowLines = formatWorkflowLines(workflowRows.filter((r) => r.company_id === c.id), workflowProfiles);
              return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer group/name min-w-0"
                    onClick={() => navigate(`/empresas/${c.id}`)}
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-10 w-10 object-cover rounded-full border shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-1.5 group-hover/name:text-primary transition-colors truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getEntityColor(c.id, c.color, PROJECT_COLOR_PALETTE) }}
                        />
                        {c.name}
                        {c.is_master && (
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal shrink-0">
                            <Crown className="h-3 w-3" /> Master
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">{c.slug}</CardDescription>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </CardHeader>
                {(c.description || workflowLines.length > 0 || c.website_url || c.instagram_url || companyProjects.length > 0) && (
                  <CardContent className="space-y-3">
                    {workflowLines.length > 0 && (
                      <div className="space-y-0.5">
                        {workflowLines.map((line) => <p key={line} className="text-xs text-muted-foreground truncate">{line}</p>)}
                      </div>
                    )}
                    {c.description && <p className="text-sm text-muted-foreground line-clamp-2 break-words">{c.description}</p>}
                    {(c.website_url || c.instagram_url || companyProjects.length > 0) && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {c.website_url && (
                            <a
                              href={c.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Link"
                            >
                              <Globe className="h-4 w-4" />
                            </a>
                          )}
                          {c.instagram_url && (
                            <a
                              href={c.instagram_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Instagram"
                            >
                              <Camera className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        {companyProjects.length === 1 ? (
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => openPlanning(companyProjects[0].id)}>
                            <ClipboardList className="h-3.5 w-3.5" /> {planningLabel}
                          </Button>
                        ) : companyProjects.length > 1 ? (
                          <Popover open={planningPopoverFor === c.id} onOpenChange={(o) => setPlanningPopoverFor(o ? c.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
                                <ClipboardList className="h-3.5 w-3.5" /> {planningLabel}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-2">
                              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Escolha o projeto</p>
                              <div className="space-y-0.5">
                                {companyProjects.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => openPlanning(p.id)}
                                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
                                  >
                                    {p.name}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
              );
            })}
          </div>

          {companies.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma empresa cadastrada</p>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? "Editar Empresa" : "Nova Empresa"}
              {editing?.is_master && (
                <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                  <Crown className="h-3 w-3" /> Master
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="flex items-center gap-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" className="flex-1" />
                <ColorSwatchPicker
                  value={companyColor}
                  onChange={setCompanyColor}
                  palette={PROJECT_COLOR_PALETTE}
                  allowNone
                  fallbackColor={getEntityColor(editing?.id || "", null, PROJECT_COLOR_PALETTE)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Fluxo Operacional</Label>
              {!editing && (
                <p className="text-xs text-muted-foreground">
                  Disponível depois de criar a empresa e liberar acesso pra alguém.
                </p>
              )}
              {WORKFLOW_ROLES.map((role) => (
                <div key={role.key} className="space-y-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">{role.label}</Label>
                  <AssigneeMultiSelect
                    profiles={workflowMembers}
                    selected={workflowSelection[role.key] || []}
                    onChange={(ids) => setWorkflowSelection((prev) => ({ ...prev, [role.key]: ids }))}
                    disabled={!editing}
                    placeholder={editing ? "Ninguém selecionado" : "—"}
                    hidePrimaryNote
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição" rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Link</Label>
              <Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/exemplo" />
            </div>
            <div className="space-y-2">
              <Label>Nome do botão de planejamento</Label>
              <Input value={planningLabel} onChange={(e) => setPlanningLabel(e.target.value)} placeholder="Planejamento" />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="Logo" className="h-12 w-12 object-cover rounded-full border-2 border-border shadow-sm" />
                  <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                    <X className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>

            {editing && (
              <>
                <Separator />
                <CompanyDocuments companyId={editing.id} canManage={canManageDocs} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          open={!!cropFile}
          onClose={() => setCropFile(null)}
          onCropped={(url) => setLogoUrl(url)}
          circular
          uploadPath={`logos/company-${Date.now()}.png`}
        />
      )}
    </div>
  );
}
