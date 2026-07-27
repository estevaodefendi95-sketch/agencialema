// Opções de lembrete usadas em todo formulário de criar/editar tarefa
// (KanbanBoard, MyTasks, TaskCalendar, TaskDetail).
export const REMINDER_OPTIONS: { value: string; label: string; minutes: number | null }[] = [
  { value: "none", label: "Sem lembrete", minutes: null },
  { value: "10", label: "10 minutos antes", minutes: 10 },
  { value: "30", label: "30 minutos antes", minutes: 30 },
  { value: "60", label: "1 hora antes", minutes: 60 },
  { value: "1440", label: "1 dia antes", minutes: 1440 },
];

// tasks.due_time vem do Postgres como "HH:MM:SS" — exibe só "HH:MM".
export function formatDueTime(dueTime: string | null | undefined): string | null {
  if (!dueTime) return null;
  return dueTime.slice(0, 5);
}
