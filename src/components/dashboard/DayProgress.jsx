import { useHabits } from "@features/habits/store";
import { useFocus } from "@store/useFocus";
import { useWorkout } from "@store/useWorkout";

import { getTodayFocusTime } from "@utils/focusStats";
import { calculateExecutionScore } from "@utils/executionScore";

export default function DayProgress({ tasks }) {
  const { habits } = useHabits();

  const { sessions } = useFocus();

  const workouts = useWorkout((state) => state.sessions);

  const focusMinutes = Math.floor(getTodayFocusTime(sessions) / 60);

  const hasWorkout = workouts.some(
    (item) => item.date === new Date().toISOString().split("T")[0],
  );

  const progress = calculateExecutionScore({
    tasks,
    habits,
    focusMinutes,
    hasWorkout,
  });

  const radius = 42;

  const circumference = 2 * Math.PI * radius;

  const offset = circumference - (progress / 100) * circumference;

  return (
    <section className="progress-card">
      <div className="ring">
        <svg width="110" height="110">
          <circle className="ring-bg" cx="55" cy="55" r={radius} />

          <circle
            className="ring-progress"
            cx="55"
            cy="55"
            r={radius}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>

        <strong>{progress}%</strong>
      </div>

      <div>
        <p>DAILY EXECUTION</p>

        <h2>{progress >= 80 ? "Excellent momentum" : "Keep moving"}</h2>

        <span>Consistency beats intensity.</span>
      </div>
    </section>
  );
}
