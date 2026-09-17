import {
  HABIT_DEFINITIONS,
  LEGACY_HABIT_IDS_BY_NAME,
} from "./constants.js";

const definitionsById = new Map(
  HABIT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function createHabits() {
  return HABIT_DEFINITIONS.map((definition) => ({
    ...definition,
    done: false,
  }));
}

const resolveDefinition = (value) => {
  if (!value || typeof value !== "object") return null;

  if (Object.hasOwn(value, "id")) {
    return typeof value.id === "string"
      ? definitionsById.get(value.id) ?? null
      : null;
  }

  if (typeof value.name !== "string") return null;
  const legacyId = LEGACY_HABIT_IDS_BY_NAME[value.name];
  return legacyId ? definitionsById.get(legacyId) ?? null : null;
};

// Normalize both current ID records and legacy name-only records into one
// canonical built-in set. The first valid occurrence wins; malformed entries
// do not reserve an ID and therefore cannot block a later valid record.
export function normalizeHabitRecords(value) {
  if (!Array.isArray(value)) return null;

  const completionById = new Map();

  for (const habit of value) {
    const definition = resolveDefinition(habit);
    if (!definition || completionById.has(definition.id)) continue;

    if (habit.done !== undefined && typeof habit.done !== "boolean") continue;
    completionById.set(definition.id, habit.done === true);
  }

  if (completionById.size === 0) return null;

  return HABIT_DEFINITIONS.map((definition) => ({
    ...definition,
    done: completionById.get(definition.id) ?? false,
  }));
}

export function normalizeHabitDocument(value, expectedDate) {
  if (
    typeof expectedDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate) ||
    !value ||
    value.date !== expectedDate
  ) return null;

  const data = normalizeHabitRecords(value.data);
  if (!data) return null;

  return {
    date: expectedDate,
    data,
    revision:
      Number.isInteger(value.revision) && value.revision >= 0
        ? value.revision
        : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

export function toggleHabitById(habits, id) {
  if (
    !Array.isArray(habits) ||
    typeof id !== "string" ||
    !definitionsById.has(id)
  ) return habits;

  const index = habits.findIndex((habit) => habit?.id === id);
  if (index < 0) return habits;

  const updated = [...habits];
  updated[index] = { ...updated[index], done: !updated[index].done };
  return updated;
}
