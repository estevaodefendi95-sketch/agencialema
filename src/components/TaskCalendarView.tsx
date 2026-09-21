import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  addWeeks,
  addDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDayRender, type DayProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, CornerDownRight, Check } from "lucide-react";
import { CalendarTaskPill, type CalendarTaskLike } from "@/components/CalendarTaskPill";
import { CalendarColorToggle } from "@/components/CalendarColorToggle";
import { CalendarMonthGrid, CalendarWeekGrid } from "@/components/CalendarMonthWeekDay";
import type { CalendarColorMode } from "@/hooks/useCalendarColorMode";
import { formatDueTime } from "@/lib/taskReminders";
import { cn } from "@/lib/utils";

// Prefixo dos droppables do mini-mês da visão Dia — distingue "solte aqui
// pra mudar a data" (mini-mês) de "solte aqui pra reordenar" (lista do dia
// e grades Mês/Semana, que usam o id puro yyyy-MM-dd).
const MINI_MONTH_PREFIX = "mini:";

// Layout único de calendário de tarefas, usado por Calendário (TaskCalendar),
// Minhas Tarefas → Calendário (MyTasks) e Projeto → Calendário (KanbanBoard).
// Cada tela continua dona da sua fonte de dados, filtros e regras — só passa
// a lista de tarefas já filtrada e algumas funções de leitura/escrita. Os
// slots `filters` e `headerActions` são pro que cada tela tem de próprio.

export type CalendarViewMode = "mes" | "semana" | "dia";

export interface CalendarViewTask extends CalendarTaskLike {
  due_date: string;
  color?: string | null;
  /** Ordem manual dentro do dia (drag-and-drop). Opcional — quem não suporta reordenar dentro do dia (ex: Kanban) simplesmente não tem esse campo. */
  day_order?: number | null;
  /** Critério de desempate depois de day_order/due_time. Opcional pelo mesmo motivo acima. */
  created_at?: string;
}

const priorityColor: Record<string, string> = {
  baixa: "bg-blue-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  urgente: "bg-red-500",
};

const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

/**
 * Dia do mini-mês (visão Dia) como alvo de drop — solta uma tarefa nele pra
 * mudar a data. Preserva o comportamento padrão do dia (seleção, hoje, fora
 * do mês, desabilitado) via useDayRender, só acrescentando o Droppable e o
 * destaque de "arrastando por cima".
 */
function DroppableMiniDay(props: DayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dayRender = useDayRender(props.date, props.displayMonth, buttonRef);

  if (dayRender.isHidden) return <div role="gridcell" />;
  if (!dayRender.isButton) return <div {...dayRender.divProps} />;

  const droppableId = `${MINI_MONTH_PREFIX}${format(props.date, "yyyy-MM-dd")}`;
  return (
    <Droppable droppableId={droppableId} type="CALENDAR_TASK">
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          <button
            {...dayRender.buttonProps}
            ref={buttonRef}
            className={cn(dayRender.buttonProps.className, snapshot.isDraggingOver && "ring-2 ring-primary bg-primary/20")}
          />
          <div className="hidden">{provided.placeholder}</div>
        </div>
      )}
    </Droppable>
  );
}

// Ordem das tarefas dentro de um dia: day_order (drag-and-drop) primeiro,
// depois horário, depois criação — sem day_order (null/undefined), fica
// sempre por último dentro do critério seguinte.
function compareDayOrder<T extends CalendarViewTask>(a: T, b: T): number {
  if (a.day_order != null && b.day_order != null && a.day_order !== b.day_order) return a.day_order - b.day_order;
  if (a.day_order != null && b.day_order == null) return -1;
  if (a.day_order == null && b.day_order != null) return 1;
  if (a.due_time && b.due_time && a.due_time !== b.due_time) return a.due_time.localeCompare(b.due_time);
  if (a.due_time && !b.due_time) return -1;
  if (!a.due_time && b.due_time) return 1;
  if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at);
  return 0;
}

export interface TaskCalendarViewProps<T extends CalendarViewTask> {
  tasks: T[];
  colorMode: CalendarColorMode;
  onColorModeChange: (mode: CalendarColorMode) => void;
  /** Cor da tarefa (pontinho/borda/pílula) — o cálculo depende de campos que variam por tela, então cada uma resolve a sua. */
  getTaskColor: (task: T) => string;
  onOpenTask: (task: T) => void;
  onCreate: (date: Date) => void;
  onToggleComplete: (task: T, e?: React.MouseEvent) => void;
  /** Drag-and-drop do calendário (mover/reordenar tarefa entre dias). Sem essa prop, o calendário renderiza sem @hello-pangea/dnd — é o caso do Projeto, que não reordena tarefas no calendário. */
  onMoveTask?: (result: DropResult) => void;
  canEdit: boolean;
  canDragTask?: (task: T) => boolean;
  /** Linha de metadados do card detalhado da visão Dia (projeto/empresa, badge "Pessoal", chip de responsável...) — específica de cada tela. */
  renderTaskMeta?: (task: T) => ReactNode;
  /** Filtros próprios da tela (empresa/projeto/responsável/status no Calendário; projeto/prioridade/prazo em Minhas Tarefas; responsável no Projeto). */
  filters?: ReactNode;
  /** Ações extras na barra de ferramentas, ao lado de Hoje (ex: botão Nova Tarefa fixo). */
  headerActions?: ReactNode;
  /** Chave de localStorage pra lembrar o modo (Mês/Semana/Dia) por tela. */
  storageKey: string;
  loading?: boolean;
  /** Chamado sempre que o modo ou o cursor mudam — pra quem precisa saber o período visível (ex: legenda escopada ao período, como no Calendário). */
  onPeriodChange?: (range: { start: Date; end: Date }) => void;
}

export function TaskCalendarView<T extends CalendarViewTask>({
  tasks,
  colorMode,
  onColorModeChange,
  getTaskColor,
  onOpenTask,
  onCreate,
  onToggleComplete,
  onMoveTask,
  canEdit,
  canDragTask,
  renderTaskMeta,
  filters,
  headerActions,
  storageKey,
  loading,
  onPeriodChange,
}: TaskCalendarViewProps<T>) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    return (localStorage.getItem(storageKey) as CalendarViewMode) || "mes";
  });
  const [cursor, setCursor] = useState<Date>(new Date());
  const [miniMonthOpen, setMiniMonthOpen] = useState(false);

  useEffect(() => {
    if (!onPeriodChange) return;
    if (viewMode === "mes") {
      onPeriodChange({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) });
    } else if (viewMode === "semana") {
      onPeriodChange({ start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) });
    } else {
      onPeriodChange({ start: cursor, end: cursor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, cursor.getTime()]);

  const changeViewMode = (m: CalendarViewMode) => {
    if (!m) return;
    setViewMode(m);
    localStorage.setItem(storageKey, m);
  };

  const tasksByDay = new Map<string, T[]>();
  tasks.forEach((t) => {
    if (!t.due_date) return;
    if (!tasksByDay.has(t.due_date)) tasksByDay.set(t.due_date, []);
    tasksByDay.get(t.due_date)!.push(t);
  });
  tasksByDay.forEach((list) => list.sort(compareDayOrder));

  const getDayTasks = (d: Date) => tasksByDay.get(format(d, "yyyy-MM-dd")) || [];
  const datesWithTasks = tasks.filter((t) => !!t.due_date).map((t) => new Date(t.due_date + "T00:00:00"));

  const periodLabel = (() => {
    if (viewMode === "mes") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(ws, "d 'de' MMM", { locale: ptBR })} – ${format(we, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  })();

  const navPrev = () => {
    if (viewMode === "mes") setCursor((c) => subMonths(c, 1));
    else if (viewMode === "semana") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => addDays(c, -1));
  };
  const navNext = () => {
    if (viewMode === "mes") setCursor((c) => addMonths(c, 1));
    else if (viewMode === "semana") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };
  const goToday = () => setCursor(new Date());

  const TaskPill = ({ task }: { task: T }) => (
    <CalendarTaskPill
      task={task}
      color={getTaskColor(task)}
      colorMode={colorMode}
      priorityColor={priorityColor}
      onOpen={onOpenTask}
      onToggleDone={onToggleComplete}
    />
  );

  // Estrutural (existe o DragDropContext) sempre que a tela oferece
  // onMoveTask — a permissão de arrastar CADA tarefa é decidida por
  // canDragTask (ex: só quem pode editar, ou só o autor na tarefa pessoal),
  // não por canEdit aqui: senão ninguém sem canEdit conseguiria arrastar
  // nem as próprias tarefas pessoais.
  const dragEnabled = !!onMoveTask;

  // Solto no mini-mês (visão Dia) = mudar de dia, sempre no fim da lista do
  // dia de destino (não há posição visível lá pra escolher um índice).
  // Solto na lista/grade normal = comportamento de sempre (reordenar ou
  // mover pro índice largado).
  const handleDragEnd = (result: DropResult) => {
    if (!onMoveTask) return;
    const { destination } = result;
    if (destination?.droppableId.startsWith(MINI_MONTH_PREFIX)) {
      const destDate = destination.droppableId.slice(MINI_MONTH_PREFIX.length);
      const appendIndex = getDayTasks(new Date(`${destDate}T00:00:00`)).length;
      onMoveTask({ ...result, destination: { droppableId: destDate, index: appendIndex } });
      return;
    }
    onMoveTask(result);
  };

  const NewTaskButton = ({ day, iconOnly }: { day: Date; iconOnly?: boolean }) =>
    iconOnly ? (
      <button
        onClick={(e) => { e.stopPropagation(); onCreate(day); }}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
        title="Nova tarefa"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    ) : (
      <Button className="gap-2" size="sm" onClick={() => onCreate(day)}>
        <Plus className="h-4 w-4" /> Nova Tarefa
      </Button>
    );

  const MiniMonth = () => (
    <Card>
      <CardContent className="p-3">
        <Calendar
          mode="single"
          selected={cursor}
          onSelect={(d) => d && setCursor(d)}
          locale={ptBR}
          modifiers={{ hasTasks: datesWithTasks }}
          modifiersClassNames={{
            hasTasks:
              "relative font-bold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
          }}
          className="pointer-events-auto"
          components={dragEnabled ? { Day: DroppableMiniDay } : undefined}
        />
        <div className="mt-3 px-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Prioridade</p>
          {Object.entries(priorityLabel).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 rounded-full", priorityColor[key])} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const DayTaskCard = ({ task }: { task: T }) => {
    const color = getTaskColor(task);
    const done = task.status === "concluido";
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onOpenTask(task); }}
        className="w-full text-left p-3 rounded-lg border border-l-4 transition-colors cursor-pointer"
        style={{ borderLeftColor: color, backgroundColor: `${color}15` }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onToggleComplete(task, e); }}
              className={cn(
                "h-4 w-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
                done ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary",
              )}
              title={done ? "Marcar como não concluída" : "Marcar como concluída"}
            >
              {done && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
            </span>
            {task.parent_task_id && (
              <span title="Subtarefa"><CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /></span>
            )}
            <span className={cn("line-clamp-2 leading-snug break-words", done && "line-through opacity-60")}>{task.title}</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {task.due_time && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDueTime(task.due_time)}
              </span>
            )}
            <Badge variant="outline" className="shrink-0">
              <span className={cn("h-2 w-2 rounded-full mr-1.5", priorityColor[task.priority])} />
              {priorityLabel[task.priority] || task.priority}
            </Badge>
          </div>
        </div>
        {renderTaskMeta && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {renderTaskMeta(task)}
          </div>
        )}
      </div>
    );
  };

  const DayView = () => {
    const dayTasks = getDayTasks(cursor);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <div className="lg:hidden">
          <Collapsible open={miniMonthOpen} onOpenChange={setMiniMonthOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between mb-2">
                Mini calendário
                <ChevronDown className={cn("h-4 w-4 transition-transform", miniMonthOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <MiniMonth />
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="hidden lg:block">
          <MiniMonth />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg capitalize">{periodLabel}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {dayTasks.length} {dayTasks.length === 1 ? "tarefa" : "tarefas"}
              </p>
            </div>
            {canEdit && <NewTaskButton day={cursor} />}
          </CardHeader>
          <CardContent className="group" onClick={() => canEdit && onCreate(cursor)}>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : dayTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa neste dia</div>
            ) : (
              <ScrollArea className="max-h-[500px] pr-3">
                {dragEnabled ? (
                  <Droppable droppableId={format(cursor, "yyyy-MM-dd")} type="CALENDAR_TASK">
                    {(dropProvided, dropSnapshot) => (
                      <div
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                        className={cn("space-y-2 rounded-lg transition-colors", dropSnapshot.isDraggingOver && "bg-primary/10 ring-2 ring-inset ring-primary")}
                      >
                        {dayTasks.map((task, idx) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={idx}
                            isDragDisabled={canDragTask ? !canDragTask(task) : false}
                          >
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn("transition-shadow", snapshot.isDragging && "shadow-lg")}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  transform: snapshot.isDragging
                                    ? `${dragProvided.draggableProps.style?.transform || ""} rotate(2deg)`
                                    : dragProvided.draggableProps.style?.transform,
                                }}
                              >
                                <DayTaskCard task={task} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map((task) => (
                      <DayTaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
            {canEdit && (
              <div className="flex justify-center mt-1" onClick={(e) => e.stopPropagation()}>
                <NewTaskButton day={cursor} iconOnly />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const grids = (
    <>
      {viewMode === "mes" && (
        <CalendarMonthGrid
          cursor={cursor}
          getDayTasks={getDayTasks}
          ItemComponent={TaskPill}
          getTaskKey={(t) => t.id}
          onDayClick={onCreate}
          onAddDay={canEdit ? onCreate : undefined}
          getTaskColor={getTaskColor}
          dragEnabled={dragEnabled}
          canDragTask={canDragTask}
          renderOverflow={(day, dayTasks, overflow) => (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-muted-foreground hover:text-foreground text-left px-1.5"
                >
                  +{overflow} mais
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium mb-2">{format(day, "d 'de' MMM", { locale: ptBR })}</p>
                <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                  {dayTasks.map((t) => (
                    <TaskPill key={t.id} task={t} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        />
      )}
      {viewMode === "semana" && (
        <CalendarWeekGrid
          cursor={cursor}
          getDayTasks={getDayTasks}
          ItemComponent={TaskPill}
          getTaskKey={(t) => t.id}
          onDayClick={onCreate}
          onAddDay={canEdit ? onCreate : undefined}
          getTaskColor={getTaskColor}
          dragEnabled={dragEnabled}
          canDragTask={canDragTask}
          renderDayFooterAction={canEdit ? (d) => <NewTaskButton day={d} iconOnly /> : undefined}
        />
      )}
      {viewMode === "dia" && <DayView />}
    </>
  );

  return (
    <div className="space-y-4">
      {filters}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => changeViewMode(v as CalendarViewMode)}
          className="border rounded-md p-0.5 bg-muted/40"
        >
          <ToggleGroupItem value="mes" className="h-8 px-3 text-xs data-[state=on]:bg-background">Mês</ToggleGroupItem>
          <ToggleGroupItem value="semana" className="h-8 px-3 text-xs data-[state=on]:bg-background">Semana</ToggleGroupItem>
          <ToggleGroupItem value="dia" className="h-8 px-3 text-xs data-[state=on]:bg-background">Dia</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={navPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium flex-1 min-w-0 truncate text-center lowercase">{periodLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={goToday}>
            Hoje
          </Button>
          {headerActions}
        </div>

        <CalendarColorToggle colorMode={colorMode} onChange={onColorModeChange} className="shrink-0" />
      </div>

      {dragEnabled ? <DragDropContext onDragEnd={handleDragEnd}>{grids}</DragDropContext> : grids}
    </div>
  );
}

export default TaskCalendarView;
