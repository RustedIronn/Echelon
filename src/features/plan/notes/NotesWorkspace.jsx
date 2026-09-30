import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button, EmptyState, SplitPane } from "@ui";
import { formatDayKey, getToday } from "@/shared/date";
import { usePlanner } from "@features/plan/planner/js/plannerStore";
import { useTools } from "../legacyTools/js/store.js";
import { createToolsId } from "../legacyTools/js/utils.js";
import BreakdownPanel from "../breakdowns/BreakdownPanel.jsx";

function NoteEditor({ note, onClose }) {
  const { updateNote, archiveNote, deleteNote } = useTools();
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const addTask = usePlanner((state) => state.addTask);
  const navigate = useNavigate();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");

  const convert = (schedule) => {
    const id = `planner:note:${note.id}`;
    const exists = plannerTasks.some((task) => task.id === id);
    if (!exists && !addTask({ title: note.title, notes: note.body.slice(0, 500) }, { id })) {
      setMessage("Could not create the Planner task. The note is unchanged.");
      return;
    }
    navigate(`/plan/planner?task=${encodeURIComponent(id)}${schedule ? "&schedule=1" : ""}${note.body.length > 500 ? "&noteKept=1" : ""}`);
  };

  return <div className="notes-editor">
    <div className="notes-editor__heading"><span>{note.archivedAt ? "Archived note" : "Note"} · {formatDayKey(getToday(new Date(note.updatedAt)))}</span><Button variant="tertiary" onClick={onClose}>Close</Button></div>
    <form onSubmit={(event) => { event.preventDefault(); if (updateNote(note.id, { title, body })) setMessage("Note saved."); else setMessage("No changes saved."); }}>
      <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label><span>Body</span><textarea rows="10" value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <Button type="submit">Save note</Button>
    </form>
    <div className="notes-editor__actions">
      <Button variant="secondary" onClick={() => convert(false)}>Turn into Planner task</Button>
      <Button variant="secondary" onClick={() => convert(true)}>Schedule as task</Button>
      <Button variant="tertiary" onClick={() => archiveNote(note.id, !note.archivedAt)}>{note.archivedAt ? "Restore" : "Archive"}</Button>
      {confirmDelete ? <><Button variant="danger" onClick={() => { if (deleteNote(note.id)) onClose(); }}>Delete note</Button><Button variant="tertiary" onClick={() => setConfirmDelete(false)}>Cancel</Button></> : <Button variant="tertiary" onClick={() => setConfirmDelete(true)}>Delete</Button>}
    </div>
    {note.body.length > 500 ? <p className="notes-editor__hint">Planner keeps the first 500 characters as task context; this full note remains here.</p> : null}
    <BreakdownPanel parent={{ type: "note", id: note.id }} title={note.title} />
    {message ? <p role="status">{message}</p> : null}
  </div>;
}

function EarlierBreakdown({ breakdown, notes, plannerTasks }) {
  const attachBreakdown = useTools((state) => state.attachBreakdown);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const targets = [
    ...notes.map((note) => ({ value: `note|${note.id}`, label: `Note: ${note.title}` })),
    ...plannerTasks.map((task) => ({ value: `planner|${task.id}`, label: `Task: ${task.title}` })),
  ];
  return <div className="notes-earlier-breakdown">
    <BreakdownPanel existing={breakdown} />
    <form onSubmit={(event) => {
      event.preventDefault();
      const [type, id] = target.split("|");
      if (!attachBreakdown(breakdown.id, { type, id })) setMessage("Could not attach these steps. Choose another task or note.");
    }}>
      <label><span>Attach these steps to</span><select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Choose a task or note</option>{targets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <Button type="submit" disabled={!target}>Attach</Button>
    </form>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}

export default function NotesWorkspace() {
  const { data, addNote } = useTools();
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("note");
  const selected = data.notes.find((note) => note.id === selectedId) ?? null;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState(() => createToolsId("note"));
  const [message, setMessage] = useState("");
  const captureInput = useRef(null);
  useEffect(() => {
    if (params.get("capture") === "1") captureInput.current?.focus();
  }, [params]);
  const query = search.trim().toLowerCase();
  const visible = data.notes
    .filter((note) => (filter === "all" || Boolean(note.archivedAt) === (filter === "archived")))
    .filter((note) => !query || `${note.title}\n${note.body}`.toLowerCase().includes(query))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  const orphanedBreakdowns = data.breakdowns.filter((breakdown) => !breakdown.parent || (breakdown.parent.type === "note" && !data.notes.some((note) => note.id === breakdown.parent.id)) || (breakdown.parent.type === "planner" && !plannerTasks.some((task) => task.id === breakdown.parent.id)));
  const select = (id) => setParams(id ? { note: id } : {});

  return <div className="notes-workspace">
    <SplitPane className={`notes-workspace__columns ${selected ? "has-selection" : ""}`}>
      <aside className="notes-list" aria-label="Browse notes">
        <div className="notes-list__heading"><div><h2>Notes</h2><p>Active and archived notes</p></div><strong>{visible.length}</strong></div>
        <form className="notes-capture" onSubmit={(event) => {
          event.preventDefault();
          if (!addNote({ title, body }, { id: draftId })) { setMessage("Add a title or body before saving."); return; }
          const id = draftId;
          setTitle(""); setBody(""); setDraftId(createToolsId("note")); setMessage(""); select(id);
        }}>
          <label><span>Quick capture</span><input ref={captureInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title or first thought" /></label>
          <label className="notes-capture__body"><span>Note body</span><textarea rows="2" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write as much as you need…" /></label>
          <Button type="submit">Save</Button>
        </form>
        {message ? <p role="status">{message}</p> : null}
        <div className="notes-list__filters">
          <label><span className="sr-only">Search notes</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" /></label>
          <label><span className="sr-only">Show</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
        </div>
        {visible.length ? <div className="notes-list__items">{visible.map((note) => <button type="button" key={note.id} className={selectedId === note.id ? "is-selected" : ""} onClick={() => select(note.id)}><strong>{note.title}</strong><small>{note.body.slice(0, 120) || "No body"}</small></button>)}</div> : <EmptyState compact title="No notes here" description="Capture a thought or change the filter." />}
      </aside>
      <section className="notes-detail" aria-label="Selected note">
        {selected ? <div key={selected.id} className="notes-detail__content"><NoteEditor note={selected} onClose={() => select(null)} /></div> : <div className="notes-detail__welcome"><h2>Select a note</h2><p>Edit it, create a Planner task, or add a breakdown.</p></div>}
      </section>
    </SplitPane>
    {orphanedBreakdowns.length ? <details className="notes-legacy-breakdowns" open={params.get("legacyBreakdowns") === "1"}>
      <summary>Earlier unlinked breakdowns ({orphanedBreakdowns.length})</summary>
      {orphanedBreakdowns.map((breakdown) => <EarlierBreakdown key={breakdown.id} breakdown={breakdown} notes={data.notes} plannerTasks={plannerTasks} />)}
    </details> : null}
  </div>;
}
