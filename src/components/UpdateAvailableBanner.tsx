import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppUpdateAvailable } from "@/hooks/useAppUpdate";

// Mesma posição/estilo do InstallAppPrompt — os dois nunca aparecem juntos
// (InstallAppPrompt se esconde sozinho quando há atualização disponível).
export function UpdateAvailableBanner() {
  const available = useAppUpdateAvailable();
  const isMobile = useIsMobile();

  if (!available) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg md:left-auto md:right-4"
      style={{ bottom: isMobile ? "calc(4.5rem + env(safe-area-inset-bottom))" : "1rem" }}
    >
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Nova versão disponível</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Atualize para ver as últimas mudanças.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => window.location.reload()}>
          Atualizar agora
        </Button>
      </div>
    </div>
  );
}
