import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Clock3, ListTree, RotateCcw } from "lucide-react";

import { Button, Card, Mosaic } from "@ui";
import { firstIncompleteStep } from "../breakdowns.js";
import { useTools } from "../store.js";
import { getLaneTasks, getNowTask } from "../tasks.js";
import { createToolsId } from "../utils.js";

const ToolLink = ({ icon: Icon, title, detail, to }) => (
  <Link className="tools-launch-link" to={to}>
    <span className="tools-launch-icon" aria-hidden="true"><Icon size={18} /></span>
    <span><strong>{title}</strong><small>{detail}</small></span>
    <ArrowRight size={17} aria-hidden="true" />
  </Link>
);

export default function ToolsOverview() {
  const { data, timer, captureBrainDump, completeTask, startTimer } = useTools();
  const [thought, setThought] = useState("");
  const [batchId, setBatchId] = useState(() => createToolsId("brain"));
  const now = getNowTask(data.tasks);
  const next = getLaneTasks(data.tasks, "next").slice(0, 3);
  const activeBreakdowns = data.breakdowns.filter(firstIncompleteStep).length;

  const capture = (event) => {
    event.preventDefault();
    if (!captureBrainDump(thought, { batchId })) return;
    setThought("");
    setBatchId(createToolsId("brain"));
  };

  return (
    <div className="tools-command">
      <section className={`tools-now-console ${now ? "has-now" : "is-empty"}`}>
        <div>
          <span className="tools-console-label">Now</span>
          <h2>{now?.text ?? "Choose one workable thing"}</h2>
          <p>{now ? "This is the only task that needs the foreground." : "Your Now lane is clear. Pick something from Next when useful."}</p>
        </div>
        <div className="tools-console-actions">
          {now ? <Button onClick={() => completeTask(now.id)}>Complete Now</Button> : null}
          <Link className="tools-console-link" to="/tools/now">Open lanes <ArrowRight size={16} /></Link>
        </div>
      </section>

      <Mosaic layout="command" className="tools-workbench">
        <Card material="soft" className="tools-capture-panel">
          <div className="section-header">
            <h2>Drop a thought</h2>
            <p>Capture first. Sort later.</p>
          </div>
          <form onSubmit={capture}>
            <label className="tools-textarea-label">
              <span>Brain Dump</span>
              <textarea rows="4" value={thought} onChange={(event) => setThought(event.target.value)} placeholder="One thought per line…" />
            </label>
            <div className="tools-capture-actions">
              <Button type="submit">Capture</Button>
              <Link to="/tools/brain-dump">View {data.brainDump.length} waiting</Link>
            </div>
          </form>
        </Card>

        <Card material="clear" className="tools-next-panel">
          <div className="section-header"><h2>Next in orbit</h2><p>Your short queue.</p></div>
          {next.length ? (
            <ol>{next.map((task) => <li key={task.id}>{task.text}</li>)}</ol>
          ) : <p className="tools-muted">Nothing is waiting behind Now.</p>}
          <Link className="tools-text-link" to="/tools/now">Shape the queue</Link>
        </Card>
      </Mosaic>

      <section className="tools-quick-timer">
        <div>
          <Clock3 size={20} aria-hidden="true" />
          <span><strong>Make time visible</strong><small>{timer.status === "idle" ? "Start without opening another screen." : `Timer is ${timer.status}.`}</small></span>
        </div>
        <div>
          {timer.status === "idle" ? (
            <><Button variant="secondary" onClick={() => startTimer(10)}>10 min</Button><Button variant="secondary" onClick={() => startTimer(25)}>25 min</Button></>
          ) : null}
          <Link to="/tools/timer">Open timer</Link>
        </div>
      </section>

      <div className="tools-launch-rail">
        <ToolLink icon={Brain} title="Brain Dump" detail={`${data.brainDump.length} waiting`} to="/tools/brain-dump" />
        <ToolLink icon={ListTree} title="Breakdown" detail={`${activeBreakdowns} active`} to="/tools/breakdown" />
        <ToolLink icon={RotateCcw} title="Reset" detail="A quiet six-step reset" to="/tools/reset" />
      </div>
    </div>
  );
}
