import { useState } from "react";

import { Button, Card } from "@ui";
import { DEFAULT_RESET_STEPS } from "../constants.js";
import { useTools } from "../store.js";

export default function ResetMode() {
  const { data, editResetStep, restoreResetSteps } = useTools();
  const [checked, setChecked] = useState(() => new Set());
  const [drafts, setDrafts] = useState(() => Object.fromEntries(data.resetPreferences.steps.map((step) => [step.id, step.text])));

  const toggle = (id) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>A small reset</h2><p>Check what helps. There is no score and no history.</p></div>
        <div className="tools-reset-list">
          {data.resetPreferences.steps.map((step) => (
            <div key={step.id}>
              <label className="tools-reset-check"><input type="checkbox" checked={checked.has(step.id)} onChange={() => toggle(step.id)} /><span>{step.text}</span></label>
              <label className="tools-reset-edit"><span className="sr-only">Edit {step.text}</span><input value={drafts[step.id] ?? step.text} onChange={(event) => setDrafts({ ...drafts, [step.id]: event.target.value })} onBlur={() => { if (!editResetStep(step.id, drafts[step.id])) setDrafts({ ...drafts, [step.id]: step.text }); }} /></label>
            </div>
          ))}
        </div>
        <div className="tools-actions">
          <Button variant="secondary" onClick={() => setChecked(new Set())}>Reset checklist</Button>
          <Button variant="secondary" onClick={() => { if (restoreResetSteps()) setDrafts(Object.fromEntries(DEFAULT_RESET_STEPS.map((step) => [step.id, step.text]))); }}>Restore default wording</Button>
        </div>
        <p className="tools-muted">Checkmarks last only for this open Reset screen. Edited wording is saved to your account’s local toolbox.</p>
      </Card>
    </div>
  );
}
