import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users, UserX, User } from "lucide-react";

function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name?: string | null;
  url?: string | null;
  className?: string;
  /** Special placeholder icon: all/none/user */
  placeholder?: "all" | "none" | "user";
}

export function AssigneeAvatar({ name, url, className, placeholder }: Props) {
  const Icon = placeholder === "all" ? Users : placeholder === "none" ? UserX : User;
  return (
    <Avatar className={cn("h-5 w-5 shrink-0", className)}>
      {url && !placeholder ? <AvatarImage src={url} alt={name || ""} /> : null}
      <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
        {placeholder ? <Icon className="h-3 w-3" /> : initials(name) || <User className="h-3 w-3" />}
      </AvatarFallback>
    </Avatar>
  );
}

export default AssigneeAvatar;
