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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, CornerDownRight, Check, CalendarClock, GripVertical } from "lucide-react";
import { CalendarTaskPill, type CalendarTaskLike } from "@/components/CalendarTaskPill";
import { CalendarColorToggle } from "@/components/CalendarColorToggle";
import { CalendarMonthGrid, CalendarWeekGrid } from "@/components/CalendarMonthWeekDay";
import type { CalendarColorMode } from "@/hooks/useCalendarColorMode";
import { formatDueTime } from "@/lib/taskReminders";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// droppableId fixo do Droppable de reordenar dentro do dia na visão Dia — só
// existe um dia visível por vez, então não precisa ser dinâmico por data
// como nas grades Mês/Semana. handleDragEnd traduz esse id pro formato
// yyyy-MM-dd (o mesmo do dia do cursor) antes de repassar pro onMoveTask da
// tela-pai, assim o "mesmo dia = só reordena" já existente ali funciona sem
// precisar duplicar lógica.
const DAY_LIST_DROPPABLE_ID = "day-list";

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
  const isMobile = useIsMobile();

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

  // Guard contra o "clique fantasma": o @hello-pangea/dnd usa o drag nativo
  // do HTML5 (draggable + dragstart/dragend), e é comportamento conhecido do
  // navegador disparar um click sintético no elemento sob o cursor logo após
  // um drop nativo — se isso cair em cima do botão "+"/área de criar tarefa
  // da célula, abre "Nova Tarefa" sozinho. Fica true do início do arrasto até
  // 300ms depois do fim, tempo suficiente pra engolir esse clique fantasma.
  const justDraggedRef = useRef(false);

  const handleDragStart = () => {
    justDraggedRef.current = true;
  };

  const handleDragEnd = (result: DropResult) => {
    if (!onMoveTask) return;
    // Reordenar na visão Dia usa um droppableId fixo (DAY_LIST_DROPPABLE_ID),
    // já que só existe um dia visível por vez. Traduz pro id real (yyyy-MM-dd
    // do cursor) antes de repassar — assim origem e destino ficam iguais e o
    // onMoveTask da tela-pai já reconhece como "mesmo dia, só reordena" (a
    // mesma regra que Mês/Semana usam), sem precisar de um caminho separado.
    let toApply = result;
    if (result.source.droppableId === DAY_LIST_DROPPABLE_ID || result.destination?.droppableId === DAY_LIST_DROPPABLE_ID) {
      const cursorDay = format(cursor, "yyyy-MM-dd");
      toApply = {
        ...result,
        source: { ...result.source, droppableId: result.source.droppableId === DAY_LIST_DROPPABLE_ID ? cursorDay : result.source.droppableId },
        destination: result.destination
          ? { ...result.destination, droppableId: result.destination.droppableId === DAY_LIST_DROPPABLE_ID ? cursorDay : result.destination.droppableId }
          : result.destination,
      };
    }
    onMoveTask(toApply);
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 300);
  };

  const guardedCreate = (day: Date) => {
    if (justDraggedRef.current) return;
    onCreate(day);
  };

  // Ação rápida do popover de calendário no card do dia: monta um DropResult
  // sintético e passa pelo mesmo caminho do arrastar de verdade (handleDragEnd),
  // assim reaproveita a mesma lógica de reordenar/mover e o mesmo onMoveTask.
  const quickMoveTask = (task: T, newDate: Date) => {
    const destDay = format(newDate, "yyyy-MM-dd");
    if (destDay === task.due_date) return;
    const sourceList = tasksByDay.get(task.due_date) || [];
    const sourceIndex = Math.max(0, sourceList.findIndex((t) => t.id === task.id));
    const destIndex = (tasksByDay.get(destDay) || []).length;
    handleDragEnd({
      draggableId: task.id,
      type: "CALENDAR_TASK",
      source: { droppableId: task.due_date, index: sourceIndex },
      destination: { droppableId: destDay, index: destIndex },
      reason: "DROP",
      mode: "FLUID",
      combine: null,
    } as DropResult);
    setCursor(newDate);
  };

  const NewTaskButton = ({ day, iconOnly }: { day: Date; iconOnly?: boolean }) =>
    iconOnly ? (
      <button
        onClick={(e) => { e.stopPropagation(); guardedCreate(day); }}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
        title="Nova tarefa"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    ) : (
      <Button className="gap-2" size="sm" onClick={() => guardedCreate(day)}>
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
            {dragEnabled && (!canDragTask || canDragTask(task)) && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Mudar data"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
                  <Calendar
                    mode="single"
                    selected={new Date(`${task.due_date}T00:00:00`)}
                    onSelect={(d) => d && quickMoveTask(task, d)}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
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

        <Card className="flex flex-col lg:max-h-[calc(100vh-320px)] lg:min-h-[420px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <CardTitle className="text-lg capitalize">{periodLabel}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {dayTasks.length} {dayTasks.length === 1 ? "tarefa" : "tarefas"}
              </p>
            </div>
            {canEdit && <NewTaskButton day={cursor} />}
          </CardHeader>
          <CardContent className="group flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : dayTasks.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center text-center text-muted-foreground cursor-pointer"
                onClick={() => canEdit && guardedCreate(cursor)}
              >
                Nenhuma tarefa neste dia
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 pr-3">
                {dragEnabled ? (
                  <Droppable droppableId={DAY_LIST_DROPPABLE_ID} type="day-list">
                    {(dropProvided) => (
                      <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-2">
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
                                className={cn("group/drag flex items-stretch gap-0.5", snapshot.isDragging && "shadow-md opacity-90")}
                              >
                                {/* Handle separado do card: o card inteiro tem onClick (abre a
                                    tarefa) e um botão nativo dentro de uma área draggable="true"
                                    costuma vencer a disputa com o navegador e cancelar o arrasto
                                    — por isso o handle fica isolado aqui, fora da área clicável
                                    (mesmo padrão de CalendarMonthWeekDay.tsx). */}
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className={cn(
                                    "flex items-center justify-center w-4 shrink-0 cursor-grab text-muted-foreground transition-opacity",
                                    isMobile ? "opacity-100" : "opacity-0 group-hover/drag:opacity-100",
                                  )}
                                  title="Arrastar para reordenar"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <DayTaskCard task={task} />
                                </div>
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
              <div className="flex justify-center mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <NewTaskButton day={cursor} iconOnly />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Popover com a lista completa quando um dia tem mais tarefas do que cabe
  // visível (Mês e Semana) — compartilhado pelas duas grades.
  const renderDayOverflow = (day: Date, dayTasks: T[], overflow: number) => (
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
  );

  const grids = (
    <>
      {viewMode === "mes" && (
        <CalendarMonthGrid
          cursor={cursor}
          getDayTasks={getDayTasks}
          ItemComponent={TaskPill}
          getTaskKey={(t) => t.id}
          onDayClick={guardedCreate}
          onAddDay={canEdit ? guardedCreate : undefined}
          getTaskColor={getTaskColor}
          dragEnabled={dragEnabled}
          canDragTask={canDragTask}
          renderOverflow={renderDayOverflow}
        />
      )}
      {viewMode === "semana" && (
        <CalendarWeekGrid
          cursor={cursor}
          getDayTasks={getDayTasks}
          ItemComponent={TaskPill}
          getTaskKey={(t) => t.id}
          onDayClick={guardedCreate}
          onAddDay={canEdit ? guardedCreate : undefined}
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

      {dragEnabled ? <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>{grids}</DragDropContext> : grids}
    </div>
  );
}

export default TaskCalendarView;
