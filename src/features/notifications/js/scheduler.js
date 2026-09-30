export function createReminderScheduler({
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  now = () => new Date(),
} = {}) {
  const timers = new Map();

  const cancel = (id) => {
    const timer = timers.get(id);
    if (!timer) return false;

    clearTimer(timer.handle);
    timers.delete(id);
    return true;
  };

  return {
    reconcile(reminders, onDue) {
      const currentTime = now().getTime();
      const desired = new Map(
        reminders.map((reminder) => [reminder.id, reminder]),
      );

      for (const id of timers.keys()) {
        if (!desired.has(id)) cancel(id);
      }

      for (const reminder of desired.values()) {
        const existing = timers.get(reminder.id);
        const signature = JSON.stringify(reminder);

        if (
          existing &&
          existing.signature === signature &&
          Date.parse(reminder.scheduledFor) > currentTime
        ) {
          continue;
        }

        if (existing) cancel(reminder.id);

        const delay = Math.max(
          0,
          Date.parse(reminder.scheduledFor) - currentTime,
        );
        const handle = setTimer(() => {
          timers.delete(reminder.id);
          onDue(reminder);
        }, delay);

        timers.set(reminder.id, { handle, reminder, signature });
      }
    },

    cancel,

    clear() {
      for (const id of [...timers.keys()]) cancel(id);
    },

    getScheduledIds() {
      return [...timers.keys()];
    },
  };
}
