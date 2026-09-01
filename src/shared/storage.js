export function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadData(key, defaultValue) {
  const data = localStorage.getItem(key);

  return data ? JSON.parse(data) : defaultValue;
}

const migrations = {
  lockin_day: "echelon_today",
  lockin_focus: "echelon_focus",
  lockin_habits: "echelon_habits",
  lockin_schedule: "echelon_schedule",
  lockin_history: "echelon_history",
  lockin_reviews: "echelon_reviews",
  lockin_workouts: "echelon_workouts",
};

export function migrateStorage() {
  Object.entries(migrations).forEach(([oldKey, newKey]) => {
    const oldData = localStorage.getItem(oldKey);

    const newData = localStorage.getItem(newKey);

    if (oldData && !newData) {
      localStorage.setItem(newKey, oldData);
    }
  });
}