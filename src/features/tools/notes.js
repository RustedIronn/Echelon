import { isValidToolsId, normalizeToolsTimestamp } from "./utils.js";

const text = (value) => typeof value === "string" ? value.trim() : "";

export function normalizeNote(value) {
  const title = text(value?.title);
  const body = text(value?.body);
  const createdAt = normalizeToolsTimestamp(value?.createdAt);
  const updatedAt = normalizeToolsTimestamp(value?.updatedAt);
  if (!isValidToolsId(value?.id) || (!title && !body) || !createdAt || !updatedAt) return null;
  return {
    id: value.id,
    title: title || body.split(/\r?\n/)[0].slice(0, 140),
    body,
    createdAt,
    updatedAt,
    archivedAt: value.archivedAt == null ? null : normalizeToolsTimestamp(value.archivedAt),
  };
}

export function normalizeNotes(values) {
  if (!Array.isArray(values)) return [];
  const ids = new Set();
  return values.reduce((notes, value) => {
    const note = normalizeNote(value);
    if (note && !ids.has(note.id)) { ids.add(note.id); notes.push(note); }
    return notes;
  }, []);
}

export function legacyBrainItemToNote(item) {
  const body = text(item?.text);
  return normalizeNote({
    id: item?.id,
    title: body.split(/\r?\n/)[0].slice(0, 140),
    body,
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
    archivedAt: null,
  });
}

export function createNote(input, { id, now = new Date() } = {}) {
  const timestamp = new Date(now).toISOString();
  return normalizeNote({ ...input, id, createdAt: timestamp, updatedAt: timestamp, archivedAt: null });
}

export function updateNote(notes, id, patch, now = new Date()) {
  let changed = false;
  const next = notes.map((note) => {
    if (note.id !== id) return note;
    const candidate = normalizeNote({ ...note, title: patch.title, body: patch.body, updatedAt: new Date(now).toISOString() });
    if (!candidate || (candidate.title === note.title && candidate.body === note.body)) return note;
    changed = true;
    return candidate;
  });
  return changed ? next : notes;
}

export function setNoteArchived(notes, id, archived, now = new Date()) {
  let changed = false;
  const next = notes.map((note) => {
    if (note.id !== id || Boolean(note.archivedAt) === archived) return note;
    changed = true;
    const timestamp = new Date(now).toISOString();
    return { ...note, archivedAt: archived ? timestamp : null, updatedAt: timestamp };
  });
  return changed ? next : notes;
}
