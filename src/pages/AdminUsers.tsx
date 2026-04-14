import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Shield, Building2 } from "lucide-react";

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

export default function AdminUsers() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accesses, setAccesses] = useState<Access[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("cliente");
  const [editCompanies, setEditCompanies] = useState<string[]>([]);

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
    // Update status
    await supabase.from("profiles").update({ status: "aprovado" as any }).eq("id", selected.id);

    // Upsert role
    const existingRole = roles.find((r) => r.user_id === selected.id);
    if (existingRole) {
      await supabase.from("user_roles").update({ role: editRole as any }).eq("user_id", selected.id);
    } else {
      await supabase.from("user_roles").insert({ user_id: selected.id, role: editRole as any });
    }

    // Sync company access
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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: "bg-warning/20 text-warning",
      aprovado: "bg-success/20 text-success",
      bloqueado: "bg-destructive/20 text-destructive",
    };
    const labels: Record<string, string> = {
      pendente: "Pendente",
      aprovado: "Aprovado",
      bloqueado: "Bloqueado",
    };
    return <Badge className={map[status] || ""} variant="secondary">{labels[status] || status}</Badge>;
  };

  const toggleCompany = (cid: string) => {
    setEditCompanies((prev) => prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Gestão de Usuários</h2>

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
                    {getUserRole(p.id) || "Sem perfil"}
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
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === "cliente" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Empresas com acesso
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editCompanies.includes(c.id)}
                        onCheckedChange={() => toggleCompany(c.id)}
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
    </div>
  );
}
