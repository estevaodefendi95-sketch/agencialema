import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { notifyAppUpdateAvailable } from "@/hooks/useAppUpdate";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // sw.js chama skipWaiting()/clients.claim() sozinho, então o novo
        // Service Worker assume o controle automaticamente assim que ativa —
        // "controllerchange" é o sinal confiável disso. Só conta como
        // atualização se a aba já estava sendo controlada por uma versão
        // anterior; senão seria só a primeira instalação (nada pra avisar).
        let hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hadController) notifyAppUpdateAvailable();
          hadController = true;
        });

        // O navegador já reverifica o sw.js sozinho de vez em quando, mas
        // isso força uma checagem a cada poucos minutos enquanto a aba
        // estiver visível (e assim que ela volta a ficar visível), pra quem
        // fica com a aba aberta por muito tempo perceber a atualização mais
        // rápido.
        const CHECK_INTERVAL_MS = 5 * 60 * 1000;
        const checkForUpdate = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };
        setInterval(checkForUpdate, CHECK_INTERVAL_MS);
        document.addEventListener("visibilitychange", checkForUpdate);
      })
      .catch(() => {
        /* instalação offline indisponível — app segue normal */
      });
  });
}
