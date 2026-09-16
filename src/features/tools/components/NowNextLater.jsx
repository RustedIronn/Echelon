import { useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, EmptyState } from "@ui";
import { useTools } from "../store.js";
import { createToolsId } from "../utils.js";
import { getLaneTasks, getNowTask } from "../tasks.js";
import OccupiedNowPrompt from "./OccupiedNowPrompt.jsx";

function TaskRow({ task, lane, index, count, onMoveNow }) {
  const { editTask, moveTask, completeTask, deleteTask, reorderTask } = useTools();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="tools-task-row">
      {editing ? (
        <form
          className="tools-inline-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (editTask(task.id, text)) setEditing(false);
          }}
        >
          <label>
            <span className="sr-only">Task text</span>
            <input value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          <Button type="submit">Save</Button>
          <Button className="tools-secondary" onClick={() => { setText(task.text); setEditing(false); }}>Cancel</Button>
        </form>
      ) : (
        <strong>{task.text}</strong>
      )}

      <div className="tools-actions">
        {!editing ? <Button className="tools-secondary" onClick={() => setEditing(true)}>Edit</Button> : null}
        {lane !== "now" ? <Button className="tools-secondary" onClick={() => onMoveNow(task.id)}>Now</Button> : null}
        {lane !== "next" ? <Button className="tools-secondary" onClick={() => moveTask(task.id, "next")}>Next</Button> : null}
        {lane !== "later" ? <Button className="tools-secondary" onClick={() => moveTask(task.id, "later")}>Later</Button> : null}
        {lane !== "now" ? (
          <>
            <Button className="tools-icon-button" aria-label={`Move ${task.text} up`} disabled={index === 0} onClick={() => reorderTask(lane, task.id, -1)}>↑</Button>
            <Button className="tools-icon-button" aria-label={`Move ${task.text} down`} disabled={index === count - 1} onClick={() => reorderTask(lane, task.id, 1)}>↓</Button>
          </>
        ) : null}
        <Button className="tools-secondary" onClick={() => completeTask(task.id)}>Complete</Button>
        {confirmDelete ? (
          <>
            <Button className="tools-danger" onClick={() => deleteTask(task.id)}>Confirm delete</Button>
            <Button className="tools-secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </>
        ) : (
          <Button className="tools-secondary" onClick={() => setConfirmDelete(true)}>Delete</Button>
        )}
      </div>
    </div>
  );
}

export default function NowNextLater() {
  const { data, addTask, moveTask, completeTask } = useTools();
  const [text, setText] = useState("");
  const [lane, setLane] = useState("next");
  const [draftId, setDraftId] = useState(() => createToolsId("task"));
  const [pendingNowId, setPendingNowId] = useState(null);
  const [error, setError] = useState("");
  const now = getNowTask(data.tasks);
  const next = getLaneTasks(data.tasks, "next");
  const later = getLaneTasks(data.tasks, "later");

  const moveToNow = (id, options) => {
    const result = moveTask(id, "now", options);
    if (result === "occupied-now") setPendingNowId(id);
    else if (result) setPendingNowId(null);
  };

  const laneSection = (title, description, items, itemLane) => (
    <Card className={`tools-lane tools-lane-${itemLane}`}>
      <div className="section-header"><h2>{title}</h2><p>{description}</p></div>
      {items.length ? (
        <div className="tools-task-list">
          {items.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              lane={itemLane}
              index={index}
              count={items.length}
              onMoveNow={moveToNow}
            />
          ))}
        </div>
      ) : <EmptyState title={`Nothing in ${title}`} description="That space can stay empty." />}
    </Card>
  );

  return (
    <div className="stack">
      <Card>
        <form
          className="tools-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (lane === "now" && now) {
              setError("Now already has one thing. Add this to Next or Later first.");
              return;
            }
            if (addTask({ text, lane }, { id: draftId })) {
              setText("");
              setDraftId(createToolsId("task"));
              setError("");
            } else setError("Enter a task before adding it.");
          }}
        >
          <label className="tools-grow"><span>Add something</span><input value={text} onChange={(event) => setText(event.target.value)} placeholder="One clear, workable thing" /></label>
          <label><span>Lane</span><select value={lane} onChange={(event) => setLane(event.target.value)}><option value="now">Now</option><option value="next">Next</option><option value="later">Later</option></select></label>
          <Button type="submit">Add</Button>
          {error ? <p className="tools-form-error" role="alert">{error}</p> : null}
        </form>
      </Card>

      {pendingNowId ? (
        <OccupiedNowPrompt
          onConfirm={() => moveToNow(pendingNowId, { occupiedNow: "move-to-next" })}
          onCancel={() => setPendingNowId(null)}
        />
      ) : null}

      {laneSection("Now", "One primary thing. Nothing gets replaced silently.", now ? [now] : [], "now")}
      {now ? (
        <Link className="tools-text-link tools-timer-link" to="/tools/timer">
          Make time visible for this Now item
        </Link>
      ) : null}
      {now && next.length ? (
        <Button className="tools-promote-button" onClick={() => completeTask(now.id, { promoteNext: true })}>
          Complete Now and promote the first Next item
        </Button>
      ) : null}
      {laneSection("Next", "A short ordered queue.", next, "next")}
      {laneSection("Later", "Worth keeping, not currently urgent.", later, "later")}
    </div>
  );
}
