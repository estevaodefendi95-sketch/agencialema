import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Search, Building2, FolderKanban, CheckSquare, Loader2 } from "lucide-react";

type CompanyResult = { id: string; name: string };
type ProjectResult = { id: string; name: string; companyName: string | null };
type TaskResult = { id: string; title: string; project_id: string; projectName: string | null };

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [tasks, setTasks] = useState<TaskResult[]>([]);

  // Atalho global Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounce do termo digitado
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Busca paralela em empresas, projetos e tarefas
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setCompanies([]);
      setProjects([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const term = `%${debouncedQuery}%`;
    (async () => {
      const [{ data: companyData }, { data: projectData }, { data: taskData }] = await Promise.all([
        supabase.from("companies").select("id, name").ilike("name", term).limit(8),
        supabase.from("projects").select("id, name, companies(name)").eq("archived", false).ilike("name", term).limit(8),
        supabase.from("tasks").select("id, title, project_id, projects(name)").ilike("title", term).limit(8),
      ]);
      if (cancelled) return;
      setCompanies((companyData || []) as CompanyResult[]);
      setProjects(
        ((projectData || []) as any[]).map((p) => ({ id: p.id, name: p.name, companyName: p.companies?.name || null })),
      );
      setTasks(
        ((taskData || []) as any[]).map((t) => ({
          id: t.id,
          title: t.title,
          project_id: t.project_id,
          projectName: t.projects?.name || null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Reseta a busca ao fechar
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setCompanies([]);
      setProjects([]);
      setTasks([]);
    }
  }, [open]);

  function goToCompanies() {
    setOpen(false);
    navigate("/empresas");
  }
  function goToProject(id: string) {
    setOpen(false);
    navigate(`/projetos/${id}`);
  }

  const hasResults = companies.length + projects.length + tasks.length > 0;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full max-w-sm justify-between h-9 px-3 text-sm font-normal text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Buscar...
        </span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0 shadow-lg">
          <DialogTitle className="sr-only">Busca global</DialogTitle>
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar empresas, projetos e tarefas..." />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                </div>
              )}
              {!loading && debouncedQuery.length < 2 && (
                <CommandEmpty>Digite para buscar em empresas, projetos e tarefas</CommandEmpty>
              )}
              {!loading && debouncedQuery.length >= 2 && !hasResults && (
                <CommandEmpty>{`Nenhum resultado para "${debouncedQuery}"`}</CommandEmpty>
              )}

              {companies.length > 0 && (
                <CommandGroup heading="Empresas">
                  {companies.map((c) => (
                    <CommandItem key={`company-${c.id}`} value={`company-${c.id}`} onSelect={goToCompanies}>
                      <Building2 className="mr-2 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {projects.length > 0 && (
                <CommandGroup heading="Projetos">
                  {projects.map((p) => (
                    <CommandItem key={`project-${p.id}`} value={`project-${p.id}`} onSelect={() => goToProject(p.id)}>
                      <FolderKanban className="mr-2 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{p.name}</span>
                        {p.companyName && <span className="text-xs text-muted-foreground truncate">{p.companyName}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {tasks.length > 0 && (
                <CommandGroup heading="Tarefas">
                  {tasks.map((t) => (
                    <CommandItem key={`task-${t.id}`} value={`task-${t.id}`} onSelect={() => goToProject(t.project_id)}>
                      <CheckSquare className="mr-2 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{t.title}</span>
                        {t.projectName && <span className="text-xs text-muted-foreground truncate">{t.projectName}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
