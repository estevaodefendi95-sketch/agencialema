import { useState } from "react";
import { getEntityColor, PROJECT_COLOR_PALETTE, TEAM_COLOR_PALETTE } from "@/lib/colorPalette";

export type CalendarColorMode = "empresa" | "responsavel";

// Mesma chave em toda tela que usar o hook, pra preferência do usuário valer
// em qualquer calendário (TaskCalendar, MyTasks, ClientCalendar...).
const STORAGE_KEY = "calendar-color-mode";

export interface TaskColorInput {
  manualColor?: string | null;
  companyId: string;
  companyColor?: string | null;
  assignedTo?: string | null;
  assigneeColor?: string | null;
  assigneeName?: string | null;
}

export function useCalendarColorMode(defaultMode: CalendarColorMode = "empresa") {
  const [colorMode, setColorModeState] = useState<CalendarColorMode>(() => {
    // "projeto" era o nome antigo do modo "empresa" — migra quem já tinha
    // essa preferência salva, sem cair no "responsavel" sem querer.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "projeto") return "empresa";
    return (saved as CalendarColorMode) || defaultMode;
  });

  function setColorMode(mode: CalendarColorMode) {
    if (!mode) return;
    setColorModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  // Cor manual da tarefa sempre tem precedência; senão usa a cor automática
  // (com hash estável) da empresa ou do responsável, conforme colorMode.
  function getTaskColor(task: TaskColorInput): string {
    if (task.manualColor) return task.manualColor;
    if (colorMode === "empresa") {
      return getEntityColor(task.companyId, task.companyColor ?? null, PROJECT_COLOR_PALETTE);
    }
    if (task.assignedTo) {
      return getEntityColor(task.assignedTo, task.assigneeColor ?? null, TEAM_COLOR_PALETTE);
    }
    if (task.assigneeName) {
      return getEntityColor(task.assigneeName.trim().toLowerCase(), null, TEAM_COLOR_PALETTE);
    }
    return "#94a3b8";
  }

  return { colorMode, setColorMode, getTaskColor };
}
