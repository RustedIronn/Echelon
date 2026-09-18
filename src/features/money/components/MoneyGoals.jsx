import { useState } from "react";

import { Button, Card, EmptyState, ErrorState } from "@ui";
import { formatDayKey } from "@/shared/date.js";
import { getGoalProgress } from "../goals.js";
import { useMoney } from "../store.js";
import { createMoneyId, formatInr, minorToInput } from "../transactions.js";

const emptyDraft = () => ({
  name: "",
  targetAmount: "",
  savedAmount: "0",
  targetDate: "",
});

export default function MoneyGoals() {
  const { data, addGoal, editGoal, deleteGoal } = useMoney();
  const [draft, setDraft] = useState(emptyDraft);
  const [draftId, setDraftId] = useState(() => createMoneyId("goal"));
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [formError, setFormError] = useState("");

  const reset = () => {
    setDraft(emptyDraft());
    setDraftId(createMoneyId("goal"));
    setEditingId(null);
    setFormError("");
  };

  const submit = (event) => {
    event.preventDefault();
    const success = editingId
      ? editGoal(editingId, draft)
      : addGoal(draft, { id: draftId });
    if (success) reset();
    else setFormError("Use a positive target, a non-negative saved amount, and a valid date.");
  };

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>{editingId ? "Edit savings goal" : "Add savings goal"}</h2><p>Saved amounts are maintained manually and do not affect ledger balance.</p></div>
        <form className="money-form" onSubmit={submit}>
          <label><span>Name</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label><span>Target amount (₹)</span><input required inputMode="decimal" value={draft.targetAmount} onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })} /></label>
          <label><span>Saved amount (₹)</span><input required inputMode="decimal" value={draft.savedAmount} onChange={(event) => setDraft({ ...draft, savedAmount: event.target.value })} /></label>
          <label><span>Target date (optional)</span><input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} /></label>
          <div className="money-form-actions"><Button type="submit">{editingId ? "Save Goal" : "Add Goal"}</Button>{editingId ? <Button variant="secondary" onClick={reset}>Cancel</Button> : null}</div>
          {formError ? <ErrorState compact description={formError} /> : null}
        </form>
      </Card>

      {data.goals.length ? (
        <div className="money-goal-grid">
          {data.goals.map((goal) => {
            const progress = getGoalProgress(goal);
            return (
              <Card className="money-goal-card" key={goal.id}>
                <div className="money-section-heading"><div><h3>{goal.name}</h3><p>{goal.targetDate ? `Target ${formatDayKey(goal.targetDate)}` : "No target date"}</p></div><strong>{progress.percent}%</strong></div>
                <p className="money-goal-amount">{formatInr(goal.savedAmountMinor)} <span>/ {formatInr(goal.targetAmountMinor)}</span></p>
                <div className="money-progress" aria-label={`${progress.percent}% saved`}><i style={{ width: `${progress.visualPercent}%` }} /></div>
                <div className="money-row-actions">
                  <Button variant="secondary" onClick={() => { setEditingId(goal.id); setDraft({ name: goal.name, targetAmount: minorToInput(goal.targetAmountMinor), savedAmount: minorToInput(goal.savedAmountMinor), targetDate: goal.targetDate ?? "" }); }}>Edit</Button>
                  {pendingDeleteId === goal.id ? <><Button variant="danger" onClick={() => { const deleted = deleteGoal(goal.id); setPendingDeleteId(null); if (deleted && editingId === goal.id) reset(); }}>Confirm delete</Button><Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</Button></> : <Button variant="secondary" onClick={() => setPendingDeleteId(goal.id)}>Delete</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Card><EmptyState title="No savings goals" description="Create a goal and update its saved amount manually." /></Card>}
    </div>
  );
}
