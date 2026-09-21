import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@ui";
import { usePlanner } from "@features/planner/store";
import { useFocusSurface } from "@features/focus/surface";
import { useTools } from "../store";
import { createToolsId } from "../utils";

export default function BreakdownPanel({ parent, title, existing = null }) {
  const { data, addBreakdown, addBreakdownStep, toggleBreakdownStep, reorderBreakdownStep, removeBreakdownStep, deleteBreakdown } = useTools();
  const addPlannerTask = usePlanner((state) => state.addTask);
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const openFocus = useFocusSurface((state) => state.openFor);
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [stepId, setStepId] = useState(() => createToolsId("step"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const id = existing?.id ?? (parent?.type === "planner" ? `breakdown:${parent.id}` : `breakdown:note:${parent?.id}`);
  const breakdown = existing ?? data.breakdowns.find((item) => item.id === id || (item.parent?.type === parent?.type && item.parent?.id === parent?.id));

  const promoteStep = (step) => {
    const taskId = `planner:step:${step.id}`;
    if (!plannerTasks.some((item) => item.id === taskId) && !addPlannerTask({ title: step.text, notes: `From ${breakdown.title}`, priority: "normal" }, { id: taskId })) {
      setMessage("Could not create the Planner task. The step is still here.");
      return;
    }
    navigate(`/plan/planner?task=${encodeURIComponent(taskId)}`);
  };

  if (!breakdown) return <Button variant="secondary" onClick={() => {
    if (!addBreakdown(title, { id, parent: { type: parent.type, id: parent.id } })) setMessage("Could not save this breakdown.");
  }}>Break this down</Button>;

  return <section className="attached-breakdown" aria-label={`Steps for ${breakdown.title}`}>
    <div className="attached-breakdown__heading"><h3>{breakdown.title}</h3>{!existing ? <span>Attached to this {parent.type === "planner" ? "task" : "note"}</span> : <span>Earlier unlinked breakdown</span>}</div>
    {breakdown.steps.length ? <ol>{breakdown.steps.map((step, index) => <li key={step.id}>
      <label><input type="checkbox" checked={step.completed} onChange={() => toggleBreakdownStep(breakdown.id, step.id)} /><span>{step.text}</span></label>
      <div className="attached-breakdown__actions">
        <Button variant="tertiary" aria-label={`Move ${step.text} up`} disabled={index === 0} onClick={() => reorderBreakdownStep(breakdown.id, step.id, -1)}>↑</Button>
        <Button variant="tertiary" aria-label={`Move ${step.text} down`} disabled={index === breakdown.steps.length - 1} onClick={() => reorderBreakdownStep(breakdown.id, step.id, 1)}>↓</Button>
        <Button variant="tertiary" onClick={() => openFocus({ id: `focus:step:${step.id}`, title: step.text, description: `Step from ${breakdown.title}`, category: "build", start: "Flexible", end: "", source: "breakdown" })}>Focus</Button>
        <Button variant="tertiary" onClick={() => promoteStep(step)}>To Planner</Button>
        <Button variant="tertiary" onClick={() => removeBreakdownStep(breakdown.id, step.id)}>Remove</Button>
      </div>
    </li>)}</ol> : <p>No steps yet. Add the next concrete action.</p>}
    <form onSubmit={(event) => { event.preventDefault(); if (addBreakdownStep(breakdown.id, draft, { id: stepId })) { setDraft(""); setStepId(createToolsId("step")); setMessage(""); } else setMessage("Enter a step before adding it."); }}>
      <label><span>Next step</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="A small, actionable move" /></label>
      <Button type="submit">Add step</Button>
    </form>
    {confirmDelete ? <div className="attached-breakdown__actions"><Button variant="danger" onClick={() => deleteBreakdown(breakdown.id)}>Delete steps</Button><Button variant="tertiary" onClick={() => setConfirmDelete(false)}>Cancel</Button></div> : <Button variant="tertiary" onClick={() => setConfirmDelete(true)}>Delete breakdown</Button>}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
