import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, FolderKanban, Presentation as PresentationIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PresentationCard = {
  id: string;
  slug: string;
  project_id: string;
  hero_title: string | null;
  client_logo_url: string | null;
  updated_at: string;
  projectName: string;
  companyName: string;
};

export default function ClientPortal() {
  const { user } = useAuth();
  const [cards, setCards] = useState<PresentationCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: access } = await supabase
      .from("user_company_access")
      .select("company_id")
      .eq("user_id", user.id);
    const companyIds = Array.from(new Set((access || []).map((a: any) => a.company_id)));

    if (companyIds.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const [{ data: companiesData }, { data: projectsData }] = await Promise.all([
      supabase.from("companies").select("id, name").in("id", companyIds),
      supabase.from("projects").select("id, name, company_id").in("company_id", companyIds),
    ]);

    const companyMap = new Map((companiesData || []).map((c: any) => [c.id, c.name as string]));
    const projectMap = new Map(
      (projectsData || []).map((p: any) => [p.id, { name: p.name as string, company_id: p.company_id as string }]),
    );
    const projectIds = (projectsData || []).map((p: any) => p.id);

    if (projectIds.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const { data: presData } = await supabase
      .from("project_presentations")
      .select("id, slug, project_id, hero_title, client_logo_url, updated_at")
      .in("project_id", projectIds)
      .eq("status", "publicado")
      .eq("released", true)
      .order("updated_at", { ascending: false });

    const list: PresentationCard[] = ((presData || []) as any[]).map((p) => {
      const proj = projectMap.get(p.project_id);
      return {
        id: p.id,
        slug: p.slug,
        project_id: p.project_id,
        hero_title: p.hero_title,
        client_logo_url: p.client_logo_url,
        updated_at: p.updated_at,
        projectName: proj?.name || "Projeto",
        companyName: (proj && companyMap.get(proj.company_id)) || "",
      };
    });
    setCards(list);
    setLoading(false);
  }

  function openPresentation(slug: string) {
    window.open(`${window.location.origin}/c/${slug}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suas apresentações</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe aqui as apresentações liberadas pela nossa equipe.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PresentationIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma apresentação disponível no momento</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">{c.companyName}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{c.projectName}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="h-28 rounded border bg-muted flex items-center justify-center overflow-hidden">
                  {c.client_logo_url ? (
                    <img src={c.client_logo_url} alt={c.projectName} className="h-full w-full object-contain p-3" />
                  ) : (
                    <PresentationIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                {c.hero_title && <p className="text-sm truncate">{c.hero_title}</p>}
                <p className="text-xs text-muted-foreground">
                  Atualizado em {format(new Date(c.updated_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full gap-2" onClick={() => openPresentation(c.slug)}>
                  <ExternalLink className="h-4 w-4" /> Ver apresentação
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
