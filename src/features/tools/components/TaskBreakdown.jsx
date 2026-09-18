import { useState } from "react";

import { Button, Card, EmptyState, ErrorState } from "@ui";
import { firstIncompleteStep } from "../breakdowns.js";
import { useTools } from "../store.js";
import { createToolsId } from "../utils.js";
import OccupiedNowPrompt from "./OccupiedNowPrompt.jsx";

function BreakdownCard({ breakdown, onSendNow }) {
  const {
    renameBreakdown,
    addBreakdownStep,
    removeBreakdownStep,
    toggleBreakdownStep,
    reorderBreakdownStep,
    deleteBreakdown,
    sendBreakdownStep,
  } = useTools();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(breakdown.title);
  const [stepText, setStepText] = useState("");
  const [stepId, setStepId] = useState(() => createToolsId("step"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const incomplete = firstIncompleteStep(breakdown);

  return (
    <Card className="tools-breakdown-card">
      <div className="tools-breakdown-heading">
        {renaming ? (
          <form onSubmit={(event) => { event.preventDefault(); if (renameBreakdown(breakdown.id, title)) setRenaming(false); }}>
            <label><span>Breakdown title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <div className="tools-actions"><Button type="submit">Save</Button><Button variant="secondary" onClick={() => { setTitle(breakdown.title); setRenaming(false); }}>Cancel</Button></div>
          </form>
        ) : <div><h2>{breakdown.title}</h2><p>{incomplete ? `Next small step: ${incomplete.text}` : "No incomplete steps."}</p></div>}
        {!renaming ? <Button variant="secondary" onClick={() => setRenaming(true)}>Rename</Button> : null}
      </div>

      {breakdown.steps.length ? (
        <ol className="tools-step-list">
          {breakdown.steps.map((step, index) => (
            <li key={step.id} className={step.completed ? "is-complete" : ""}>
              <label><input type="checkbox" checked={step.completed} onChange={() => toggleBreakdownStep(breakdown.id, step.id)} /><span>{step.text}</span></label>
              <div className="tools-actions">
                <Button className="tools-icon-button" variant="secondary" aria-label={`Move ${step.text} up`} disabled={index === 0} onClick={() => reorderBreakdownStep(breakdown.id, step.id, -1)}>↑</Button>
                <Button className="tools-icon-button" variant="secondary" aria-label={`Move ${step.text} down`} disabled={index === breakdown.steps.length - 1} onClick={() => reorderBreakdownStep(breakdown.id, step.id, 1)}>↓</Button>
                <Button variant="danger" onClick={() => removeBreakdownStep(breakdown.id, step.id)}>Remove</Button>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="tools-muted">Add the first small step below.</p>}

      <form className="tools-add-form" onSubmit={(event) => { event.preventDefault(); if (addBreakdownStep(breakdown.id, stepText, { id: stepId })) { setStepText(""); setStepId(createToolsId("step")); } }}>
        <label className="tools-grow"><span>Small step</span><input value={stepText} onChange={(event) => setStepText(event.target.value)} placeholder="Open the syllabus" /></label>
        <Button type="submit">Add step</Button>
      </form>

      <div className="tools-actions tools-breakdown-actions">
        <Button disabled={!incomplete} onClick={() => onSendNow(breakdown.id)}>Send first incomplete step to Now</Button>
        <Button variant="secondary" disabled={!incomplete} onClick={() => sendBreakdownStep(breakdown.id, "next")}>Send to Next</Button>
        {confirmDelete ? (
          <><Button variant="danger" onClick={() => deleteBreakdown(breakdown.id)}>Confirm delete</Button><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button></>
        ) : <Button variant="secondary" onClick={() => setConfirmDelete(true)}>Delete breakdown</Button>}
      </div>
    </Card>
  );
}

export default function TaskBreakdown() {
  const { data, addBreakdown, sendBreakdownStep } = useTools();
  const [title, setTitle] = useState("");
  const [draftId, setDraftId] = useState(() => createToolsId("breakdown"));
  const [pendingNowId, setPendingNowId] = useState(null);
  const [error, setError] = useState("");

  const sendNow = (id, options) => {
    const result = sendBreakdownStep(id, "now", options);
    if (result === "occupied-now") setPendingNowId(id);
    else if (result) setPendingNowId(null);
  };

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>Make one task smaller</h2><p>The breakdown stays here. Only a step you choose enters the main lanes.</p></div>
        <form className="tools-add-form" onSubmit={(event) => { event.preventDefault(); if (addBreakdown(title, { id: draftId })) { setTitle(""); setDraftId(createToolsId("breakdown")); setError(""); } else setError("Give the breakdown a title."); }}>
          <label className="tools-grow"><span>Task</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prepare Physics" /></label>
          <Button type="submit">Create breakdown</Button>
          {error ? <ErrorState compact description={error} /> : null}
        </form>
      </Card>

      {pendingNowId ? <OccupiedNowPrompt onConfirm={() => sendNow(pendingNowId, { occupiedNow: "move-to-next" })} onCancel={() => setPendingNowId(null)} /> : null}

      {data.breakdowns.length ? data.breakdowns.map((breakdown) => <BreakdownCard key={breakdown.id} breakdown={breakdown} onSendNow={sendNow} />) : <Card><EmptyState title="No breakdowns yet" description="Create one when a task feels too large to start." /></Card>}
    </div>
  );
}
