import { loadData, saveData } from "../../../../shared/storage.js";
import { normalizeBrainDump } from "./brainDump.js";
import { legacyBrainItemToNote, normalizeNotes } from "../../notes/notes.js";
import { normalizeBreakdowns } from "../../breakdowns/breakdowns.js";
import {
  TOOLS_STORAGE_KEY,
  TOOLS_VERSION,
} from "./constants.js";
import {
  defaultResetPreferences,
  normalizeResetPreferences,
} from "../../../settings/reset/reset.js";
import { normalizeToolTasks } from "./tasks.js";

export function createEmptyToolsDocument() {
  return {
    version: TOOLS_VERSION,
    tasks: [],
    brainDump: [],
    notes: [],
    breakdowns: [],
    migratedLaneIds: [],
    resetPreferences: defaultResetPreferences(),
  };
}

export function normalizeToolsDocument(value) {
  if (!value || ![1, TOOLS_VERSION].includes(value.version)) {
    return createEmptyToolsDocument();
  }
  const legacyNotes = normalizeBrainDump(value.brainDump)
    .map(legacyBrainItemToNote).filter(Boolean);
  return {
    version: TOOLS_VERSION,
    tasks: normalizeToolTasks(value.tasks),
    // V1 Brain Dump items become real notes with their original IDs and dates.
    // The old slice is cleared so a deleted note cannot reappear on reload.
    brainDump: [],
    notes: normalizeNotes([...(Array.isArray(value.notes) ? value.notes : []), ...legacyNotes]),
    breakdowns: normalizeBreakdowns(value.breakdowns),
    migratedLaneIds: Array.isArray(value.migratedLaneIds)
      ? [...new Set(value.migratedLaneIds.filter((id) => typeof id === "string"))]
      : [],
    resetPreferences: normalizeResetPreferences(value.resetPreferences),
  };
}

export function loadToolsDocument() {
  return normalizeToolsDocument(loadData(TOOLS_STORAGE_KEY, null));
}

export function saveToolsDocument(value) {
  const document = normalizeToolsDocument(value);
  return saveData(TOOLS_STORAGE_KEY, document) ? document : null;
}
