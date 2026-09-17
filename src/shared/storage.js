const USER_DATA_KEYS = new Set([
  "echelon_today",
  "echelon_focus",
  "echelon_habits",
  "echelon_schedule",
  "echelon_history",
  "echelon_reviews",
  "echelon_composure_v1",
  "echelon_workouts",
  "echelon_workout_progress",
  "echelon_notification_settings",
  "echelon_notification_history",
  "echelon_money_v1",
  "echelon_tools_v1",
]);

const LEGACY_OWNER_KEY = "echelon:legacy-owner";

const migrations = {
  lockin_day: "echelon_today",
  lockin_focus: "echelon_focus",
  lockin_habits: "echelon_habits",
  lockin_schedule: "echelon_schedule",
  lockin_history: "echelon_history",
  lockin_reviews: "echelon_reviews",
  lockin_workouts: "echelon_workouts",
};

let activeUserId = null;
const ownerListeners = new Set();

export function getUserStorageKey(uid, key) {
  return `echelon:user:${encodeURIComponent(uid)}:${key}`;
}

const resolveKey = (key) => {
  if (!USER_DATA_KEYS.has(key)) return key;
  return activeUserId ? getUserStorageKey(activeUserId, key) : null;
};

const isValidJson = (value) => {
  if (value === null) return false;

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const migrateLegacyNames = () => {
  Object.entries(migrations).forEach(([oldKey, newKey]) => {
    const oldData = localStorage.getItem(oldKey);
    const newData = localStorage.getItem(newKey);

    if (oldData !== null && newData === null) {
      localStorage.setItem(newKey, oldData);
    }
  });
};

const claimLegacyData = (uid) => {
  const legacyOwner = localStorage.getItem(LEGACY_OWNER_KEY);

  if (legacyOwner && legacyOwner !== uid) return;

  // The first authenticated UID owns the pre-existing unscoped cache. Keep
  // the originals in place as a recoverable backup, but never read them once
  // ownership has been established.
  if (!legacyOwner) localStorage.setItem(LEGACY_OWNER_KEY, uid);

  USER_DATA_KEYS.forEach((key) => {
    const legacyData = localStorage.getItem(key);
    const scopedKey = getUserStorageKey(uid, key);

    if (
      localStorage.getItem(scopedKey) === null &&
      isValidJson(legacyData)
    ) {
      localStorage.setItem(scopedKey, legacyData);
    }
  });
};

export function setStorageOwner(uid) {
  const nextUserId = typeof uid === "string" && uid.length > 0 ? uid : null;

  migrateLegacyNames();
  if (nextUserId) claimLegacyData(nextUserId);

  if (activeUserId === nextUserId) return;

  activeUserId = nextUserId;
  ownerListeners.forEach((listener) => listener(nextUserId));
}

export function getStorageOwner() {
  return activeUserId;
}

export function subscribeStorageOwner(listener) {
  ownerListeners.add(listener);
  return () => ownerListeners.delete(listener);
}

export function saveData(key, data) {
  const storageKey = resolveKey(key);
  if (!storageKey) return false;

  try {
    const serialized = JSON.stringify(data);
    if (typeof serialized !== "string") return false;
    localStorage.setItem(storageKey, serialized);
    return true;
  } catch (error) {
    console.warn(`Unable to persist local data for "${storageKey}".`, error);
    return false;
  }
}

export function loadData(key, defaultValue) {
  const storageKey = resolveKey(key);
  if (!storageKey) return defaultValue;

  const data = localStorage.getItem(storageKey);

  if (data === null) return defaultValue;

  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Ignoring malformed local data for "${storageKey}".`, error);
    return defaultValue;
  }
}

export function removeData(key) {
  const storageKey = resolveKey(key);
  if (!storageKey) return false;

  localStorage.removeItem(storageKey);
  return true;
}

export function migrateStorage() {
  migrateLegacyNames();
  if (activeUserId) claimLegacyData(activeUserId);
}
