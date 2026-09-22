import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  format,
  isSameDay,
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
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  /** Cor de cada tarefa, usada nos pontinhos da grade compacta no mobile. */
  getTaskColor?: (task: T) => string;
  /** Substitui o "+N mais" padrão (texto simples) por algo customizado, ex: um Popover com a lista completa. */
  renderOverflow?: (day: Date, dayTasks: T[], overflowCount: number) => ReactNode;
  /**
   * Ação fixa no rodapé de cada coluna de dia (sempre visível, não só no
   * hover) — diferente de onAddDay, que é o botão pequeno no topo da coluna
   * que só aparece no hover. Usado pra abrir um menu de escolha de tipo de
   * tarefa, por exemplo. Só se aplica à grade semanal.
   */
  renderDayFooterAction?: (day: Date) => ReactNode;
  /**
   * Liga o drag-and-drop (dia = Droppable, tarefa = Draggable). Precisa de um
   * <DragDropContext> como ancestral — quem chama com dragEnabled é
   * responsável por isso. Sem essa prop, a grade renderiza exatamente como
   * antes (sem @hello-pangea/dnd), pra não quebrar quem usa a grade sem um
   * DragDropContext por perto (ex: ClientCalendar, aba Calendário do Kanban).
   */
  dragEnabled?: boolean;
  /** Quando dragEnabled, decide se uma tarefa específica pode ser arrastada. Default: todas podem. */
  canDragTask?: (task: T) => boolean;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_DOT_COLOR = "hsl(var(--muted-foreground))";

function TaskDots<T>({ tasks, getTaskKey, getTaskColor }: { tasks: T[]; getTaskKey: (task: T) => string; getTaskColor?: (task: T) => string }) {
  if (tasks.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {tasks.slice(0, 3).map((t) => (
        <span
          key={getTaskKey(t)}
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: getTaskColor ? getTaskColor(t) : DEFAULT_DOT_COLOR }}
        />
      ))}
    </div>
  );
}

/**
 * Envolve o conteúdo de uma célula de dia num Droppable único (dia inteiro
 * é alvo do drop, não só a lista de tarefas) — isso permite destacar a
 * célula inteira (fundo + anel) quando uma tarefa está sendo arrastada por
 * cima, igual ao Kanban. Sem dragEnabled, renderiza exatamente como antes
 * (div simples, sem @hello-pangea/dnd).
 */
function DroppableDayCell({
  day,
  dragEnabled,
  className,
  onClick,
  children,
}: {
  day: Date;
  dragEnabled?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (!dragEnabled) {
    return <div onClick={onClick} className={className}>{children}</div>;
  }
  const droppableId = format(day, "yyyy-MM-dd");
  return (
    <Droppable droppableId={droppableId} type="CALENDAR_TASK">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          onClick={onClick}
          className={cn(className, "transition-colors", snapshot.isDraggingOver && "bg-primary/20 ring-2 ring-inset ring-primary")}
        >
          {children}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

/** Lista de tarefas de um dia, opcionalmente arrastável — precisa de um DroppableDayCell como ancestral quando dragEnabled. */
function TaskList<T>({
  tasks,
  ItemComponent,
  getTaskKey,
  dragEnabled,
  canDragTask,
  emptyState,
}: {
  tasks: T[];
  ItemComponent: ComponentType<{ task: T }>;
  getTaskKey: (task: T) => string;
  dragEnabled?: boolean;
  canDragTask?: (task: T) => boolean;
  emptyState?: ReactNode;
}) {
  if (!dragEnabled) {
    return (
      <>
        {tasks.map((t) => (
          <ItemComponent key={getTaskKey(t)} task={t} />
        ))}
        {tasks.length === 0 && emptyState}
      </>
    );
  }

  return (
    <>
      {tasks.map((t, idx) => (
        <Draggable key={getTaskKey(t)} draggableId={getTaskKey(t)} index={idx} isDragDisabled={canDragTask ? !canDragTask(t) : false}>
          {(dragProvided, snapshot) => (
            <div
              ref={dragProvided.innerRef}
              {...dragProvided.draggableProps}
              {...dragProvided.dragHandleProps}
              className={cn("transition-all", snapshot.isDragging && "shadow-md opacity-90")}
              style={{
                ...dragProvided.draggableProps.style,
                transform: snapshot.isDragging
                  ? `${dragProvided.draggableProps.style?.transform || ""} scale(0.95)`
                  : dragProvided.draggableProps.style?.transform,
              }}
            >
              <ItemComponent task={t} />
            </div>
          )}
        </Draggable>
      ))}
      {tasks.length === 0 && emptyState}
    </>
  );
}

function MobileDayList<T>({
  day,
  tasks,
  ItemComponent,
  getTaskKey,
  dragEnabled,
  canDragTask,
}: {
  day: Date;
  tasks: T[];
  ItemComponent: ComponentType<{ task: T }>;
  getTaskKey: (task: T) => string;
  dragEnabled?: boolean;
  canDragTask?: (task: T) => boolean;
}) {
  return (
    <div className="border-t p-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">
        {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </p>
      <DroppableDayCell day={day} dragEnabled={dragEnabled} className="space-y-2">
        <TaskList
          tasks={tasks}
          ItemComponent={ItemComponent}
          getTaskKey={getTaskKey}
          dragEnabled={dragEnabled}
          canDragTask={canDragTask}
          emptyState={<p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa neste dia</p>}
        />
      </DroppableDayCell>
    </div>
  );
}

export function CalendarMonthGrid<T>({
  cursor,
  getDayTasks,
  ItemComponent,
  getTaskKey,
  onDayClick,
  onAddDay,
  maxVisible = 3,
  getTaskColor,
  renderOverflow,
  dragEnabled,
  canDragTask,
}: GridProps<T>) {
  const isMobile = useIsMobile();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  useEffect(() => {
    setSelectedDay(null);
  }, [monthStart.getTime()]);

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

          if (isMobile) {
            const selected = !!selectedDay && isSameDay(day, selectedDay);
            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "min-h-[48px] border-r border-b last:border-r-0 p-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
                  !inMonth && "text-muted-foreground",
                  selected && "bg-accent",
                )}
              >
                <span className={cn("text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>
                <TaskDots tasks={dayTasks} getTaskKey={getTaskKey} getTaskColor={getTaskColor} />
              </div>
            );
          }

          const visible = dayTasks.slice(0, maxVisible);
          const overflow = dayTasks.length - visible.length;
          return (
            <DroppableDayCell
              key={day.toISOString()}
              day={day}
              dragEnabled={dragEnabled}
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
                <TaskList
                  tasks={visible}
                  ItemComponent={ItemComponent}
                  getTaskKey={getTaskKey}
                  dragEnabled={dragEnabled}
                  canDragTask={canDragTask}
                />
                {overflow > 0 && (
                  renderOverflow ? (
                    renderOverflow(day, dayTasks, overflow)
                  ) : (
                    <span className="text-[10px] text-muted-foreground px-1.5">+{overflow} mais</span>
                  )
                )}
              </div>
            </DroppableDayCell>
          );
        })}
      </div>
      {isMobile && selectedDay && (
        <MobileDayList day={selectedDay} tasks={getDayTasks(selectedDay)} ItemComponent={ItemComponent} getTaskKey={getTaskKey} dragEnabled={dragEnabled} canDragTask={canDragTask} />
      )}
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
  getTaskColor,
  renderDayFooterAction,
  dragEnabled,
  canDragTask,
}: GridProps<T>) {
  const isMobile = useIsMobile();
  const ws = startOfWeek(cursor, { weekStartsOn: 0 });
  const we = endOfWeek(cursor, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: ws, end: we });

  const [selectedDay, setSelectedDay] = useState<Date>(() => days.find((d) => isToday(d)) ?? days[0]);
  useEffect(() => {
    setSelectedDay(days.find((d) => isToday(d)) ?? days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.getTime()]);

  if (isMobile) {
    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b">
          {days.map((day) => {
            const today = isToday(day);
            const selected = isSameDay(day, selectedDay);
            const dayTasks = getDayTasks(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "min-h-[56px] flex flex-col items-center justify-center gap-1 py-2 border-r last:border-r-0 transition-colors",
                  selected && "bg-accent",
                )}
              >
                <span className="text-[10px] uppercase text-muted-foreground">{format(day, "EEEEE", { locale: ptBR })}</span>
                <span className={cn("text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full", today && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>
                <TaskDots tasks={dayTasks} getTaskKey={getTaskKey} getTaskColor={getTaskColor} />
              </button>
            );
          })}
        </div>
        <MobileDayList day={selectedDay} tasks={getDayTasks(selectedDay)} ItemComponent={ItemComponent} getTaskKey={getTaskKey} dragEnabled={dragEnabled} canDragTask={canDragTask} />
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const today = isToday(day);
          const dayTasks = getDayTasks(day);
          return (
            <div key={day.toISOString()} className={cn("group border-r last:border-r-0 flex flex-col", dragEnabled ? "min-h-[140px]" : "min-h-[500px]")}>
              <div className={cn("flex items-center justify-between px-2 py-2 border-b", today && "bg-primary/5")}>
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
              {/* Sem overflow/max-height quando dragEnabled: a célula cresce
                  com o conteúdo e quem rola é a página, não a célula — uma
                  célula com scroll próprio dentro de um Droppable quebra o
                  drag-and-drop. Sem drag (ex: ClientCalendar), mantém a
                  rolagem interna de antes. */}
              <DroppableDayCell
                day={day}
                dragEnabled={dragEnabled}
                onClick={() => onDayClick(day)}
                className={cn("p-1.5 flex flex-col gap-1 flex-1", !dragEnabled && "overflow-y-auto")}
              >
                <TaskList
                  tasks={dayTasks}
                  ItemComponent={ItemComponent}
                  getTaskKey={getTaskKey}
                  dragEnabled={dragEnabled}
                  canDragTask={canDragTask}
                  emptyState={<span className="text-[10px] text-muted-foreground text-center mt-4">—</span>}
                />
                {renderDayFooterAction && (
                  <div className="flex justify-center mt-1" onClick={(e) => e.stopPropagation()}>
                    {renderDayFooterAction(day)}
                  </div>
                )}
              </DroppableDayCell>
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
  /** Ação no rodapé, logo abaixo da última tarefa da lista — ex: botão "+" visível no hover. */
  footerAction?: ReactNode;
}

export function CalendarDayList<T>({ tasks, ItemComponent, getTaskKey, emptyState, footerAction }: DayListProps<T>) {
  if (tasks.length === 0 && emptyState) {
    return (
      <>
        {emptyState}
        {footerAction && <div className="flex justify-center mt-1">{footerAction}</div>}
      </>
    );
  }
  return (
    <div className="w-full space-y-2">
      {tasks.map((t) => (
        <ItemComponent key={getTaskKey(t)} task={t} />
      ))}
      {footerAction && <div className="flex justify-center mt-1">{footerAction}</div>}
    </div>
  );
}
