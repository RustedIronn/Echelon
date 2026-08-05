import { useFocus } from "@store/useFocus";
import { useHabits } from "@store/useHabits";
import { useWorkout } from "@store/useWorkout";

import { Clock3, CheckCircle2, Flame, Dumbbell } from "lucide-react";

import { getTodayFocusTime, formatTime } from "@utils/focusStats";

import { getCompletedCount } from "@utils/stats";

import { getWorkoutStreak } from "@utils/workoutAnalyzer";

export default function StatsRow({ tasks }) {
  const { sessions } = useFocus();

  const { habits } = useHabits();

  const workouts = useWorkout((state) => state.sessions);

  const focus = getTodayFocusTime(sessions);

  const completed = getCompletedCount(tasks);

  const doneHabits = habits.filter((habit) => habit.done).length;

  const streak = getWorkoutStreak(workouts);

  const stats = [
    {
      label: "Deep Work",
      value: formatTime(focus),
      icon: Clock3,
      type: "focus",
    },

    {
      label: "Tasks",
      value: `${completed}/${tasks.length}`,
      icon: CheckCircle2,
      type: "build",
    },

    {
      label: "Habits",
      value: `${doneHabits}/${habits.length}`,
      icon: Flame,
      type: "nourishment",
    },

    {
      label: "Training",
      value: `🔥 ${streak}`,
      icon: Dumbbell,
      type: "movement",
    },
  ];

  return (
    <div className="stats-row">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <section className={`stat-card ${stat.type}`} key={stat.label}>
            <div className="stat-icon">
              <Icon size={20} />
            </div>

            <div>
              <p>{stat.label}</p>

              <h2>{stat.value}</h2>
            </div>
          </section>
        );
      })}
    </div>
  );
}
