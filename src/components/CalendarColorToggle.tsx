import { Button } from "@/components/ui/button";
import { Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarColorMode } from "@/hooks/useCalendarColorMode";

// Mesmo padrão visual do toggle Cards/Lista de Projects.tsx (Button
// default/ghost dentro de um container com borda), reutilizado em qualquer
// tela de calendário que colore tarefas por empresa ou por responsável.
export function CalendarColorToggle({
  colorMode,
  onChange,
  className,
}: {
  colorMode: CalendarColorMode;
  onChange: (mode: CalendarColorMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center border rounded-lg overflow-hidden", className)}>
      <Button
        variant={colorMode === "empresa" ? "default" : "ghost"}
        size="sm"
        className="rounded-none gap-1.5 text-xs"
        onClick={() => onChange("empresa")}
      >
        <Building2 className="h-3.5 w-3.5" /> Por Empresa
      </Button>
      <Button
        variant={colorMode === "responsavel" ? "default" : "ghost"}
        size="sm"
        className="rounded-none gap-1.5 text-xs"
        onClick={() => onChange("responsavel")}
      >
        <User className="h-3.5 w-3.5" /> Por Responsável
      </Button>
    </div>
  );
}
