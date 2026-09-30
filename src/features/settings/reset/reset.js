import { DEFAULT_RESET_STEPS } from "../../plan/legacyTools/js/constants.js";
import { isValidToolsId, normalizeText } from "../../plan/legacyTools/js/utils.js";

export function defaultResetPreferences() {
  return { steps: DEFAULT_RESET_STEPS.map((step) => ({ ...step })) };
}

export function normalizeResetPreferences(value) {
  if (!value || !Array.isArray(value.steps)) return defaultResetPreferences();
  const ids = new Set();
  const steps = value.steps.reduce((items, entry) => {
    const text = normalizeText(entry?.text);
    if (!isValidToolsId(entry?.id) || !text || ids.has(entry.id)) return items;
    ids.add(entry.id);
    items.push({ id: entry.id, text });
    return items;
  }, []);
  return steps.length ? { steps } : defaultResetPreferences();
}

export function editResetStep(preferences, id, text) {
  const nextText = normalizeText(text);
  if (!nextText || !preferences.steps.some((step) => step.id === id)) {
    return preferences;
  }
  if (preferences.steps.find((step) => step.id === id).text === nextText) {
    return preferences;
  }
  return {
    steps: preferences.steps.map((step) =>
      step.id === id ? { ...step, text: nextText } : step,
    ),
  };
}
