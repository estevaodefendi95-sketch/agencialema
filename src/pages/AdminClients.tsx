import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, ChevronRight, Lock, Search, ShieldCheck } from "lucide-react";
import { adminErrorMessage } from "@/lib/adminRpc";

type CompanyRow = { id: string; name: string; logo_url: string | null };

// Clientes & Contratos (admin-only): lista as empresas já cadastradas e
// marca as que têm observação confidencial salva — sem carregar o conteúdo.
export default function AdminClients() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [withNotes, setWithNotes] = useState<Set<string>>(new Set());
  const [notesError, setNotesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: companiesData }, { data: notesData, error: notesErr }] = await Promise.all([
        supabase.from("companies").select("id, name, logo_url").order("name"),
        (supabase as any).rpc("admin_list_companies_with_notes"),
      ]);
      setCompanies((companiesData || []) as CompanyRow[]);
      if (notesErr) {
        setNotesError(adminErrorMessage(notesErr));
      } else {
        setWithNotes(new Set(((notesData || []) as { company_id: string }[]).map((r) => r.company_id)));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
  }, [companies, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Clientes &amp; Contratos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Contratos e observações confidenciais por empresa. Visível apenas para administradores.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa" className="pl-9" />
      </div>

      {notesError && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5 max-w-2xl">
          Não foi possível verificar quais empresas têm observações: {notesError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt="" className="h-9 w-9 rounded-full object-cover border shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{c.name}</span>
                {withNotes.has(c.id) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground" aria-label="Tem observação confidencial">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Tem observação confidencial</TooltipContent>
                  </Tooltip>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
