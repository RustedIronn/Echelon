import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarClock, Check, Circle, Clock3, MoreVertical, Send } from "lucide-react";

import { Button, ContextMenu, EmptyState, PageTitle, PanelHeader } from "@ui";
import { formatDayKey, getToday, isValidDayKey } from "@/shared/date";
import { PLANNER_PRIORITIES } from "../js/plannerDefaults";
import { usePlanner } from "../js/plannerStore";
import {
  createPlannerId,
  getPlannerTasksBySchedule,
  shiftPlannerDate,
  toFocusMission,
} from "../js/plannerTasks";
import { useFocusSurface } from "@features/focus/js/surface";
import BreakdownPanel from "@features/plan/breakdowns/BreakdownPanel";

function PlannerTask({ task, onToggle, onReschedule, onDelete, onFocus, onPriority, scheduleOnOpen = false, highlighted = false }) {
  const today = getToday();
  const tomorrow = shiftPlannerDate(today, 1);
  const [rescheduling, setRescheduling] = useState(scheduleOnOpen);
  const [nextDate, setNextDate] = useState(task.date ?? today);
  const [nextTime, setNextTime] = useState(task.time ?? "");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const when = task.date
    ? `${formatDayKey(task.date)}${task.time ? ` · ${task.time}` : ""}`
    : "Unscheduled";

  const items = [
    { id: "focus", label: "Open in Focus", onSelect: () => onFocus(task) },
    { id: "priority-high", label: "Make high priority", disabled: task.priority === "high", onSelect: () => onPriority(task.id, "high") },
    { id: "priority-normal", label: "Set normal priority", disabled: task.priority === "normal", onSelect: () => onPriority(task.id, "normal") },
    { id: "breakdown", label: "Break down task", onSelect: () => setBreakdownOpen(true) },
    { id: "today", label: "Move to today", onSelect: () => onReschedule(task.id, today, task.time) },
    { id: "tomorrow", label: "Move to tomorrow", onSelect: () => onReschedule(task.id, tomorrow, task.time) },
    {
      id: "reschedule",
      label: "Choose date and time…",
      onSelect: () => {
        setNextDate(task.date ?? today);
        setNextTime(task.time ?? "");
        setRescheduling(true);
      },
    },
    { id: "clear-date", label: "Clear scheduled date", onSelect: () => onReschedule(task.id, null) },
    { id: "toggle", label: task.completedAt ? "Reopen" : "Complete", onSelect: () => onToggle(task.id) },
    { id: "delete", label: "Delete", tone: "danger", onSelect: () => onDelete(task.id) },
  ];

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={items}>
      {({ contextProps, triggerProps }) => (
        <div className="planner-task-shell" {...contextProps}>
          <article className={`planner-task planner-task--${task.priority} ${task.completedAt ? "is-complete" : ""} ${highlighted ? "is-highlighted" : ""}`.trim()}>
            <button className="planner-task-toggle" type="button" onClick={() => onToggle(task.id)} aria-label={task.completedAt ? `Reopen ${task.title}` : `Complete ${task.title}`}>
              {task.completedAt ? <Check size={17} /> : <Circle size={17} />}
            </button>
            <div className="planner-task-copy">
              <div className="planner-task-titleline">
                <strong>{task.title}</strong>
                <span>{task.priority}</span>
              </div>
              {task.notes ? <p>{task.notes}</p> : null}
              <small><CalendarClock size={13} aria-hidden="true" />{when}</small>
            </div>
            <button {...triggerProps}><MoreVertical size={18} aria-hidden="true" /></button>
          </article>
          {rescheduling ? (
            <form className="planner-reschedule disclosure-enter" onSubmit={(event) => {
              event.preventDefault();
              if (onReschedule(task.id, nextDate, nextTime)) setRescheduling(false);
            }}>
              <label><span>New date</span><input type="date" required value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
              <label><span>Time</span><input type="time" value={nextTime} onChange={(event) => setNextTime(event.target.value)} /></label>
              <Button type="submit">Reschedule</Button>
              <Button variant="ghost" onClick={() => setRescheduling(false)}>Cancel</Button>
            </form>
          ) : null}
          {breakdownOpen ? (
            <section className="planner-breakdown disclosure-enter" aria-label={`Steps for ${task.title}`}>
              <div className="planner-breakdown-heading"><strong>Small steps</strong><button type="button" onClick={() => setBreakdownOpen(false)}>Done</button></div>
              <BreakdownPanel parent={{ type: "planner", id: task.id }} title={task.title} />
            </section>
          ) : null}
        </div>
      )}
    </ContextMenu>
  );
}

function PlannerWorkspaceContent({ embedded = false, basePath = "/planner", location }) {
  const navigate = useNavigate();
  const openFocusSurface = useFocusSurface((state) => state.openFor);
  const captureParams = new URLSearchParams(location.search);
  const requestedDate = captureParams.get("date");
  const captureRequested = captureParams.get("capture") === "1" && isValidDayKey(requestedDate);
  const linkedTaskId = captureParams.get("task");
  const { document, addTask, toggleTask, rescheduleTask, deleteTask, setPriority } = usePlanner();
  const visibleTasks = getPlannerTasksBySchedule(document.tasks);
  const linkedTask = linkedTaskId
    ? document.tasks.find((task) => task.id === linkedTaskId) ?? null
    : null;
  const tasks = linkedTask && !visibleTasks.some((task) => task.id === linkedTask.id)
    ? [linkedTask, ...visibleTasks]
    : visibleTasks;
  const planningQueue = linkedTask
    ? tasks.filter((task) => task.id === linkedTask.id || !task.completedAt).slice(0, 6)
    : tasks.filter((task) => !task.completedAt).slice(0, 6);
  const [draftId, setDraftId] = useState(() => createPlannerId());
  const [draft, setDraft] = useState({ title: "", notes: "", date: captureRequested ? requestedDate : "", time: "", priority: "normal" });
  const [recentlyCreatedId, setRecentlyCreatedId] = useState(null);
  const createdTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(createdTimer.current), []);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    const submittedId = draftId;
    if (!addTask(draft, { id: submittedId })) return;
    setDraft({ title: "", notes: "", date: "", time: "", priority: "normal" });
    setDraftId(createPlannerId());
    window.clearTimeout(createdTimer.current);
    setRecentlyCreatedId(submittedId);
    createdTimer.current = window.setTimeout(() => setRecentlyCreatedId(null), 900);

    navigate(`${basePath}?task=${encodeURIComponent(submittedId)}`, { replace: true });
  };
  const openFocus = (task) => openFocusSurface(toFocusMission(task));
  return (
    <div className="page planner-page">
      {!embedded ? <PageTitle tone="planner" label="ONE-OFFS" title="Planner" description="Capture a task, then decide when it belongs." /> : null}

      <div className="planner-workspace">
        {captureParams.get("noteKept") === "1" ? <p role="status">Task created. The original long note remains in Notes / Capture so no text is lost.</p> : null}
        <section className="planner-capture" aria-labelledby="planner-capture-title">
          <div className="planner-capture-heading">
            <div><span>Quick capture</span><h2 id="planner-capture-title">Add a task</h2></div>
            <Send size={24} aria-hidden="true" />
          </div>
          <form onSubmit={submit}>
            <label className="planner-title-field"><span>Title</span><input autoFocus={captureRequested} value={draft.title} maxLength="140" required onChange={(event) => updateDraft("title", event.target.value)} placeholder="What needs doing?" /></label>
            <label><span>Notes</span><textarea rows="2" maxLength="500" value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Optional context" /></label>
            <div className="planner-capture-meta">
              <label><span>Date</span><input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
              <label><span>Time</span><input type="time" disabled={!draft.date} value={draft.time} onChange={(event) => updateDraft("time", event.target.value)} /></label>
              <label><span>Priority</span><select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)}>{PLANNER_PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></label>
              <Button type="submit">Add item</Button>
            </div>
          </form>
        </section>

        <section className="planner-list-section">
          <PanelHeader
            eyebrow="Scheduling bench"
            title={linkedTask && !visibleTasks.some((task) => task.id === linkedTask.id)
              ? "Selected item"
              : "Recently placed"}
            actions={<div className="planner-view-count"><Clock3 size={16} aria-hidden="true" /><strong>{planningQueue.length}</strong> recent</div>}
          />
          <div className="planner-task-list">
            {planningQueue.length ? planningQueue.map((task) => (
              <PlannerTask key={task.id} task={task} onToggle={toggleTask} onReschedule={rescheduleTask} onDelete={deleteTask} onFocus={openFocus} onPriority={setPriority} scheduleOnOpen={linkedTask?.id === task.id && captureParams.get("schedule") === "1"} highlighted={linkedTaskId === task.id || recentlyCreatedId === task.id} />
            )) : <EmptyState title="Nothing placed yet" description="Tasks stay small here; dated work appears in Calendar and Schedule." />}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PlannerWorkspace(props) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestedDate = params.get("date");
  const captureKey = params.get("capture") === "1" && isValidDayKey(requestedDate)
    ? `capture:${requestedDate}`
    : "default";
  return <PlannerWorkspaceContent key={captureKey} {...props} location={location} />;
}
