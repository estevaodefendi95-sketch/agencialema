import { Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROJECT_COLOR_PALETTE } from "@/lib/colorPalette";
import { cn } from "@/lib/utils";

interface ColorSwatchPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  palette?: string[];
  allowNone?: boolean;
  triggerClassName?: string;
}

// Same swatch-popover pattern used for column/task colors in KanbanBoard.tsx,
// extracted so Projects/Team can reuse it for project and profile colors.
export function ColorSwatchPicker({
  value,
  onChange,
  palette = PROJECT_COLOR_PALETTE,
  allowNone = false,
  triggerClassName,
}: ColorSwatchPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={triggerClassName ?? "h-6 w-6 rounded-full shrink-0 border border-border"}
          style={{ backgroundColor: value || "transparent" }}
          title="Escolher cor"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1.5 items-center flex-wrap max-w-[200px]">
          {allowNone && (
            <button
              type="button"
              className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground shrink-0"
              onClick={() => onChange(null)}
              title="Sem cor"
            />
          )}
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "h-6 w-6 rounded-full border-2 shrink-0",
                value === c ? "border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
            />
          ))}
          <label
            className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer shrink-0"
            title="Cor personalizada"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
            <input
              type="color"
              className="sr-only"
              value={value || "#000000"}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
