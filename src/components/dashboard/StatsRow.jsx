import { useFocus } from "@store/useFocus";
import { useHabits } from "@store/useHabits";

import { Clock3, CheckCircle2, Target, Flame } from "lucide-react";

import { getTodayFocusTime, formatTime } from "@utils/focusStats";

import { getCompletedCount } from "@utils/stats";

export default function StatsRow({ tasks }) {
  const { sessions } = useFocus();

  const { habits } = useHabits();

  const focus = getTodayFocusTime(sessions);

  const completed = getCompletedCount(tasks);

  const doneHabits = habits.filter((habit) => habit.done).length;

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
      label: "Sessions",
      value: sessions.length,
      icon: Target,
      type: "movement",
    },
    {
      label: "Habits",
      value: `${doneHabits}/${habits.length}`,
      icon: Flame,
      type: "nourishment",
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
