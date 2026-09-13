import { Card } from "@ui";

import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";
import { getTodayFocusTime } from "@features/focus/utils";
import { getToday } from "@/shared/date";

export default function DailyOverview() {
  const habits = useHabits((state) => state.habits);

  const sessions = useFocus((state) => state.sessions);

  const workouts = useWorkout((state) => state.sessions);

  const completedHabits = habits.filter((habit) => habit.done).length;

  const focusMinutes = Math.floor(
    getTodayFocusTime(sessions) / 60,
  );

  const trainedToday = workouts.some(
    (item) => item.date === getToday(),
  );

  return (
    <Card>
      <div className="daily-overview">
        <h2>Today's Execution</h2>

        <div className="overview-grid">
          <div>
            <strong>{completedHabits}</strong>

            <span>Habits</span>
          </div>

          <div>
            <strong>{focusMinutes}</strong>

            <span>Focus min</span>
          </div>

          <div>
            <strong>{trainedToday ? "✓" : "—"}</strong>

            <span>Workout</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
