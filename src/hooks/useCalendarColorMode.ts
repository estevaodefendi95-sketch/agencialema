import { useState } from "react";
import { getEntityColor, PROJECT_COLOR_PALETTE, TEAM_COLOR_PALETTE } from "@/lib/colorPalette";

export type CalendarColorMode = "projeto" | "responsavel";

// Mesma chave em toda tela que usar o hook, pra preferência do usuário valer
// em qualquer calendário (TaskCalendar, MyTasks, ClientCalendar...).
const STORAGE_KEY = "calendar-color-mode";

export interface TaskColorInput {
  manualColor?: string | null;
  projectId: string;
  projectColor?: string | null;
  assignedTo?: string | null;
  assigneeColor?: string | null;
  assigneeName?: string | null;
}

export function useCalendarColorMode(defaultMode: CalendarColorMode = "projeto") {
  const [colorMode, setColorModeState] = useState<CalendarColorMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as CalendarColorMode) || defaultMode;
  });

  function setColorMode(mode: CalendarColorMode) {
    if (!mode) return;
    setColorModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  // Cor manual da tarefa sempre tem precedência; senão usa a cor automática
  // (com hash estável) do projeto ou do responsável, conforme colorMode.
  function getTaskColor(task: TaskColorInput): string {
    if (task.manualColor) return task.manualColor;
    if (colorMode === "projeto") {
      return getEntityColor(task.projectId, task.projectColor ?? null, PROJECT_COLOR_PALETTE);
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
