import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Shield, Building2, Plus } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

interface Role { user_id: string; role: string; }
interface Company { id: string; name: string; }
interface Access { user_id: string; company_id: string; }

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  visualizador: "Visualizador",
  cliente: "Cliente",
};

export default function AdminUsers() {
  const { toast } = useToast();
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accesses, setAccesses] = useState<Access[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("cliente");
  const [editCompanies, setEditCompanies] = useState<string[]>([]);

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("cliente");
  const [newCompanies, setNewCompanies] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [p, r, c, a] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("user_company_access").select("user_id, company_id"),
    ]);
    setProfiles(p.data || []);
    setRoles(r.data || []);
    setCompanies(c.data || []);
    setAccesses(a.data || []);
  };

  useEffect(() => { load(); }, []);

  const getUserRole = (userId: string) => roles.find((r) => r.user_id === userId)?.role;
  const getUserCompanies = (userId: string) => accesses.filter((a) => a.user_id === userId).map((a) => a.company_id);

  const openEdit = (p: Profile) => {
    setSelected(p);
    setEditRole(getUserRole(p.id) || "cliente");
    setEditCompanies(getUserCompanies(p.id));
  };

  const approve = async () => {
    if (!selected) return;
    await supabase.from("profiles").update({ status: "aprovado" as any }).eq("id", selected.id);

    const existingRole = roles.find((r) => r.user_id === selected.id);
    if (existingRole) {
      await supabase.from("user_roles").update({ role: editRole as any }).eq("user_id", selected.id);
    } else {
      await supabase.from("user_roles").insert({ user_id: selected.id, role: editRole as any });
    }

    await supabase.from("user_company_access").delete().eq("user_id", selected.id);
    if (editCompanies.length > 0) {
      await supabase.from("user_company_access").insert(
        editCompanies.map((cid) => ({ user_id: selected.id, company_id: cid }))
      );
    }

    toast({ title: "Usuário aprovado e permissões configuradas" });
    setSelected(null);
    load();
  };

  const block = async (userId: string) => {
    await supabase.from("profiles").update({ status: "bloqueado" as any }).eq("id", userId);
    toast({ title: "Usuário bloqueado" });
    load();
  };

  const createUser = async () => {
    if (!newName || !newEmail || !newPassword) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName,
          role: newRole,
          company_ids: newCompanies,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário criado com sucesso" });
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("cliente"); setNewCompanies([]);
      load();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: "bg-warning/20 text-warning",
      aprovado: "bg-success/20 text-success",
      bloqueado: "bg-destructive/20 text-destructive",
    };
    const labels: Record<string, string> = { pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Bloqueado" };
    return <Badge className={map[status] || ""} variant="secondary">{labels[status] || status}</Badge>;
  };

  const toggleCompany = (cid: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(cid) ? list.filter((id) => id !== cid) : [...list, cid]);
  };

  const showCompanySelect = (role: string) => role !== "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABELS[getUserRole(p.id) || ""] || "Sem perfil"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {getUserCompanies(p.id).length} empresa(s)
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="gap-1">
                      <Shield className="h-3 w-3" /> Editar
                    </Button>
                    {p.status !== "bloqueado" && (
                      <Button size="sm" variant="outline" onClick={() => block(p.id)} className="gap-1 text-destructive">
                        <UserX className="h-3 w-3" /> Bloquear
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado</div>
      )}

      {/* Edit user dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Acesso — {selected?.full_name || selected?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Perfil do Usuário</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCompanySelect(editRole) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Empresas com acesso
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editCompanies.includes(c.id)}
                        onCheckedChange={() => toggleCompany(c.id, editCompanies, setEditCompanies)}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={approve} className="gap-2">
              <UserCheck className="h-4 w-4" /> Aprovar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha temporária</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showCompanySelect(newRole) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Vincular a empresas
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={newCompanies.includes(c.id)}
                        onCheckedChange={() => toggleCompany(c.id, newCompanies, setNewCompanies)}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createUser} disabled={creating || !newName || !newEmail || !newPassword}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
