import type { ComponentType, ReactNode } from "react";
import {
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Grade mensal, grade semanal e lista do dia — a mesma lógica de
// alternância Mês/Semana/Dia usada em todo calendário de tarefas do app
// (TaskCalendar, MyTasks, ClientCalendar, aba Calendário do Kanban).
// Cada tela passa suas próprias tarefas já filtradas e um componente de
// item (pill compacto pro Mês/Semana, card detalhado pro Dia).

interface GridProps<T> {
  cursor: Date;
  getDayTasks: (day: Date) => T[];
  ItemComponent: ComponentType<{ task: T }>;
  getTaskKey: (task: T) => string;
  onDayClick: (day: Date) => void;
  onAddDay?: (day: Date) => void;
  maxVisible?: number;
  /** Substitui o "+N mais" padrão (texto simples) por algo customizado, ex: um Popover com a lista completa. */
  renderOverflow?: (day: Date, dayTasks: T[], overflowCount: number) => ReactNode;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarMonthGrid<T>({
  cursor,
  getDayTasks,
  ItemComponent,
  getTaskKey,
  onDayClick,
  onAddDay,
  maxVisible = 3,
  renderOverflow,
}: GridProps<T>) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 bg-muted/40 border-b">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const dayTasks = getDayTasks(day);
          const visible = dayTasks.slice(0, maxVisible);
          const overflow = dayTasks.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "group min-h-[110px] border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-accent/30 transition-colors",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>
                {onAddDay && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddDay(day); }}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
                    title="Nova tarefa neste dia"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map((t) => (
                  <ItemComponent key={getTaskKey(t)} task={t} />
                ))}
                {overflow > 0 && (
                  renderOverflow ? (
                    renderOverflow(day, dayTasks, overflow)
                  ) : (
                    <span className="text-[10px] text-muted-foreground px-1.5">+{overflow} mais</span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarWeekGrid<T>({
  cursor,
  getDayTasks,
  ItemComponent,
  getTaskKey,
  onDayClick,
  onAddDay,
}: GridProps<T>) {
  const ws = startOfWeek(cursor, { weekStartsOn: 0 });
  const we = endOfWeek(cursor, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: ws, end: we });

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const today = isToday(day);
          const dayTasks = getDayTasks(day);
          return (
            <div key={day.toISOString()} className="border-r last:border-r-0 flex flex-col min-h-[500px]">
              <div className={cn("group flex items-center justify-between px-2 py-2 border-b", today && "bg-primary/5")}>
                <button onClick={() => onDayClick(day)} className="text-left hover:opacity-80 flex-1 transition-colors">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{format(day, "EEE", { locale: ptBR })}</div>
                  <div className={cn("text-lg font-semibold inline-flex h-7 min-w-7 px-1 items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                    {format(day, "d")}
                  </div>
                </button>
                {onAddDay && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddDay(day); }}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
                    title="Nova tarefa neste dia"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="p-1.5 flex flex-col gap-1 flex-1 overflow-y-auto">
                {dayTasks.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground text-center mt-4">—</span>
                ) : (
                  dayTasks.map((t) => <ItemComponent key={getTaskKey(t)} task={t} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayListProps<T> {
  tasks: T[];
  ItemComponent: ComponentType<{ task: T }>;
  getTaskKey: (task: T) => string;
  emptyState?: ReactNode;
}

export function CalendarDayList<T>({ tasks, ItemComponent, getTaskKey, emptyState }: DayListProps<T>) {
  if (tasks.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <ItemComponent key={getTaskKey(t)} task={t} />
      ))}
    </div>
  );
}
