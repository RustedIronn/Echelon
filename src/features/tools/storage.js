import { loadData, saveData } from "../../shared/storage.js";
import { normalizeBrainDump } from "./brainDump.js";
import { normalizeBreakdowns } from "./breakdowns.js";
import {
  TOOLS_STORAGE_KEY,
  TOOLS_VERSION,
} from "./constants.js";
import {
  defaultResetPreferences,
  normalizeResetPreferences,
} from "./reset.js";
import { normalizeToolTasks } from "./tasks.js";

export function createEmptyToolsDocument() {
  return {
    version: TOOLS_VERSION,
    tasks: [],
    brainDump: [],
    breakdowns: [],
    resetPreferences: defaultResetPreferences(),
  };
}

export function normalizeToolsDocument(value) {
  if (!value || value.version !== TOOLS_VERSION) {
    return createEmptyToolsDocument();
  }
  return {
    version: TOOLS_VERSION,
    tasks: normalizeToolTasks(value.tasks),
    brainDump: normalizeBrainDump(value.brainDump),
    breakdowns: normalizeBreakdowns(value.breakdowns),
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
