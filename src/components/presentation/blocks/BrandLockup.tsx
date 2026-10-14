import { cn } from "@/lib/utils";
import { LEMA_LOGO_URL } from "@/lib/brand";

// Lockup minimalista do cabeçalho: logo do cliente | logo da Lema, separados
// por um traço fino vertical, sem caixa de fundo. Em cima de foto fica branco
// com drop-shadow; em fundo liso usa a cor de destaque do tema.
export default function BrandLockup({
  clientLogo,
  agencyLogo,
  onPhoto = false,
  size = "md",
  className,
}: {
  clientLogo?: string | null;
  agencyLogo?: string | null;
  onPhoto?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-16 md:h-28" : "h-8 md:h-12";
  // O wordmark é ~2,8:1 — altura menor que a do logo do cliente e largura
  // livre, pra ficar com peso visual parecido.
  const agencyH = size === "lg" ? "max-h-10 md:max-h-16 max-w-[40vw] md:max-w-[240px]" : "max-h-6 md:max-h-8 max-w-[30vw] md:max-w-[140px]";

  return (
    <div
      className={cn(
        "flex items-center gap-4 md:gap-6",
        onPhoto ? "text-white [filter:drop-shadow(0_1px_8px_rgba(0,0,0,0.45))]" : "text-[color:var(--pres-accent)]",
        className,
      )}
    >
      {clientLogo && (
        <>
          <img src={clientLogo} alt="Logo do cliente" className={cn(logoH, "w-auto max-w-[45vw] object-contain")} />
          <span className={cn("w-px bg-current opacity-60", logoH)} aria-hidden />
        </>
      )}
      <img
        src={agencyLogo || LEMA_LOGO_URL}
        alt="Lema"
        className={cn(agencyH, "w-auto object-contain", onPhoto && "brightness-0 invert")}
      />
    </div>
  );
}
