export function getScheduleMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function getCurrentScheduleItem(tasks, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();

  return tasks.find((task) => {
    const start = getScheduleMinutes(task.start);
    const end = getScheduleMinutes(task.end);
    return current >= start && current < end;
  });
}

export function getScheduleItemDuration(task) {
  return getScheduleMinutes(task.end) - getScheduleMinutes(task.start);
}

export function getScheduleItemHeight(task) {
  const duration = getScheduleItemDuration(task);

  if (duration <= 15) return 1;
  if (duration <= 30) return 2;
  if (duration <= 60) return 3;
  if (duration <= 120) return 4;
  if (duration <= 180) return 5;
  return 6;
}
