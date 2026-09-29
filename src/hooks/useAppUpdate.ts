import { useEffect, useState } from "react";

const EVENT_NAME = "app-update-available";

// Disparado pelo listener de "controllerchange" em main.tsx quando o Service
// Worker de uma nova versão publicada assume o controle da aba já aberta.
// Evento custom em vez de Context porque isso precisa ser chamado de fora da
// árvore React (main.tsx roda antes do createRoot().render()).
export function notifyAppUpdateAvailable() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useAppUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener(EVENT_NAME, onUpdate);
    return () => window.removeEventListener(EVENT_NAME, onUpdate);
  }, []);

  return available;
}
