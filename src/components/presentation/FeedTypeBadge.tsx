import { Copy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedItemType } from "./mediaUtils";

// Badge do canto do tile do grid do Instagram: camadas pra carrossel, play
// pra vídeo, nada pra foto única (mesma convenção do app do Instagram).
export default function FeedTypeBadge({ type, className }: { type: FeedItemType; className?: string }) {
  if (type === "photo") return null;
  const Icon = type === "carousel" ? Copy : Play;
  return (
    <span
      className={cn("absolute top-1.5 right-1.5 pointer-events-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]", className)}
      aria-label={type === "carousel" ? "Carrossel" : "Vídeo"}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} fill={type === "video" ? "white" : "none"} />
    </span>
  );
}
