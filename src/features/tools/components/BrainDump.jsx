import { useState } from "react";

import { Button, Card, EmptyState } from "@ui";
import { useTools } from "../store.js";
import { createToolsId } from "../utils.js";
import OccupiedNowPrompt from "./OccupiedNowPrompt.jsx";

export default function BrainDump() {
  const { data, captureBrainDump, deleteBrainDump, promoteBrainDump } = useTools();
  const [text, setText] = useState("");
  const [batchId, setBatchId] = useState(() => createToolsId("brain"));
  const [pendingNowId, setPendingNowId] = useState(null);
  const [error, setError] = useState("");

  const promote = (id, lane, options) => {
    const result = promoteBrainDump(id, lane, options);
    if (result === "occupied-now") setPendingNowId(id);
    else if (result) setPendingNowId(null);
  };

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>Put it somewhere outside your head</h2><p>One thought per line. Sorting can happen later.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); if (captureBrainDump(text, { batchId })) { setText(""); setBatchId(createToolsId("brain")); setError(""); } else setError("Add at least one thought."); }}>
          <label className="tools-textarea-label"><span>Thoughts or tasks</span><textarea rows="6" value={text} onChange={(event) => setText(event.target.value)} placeholder={"reply to professor\nphysics revision\nbuy milk"} /></label>
          <Button type="submit">Capture</Button>
          {error ? <p className="tools-form-error" role="alert">{error}</p> : null}
        </form>
      </Card>

      {pendingNowId ? <OccupiedNowPrompt onConfirm={() => promote(pendingNowId, "now", { occupiedNow: "move-to-next" })} onCancel={() => setPendingNowId(null)} /> : null}

      <Card>
        <div className="section-header"><h2>Unsorted</h2><p>Promotion removes the Brain Dump copy after the task is safely created.</p></div>
        {data.brainDump.length ? (
          <div className="tools-task-list">
            {data.brainDump.map((item) => (
              <div className="tools-task-row" key={item.id}>
                <strong>{item.text}</strong>
                <div className="tools-actions">
                  <Button className="tools-secondary" onClick={() => promote(item.id, "now")}>Move to Now</Button>
                  <Button className="tools-secondary" onClick={() => promote(item.id, "next")}>Move to Next</Button>
                  <Button className="tools-secondary" onClick={() => promote(item.id, "later")}>Move to Later</Button>
                  <Button className="tools-secondary" onClick={() => deleteBrainDump(item.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Brain Dump is clear" description="There is nothing waiting to be sorted." />}
      </Card>
    </div>
  );
}
