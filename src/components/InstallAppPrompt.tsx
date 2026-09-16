import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed";

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) {
      setHidden(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    if (isIos) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!deferred && !showIosHint)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg md:left-auto md:right-4">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="Lema" width={40} height={40} className="h-10 w-10 rounded-lg" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Instalar o Lema</p>
          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Acesse direto da tela inicial, em tela cheia.
              </p>
              <Button size="sm" className="mt-3" onClick={install}>
                <Download className="mr-2 h-4 w-4" /> Instalar
              </Button>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toque em <Share className="inline h-3 w-3" /> Compartilhar e escolha “Adicionar à Tela de Início”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
