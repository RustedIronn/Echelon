import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CalendarClock, Check, Circle, Clock3, MoreVertical, Send } from "lucide-react";

import { Button, Card, ContextMenu, EmptyState, NavDropdown, PageTitle, PanelHeader, Stage } from "@ui";
import { formatDayKey, getToday } from "@/shared/date";
import { PLANNER_PRIORITIES, PLANNER_VIEWS } from "../constants";
import { usePlanner } from "../store";
import {
  createPlannerId,
  getPlannerTasksForView,
  shiftPlannerDate,
  toFocusMission,
} from "../tasks";
import { useTools } from "@features/tools/store";
import { createToolsId } from "@features/tools/utils";
import NowNextLater from "@features/tools/components/NowNextLater";
import BrainDump from "@features/tools/components/BrainDump";
import TaskBreakdown from "@features/tools/components/TaskBreakdown";

const getView = (pathname) => {
  if (pathname.endsWith("/lanes")) return "lanes";
  if (pathname.endsWith("/brain-dump")) return "brain-dump";
  if (pathname.endsWith("/breakdowns")) return "breakdowns";
  if (pathname.endsWith("/today")) return "today";
  if (pathname.endsWith("/upcoming")) return "upcoming";
  return "inbox";
};

function PlannerTask({ task, onToggle, onReschedule, onDelete, onFocus }) {
  const today = getToday();
  const tomorrow = shiftPlannerDate(today, 1);
  const [rescheduling, setRescheduling] = useState(false);
  const [nextDate, setNextDate] = useState(task.date ?? today);
  const [nextTime, setNextTime] = useState(task.time ?? "");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [stepText, setStepText] = useState("");
  const [stepId, setStepId] = useState(() => createToolsId("step"));
  const { data: toolsData, addBreakdown, addBreakdownStep, toggleBreakdownStep, removeBreakdownStep } = useTools();
  const breakdownId = `breakdown:${task.id}`;
  const breakdown = toolsData.breakdowns.find((item) => item.id === breakdownId);
  const when = task.date
    ? `${formatDayKey(task.date)}${task.time ? ` · ${task.time}` : ""}`
    : "Unscheduled";

  const items = [
    { id: "focus", label: "Open in Focus", onSelect: () => onFocus(task) },
    { id: "breakdown", label: "Break down task", onSelect: () => { if (!breakdown) addBreakdown(task.title, { id: breakdownId }); setBreakdownOpen(true); } },
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
    { id: "inbox", label: "Move to Inbox", onSelect: () => onReschedule(task.id, null) },
    { id: "toggle", label: task.completedAt ? "Reopen" : "Complete", onSelect: () => onToggle(task.id) },
    { id: "delete", label: "Delete", tone: "danger", onSelect: () => onDelete(task.id) },
  ];

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={items}>
      {({ contextProps, triggerProps }) => (
        <div className="planner-task-shell" {...contextProps}>
          <article className={`planner-task planner-task--${task.priority} ${task.completedAt ? "is-complete" : ""}`}>
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
            <form className="planner-reschedule" onSubmit={(event) => {
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
            <section className="planner-breakdown" aria-label={`Steps for ${task.title}`}>
              <div className="planner-breakdown-heading"><strong>Small steps</strong><button type="button" onClick={() => setBreakdownOpen(false)}>Done</button></div>
              {breakdown?.steps?.length ? <div className="planner-breakdown-steps">{breakdown.steps.map((step) => (
                <div key={step.id}><label><input type="checkbox" checked={step.completed} onChange={() => toggleBreakdownStep(breakdownId, step.id)} /><span>{step.text}</span></label><button type="button" onClick={() => removeBreakdownStep(breakdownId, step.id)}>Remove</button></div>
              ))}</div> : <p>No steps yet. Add only the next useful move.</p>}
              <form onSubmit={(event) => { event.preventDefault(); if (addBreakdownStep(breakdownId, stepText, { id: stepId })) { setStepText(""); setStepId(createToolsId("step")); } }}>
                <label><span className="sr-only">New step</span><input value={stepText} onChange={(event) => setStepText(event.target.value)} placeholder="Add a small next step" /></label>
                <Button type="submit">Add step</Button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </ContextMenu>
  );
}

export default function PlannerWorkspace({ embedded = false, basePath = "/planner" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const view = getView(location.pathname);
  const { document, addTask, toggleTask, rescheduleTask, deleteTask } = usePlanner();
  const tasks = getPlannerTasksForView(document.tasks, view);
  const [draftId, setDraftId] = useState(() => createPlannerId());
  const [draft, setDraft] = useState({ title: "", notes: "", date: "", time: "", priority: "normal" });

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!addTask(draft, { id: draftId })) return;
    setDraft({ title: "", notes: "", date: "", time: "", priority: "normal" });
    setDraftId(createPlannerId());
  };
  const openFocus = (task) => navigate("/focus", { state: { mission: toFocusMission(task) } });
  const Workspace = embedded ? "div" : Stage;
  const toolView = view === "lanes"
    ? <NowNextLater />
    : view === "brain-dump"
      ? <BrainDump />
      : view === "breakdowns"
        ? <TaskBreakdown />
        : null;

  return (
    <div className="page planner-page">
      {!embedded ? <PageTitle tone="planner" label="ONE-OFFS" title="Planner" description="Capture what does not belong in your recurring routine." /> : null}

      <div className="planner-view-navigation">
        <nav className="subnav" aria-label="Planner views">
        {PLANNER_VIEWS.slice(0, 3).map((item) => {
          const suffix = item.id === "inbox" ? "" : `/${item.id}`;
          return <NavLink key={item.id} to={`${basePath}${suffix}`} end={item.id === "inbox"}>{item.label}</NavLink>;
        })}
        </nav>
        <NavDropdown
          label="Organize"
          items={PLANNER_VIEWS.slice(3).map((item) => ({ ...item, path: `${basePath}/${item.id}` }))}
        />
      </div>

      <Workspace {...(!embedded ? { tone: "soft" } : {})} className={`planner-workspace ${toolView ? "planner-workspace--tool" : ""}`.trim()}>
        {toolView ?? <>
        <Card material="feature" className="planner-capture">
          <div className="planner-capture-heading">
            <div><span>Quick capture</span><h2>Put one thing somewhere real.</h2></div>
            <Send size={24} aria-hidden="true" />
          </div>
          <form onSubmit={submit}>
            <label className="planner-title-field"><span>Title</span><input value={draft.title} maxLength="140" required onChange={(event) => updateDraft("title", event.target.value)} placeholder="What needs doing?" /></label>
            <label><span>Notes</span><textarea rows="2" maxLength="500" value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Optional context" /></label>
            <div className="planner-capture-meta">
              <label><span>Date</span><input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
              <label><span>Time</span><input type="time" disabled={!draft.date} value={draft.time} onChange={(event) => updateDraft("time", event.target.value)} /></label>
              <label><span>Priority</span><select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)}>{PLANNER_PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></label>
              <Button type="submit">Add item</Button>
            </div>
          </form>
        </Card>

        <section className="planner-list-section">
          <PanelHeader
            eyebrow={view === "inbox" ? "Unscheduled" : view === "today" ? "On the desk" : "On the horizon"}
            title={PLANNER_VIEWS.find((item) => item.id === view)?.label}
            actions={<div className="planner-view-count"><Clock3 size={16} aria-hidden="true" /><strong>{tasks.length}</strong> items</div>}
          />
          <div className="planner-task-list">
            {tasks.length ? tasks.map((task) => (
              <PlannerTask key={task.id} task={task} onToggle={toggleTask} onReschedule={rescheduleTask} onDelete={deleteTask} onFocus={openFocus} />
            )) : <EmptyState title={`Nothing in ${view}`} description={view === "inbox" ? "Unscheduled ideas will wait here." : "This view is clear."} />}
          </div>
        </section>
        </>}
      </Workspace>
    </div>
  );
}
