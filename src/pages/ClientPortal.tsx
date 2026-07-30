import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { Presentation as PresentationIcon, ChevronDown, Building2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type VersionRow = {
  id: string;
  name: string;
  created_at: string;
  slug: string;
  hero_title: string | null;
  client_logo_url: string | null;
  projectName: string;
};

type Banner = { id: string; image_url: string; title: string | null; link_url: string | null };
type ServiceItem = { id: string; title: string; description: string | null; icon: string | null };

const VISIBLE_ROWS = 3;

export default function ClientPortal() {
  const { user } = useAuth();

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [showAllVersions, setShowAllVersions] = useState(false);

  // Empresas do cliente + conteúdo global (banners/serviços)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: access } = await supabase.from("user_company_access").select("company_id").eq("user_id", user.id);
      const companyIds = Array.from(new Set((access || []).map((a: any) => a.company_id)));
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase.from("companies").select("id, name").in("id", companyIds);
        const list = (companiesData || []) as { id: string; name: string }[];
        setCompanies(list);
        setCompanyId(list[0]?.id ?? null);
      }

      const [{ data: bannersData }, { data: servicesData }] = await Promise.all([
        supabase.from("portal_banners").select("id, image_url, title, link_url").eq("active", true).order("position"),
        supabase.from("portal_services").select("id, title, description, icon").eq("active", true).order("position"),
      ]);
      setBanners((bannersData || []) as Banner[]);
      setServices((servicesData || []) as ServiceItem[]);
    })();
  }, [user]);

  // Publicações da empresa selecionada
  useEffect(() => {
    if (!companyId) {
      setVersions([]);
      setLoadingVersions(false);
      return;
    }
    (async () => {
      setLoadingVersions(true);
      setShowAllVersions(false);

      const { data: projectsData } = await supabase.from("projects").select("id, name").eq("company_id", companyId);
      const projects = (projectsData || []) as { id: string; name: string }[];
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length === 0) {
        setVersions([]);
        setLoadingVersions(false);
        return;
      }
      const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

      const { data: presData } = await supabase
        .from("project_presentations")
        .select("id, project_id, slug, hero_title, client_logo_url")
        .in("project_id", projectIds)
        .eq("status", "publicado")
        .eq("released", true);
      const presentations = (presData || []) as { id: string; project_id: string; slug: string; hero_title: string | null; client_logo_url: string | null }[];
      const presentationIds = presentations.map((p) => p.id);
      if (presentationIds.length === 0) {
        setVersions([]);
        setLoadingVersions(false);
        return;
      }
      const presMap = new Map(presentations.map((p) => [p.id, p]));

      const { data: versionsData } = await supabase
        .from("presentation_versions")
        .select("id, name, created_at, presentation_id")
        .in("presentation_id", presentationIds)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false });

      const list: VersionRow[] = ((versionsData || []) as any[])
        .map((v) => {
          const pres = presMap.get(v.presentation_id);
          if (!pres) return null;
          return {
            id: v.id,
            name: v.name,
            created_at: v.created_at,
            slug: pres.slug,
            hero_title: pres.hero_title,
            client_logo_url: pres.client_logo_url,
            projectName: projectNameMap.get(pres.project_id) || "Projeto",
          };
        })
        .filter((v): v is VersionRow => v !== null);
      setVersions(list);
      setLoadingVersions(false);
    })();
  }, [companyId]);

  function openPresentation(slug: string) {
    window.open(`${window.location.origin}/c/${slug}`, "_blank");
  }

  const featured = versions[0] || null;
  const older = useMemo(() => versions.slice(1), [versions]);
  const olderVisible = showAllVersions ? older : older.slice(0, VISIBLE_ROWS);

  return (
    <div className="space-y-10">
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {companies.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={companyId ?? undefined} onValueChange={setCompanyId}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold mb-1">Suas apresentações</h1>
        <p className="text-sm text-muted-foreground">Acompanhe aqui os lançamentos liberados pela nossa equipe.</p>
      </div>

      {loadingVersions ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : !featured ? (
        <div className="text-center py-16 text-muted-foreground">
          <PresentationIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma apresentação disponível no momento</p>
        </div>
      ) : (
        <>
          <Card className="max-w-md overflow-hidden">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">Mais recente</p>
              <p className="font-semibold truncate">{featured.projectName} — {featured.name}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-32 rounded border bg-muted flex items-center justify-center overflow-hidden">
                {featured.client_logo_url ? (
                  <img src={featured.client_logo_url} alt={featured.projectName} className="h-full w-full object-contain p-4" />
                ) : (
                  <PresentationIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              {featured.hero_title && <p className="text-sm truncate">{featured.hero_title}</p>}
              <p className="text-xs text-muted-foreground">
                Lançado em {format(new Date(featured.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full gap-2" onClick={() => openPresentation(featured.slug)}>
                <ExternalLink className="h-4 w-4" /> Ver apresentação
              </Button>
            </CardFooter>
          </Card>

          {older.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Publicações anteriores</h2>
              <div className="space-y-2">
                {olderVisible.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => openPresentation(v.slug)}
                    className="w-full flex items-center justify-between gap-3 text-left border rounded-lg px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <span className="font-medium truncate">{v.projectName} — {v.name}</span>
                    <span className="text-sm text-muted-foreground shrink-0 flex items-center gap-2">
                      {format(new Date(v.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
              {older.length > VISIBLE_ROWS && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setShowAllVersions((s) => !s)}
                >
                  {showAllVersions ? "Ver menos" : `Ver mais (${older.length - VISIBLE_ROWS})`}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showAllVersions && "rotate-180")} />
                </Button>
              )}
            </section>
          )}
        </>
      )}

      {services.length > 0 && (
        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold">Nossos serviços</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = (s.icon && (Icons as any)[s.icon]) || Icons.Sparkles;
              return (
                <div key={s.id} className="rounded-xl border p-5 space-y-2 bg-background">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    setSelected(api.selectedScrollSnap());
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || banners.length < 2) return;
    const id = setInterval(() => {
      api.scrollNext();
    }, 6000);
    return () => clearInterval(id);
  }, [api, banners.length]);

  const Wrapper = ({ banner, children }: { banner: Banner; children: React.ReactNode }) =>
    banner.link_url ? (
      <a href={banner.link_url} target="_blank" rel="noreferrer" className="block">{children}</a>
    ) : (
      <>{children}</>
    );

  return (
    <div className="relative">
      <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
        <CarouselContent>
          {banners.map((b) => (
            <CarouselItem key={b.id}>
              <Wrapper banner={b}>
                <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] rounded-xl overflow-hidden bg-muted">
                  <img src={b.image_url} alt={b.title || ""} className="w-full h-full object-cover" />
                  {b.title && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white font-semibold">{b.title}</p>
                    </div>
                  )}
                </div>
              </Wrapper>
            </CarouselItem>
          ))}
        </CarouselContent>
        {banners.length > 1 && (
          <>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </>
        )}
      </Carousel>
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => api?.scrollTo(i)}
              className={cn("h-1.5 rounded-full transition-all", i === selected ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")}
              aria-label={`Ir para banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
