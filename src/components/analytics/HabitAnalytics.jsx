import { useHabits } from "@store/useHabits";
import { Card } from "../ui";

export default function HabitAnalytics() {
  const { habits } = useHabits();

  const completed = habits.filter((habit) => habit.done).length;

  const percentage = habits.length
    ? Math.round((completed / habits.length) * 100)
    : 0;

  return (
    <Card>
      <h2>Habits</h2>

      <h1>{percentage}%</h1>

      <p>Daily consistency</p>
    </Card>
  );
}
