import { useHabits } from "@features/habits/store";
import { createHabits } from "@features/habits/habits";

export default function HabitList() {
  const { habits, toggleHabit } = useHabits();

  const list = habits.length
    ? habits
    : createHabits();

  return (
    <div className="card">
      <h2>Daily Habits</h2>

      <div className="habit-list">
        {list.map((habit) => (
          <label
            className={`habit-item ${habit.done ? "completed" : ""}`}
            key={habit.id}
          >
            <input
              type="checkbox"
              checked={habit.done}
              onChange={() => toggleHabit(habit.id)}
            />

            <span>{habit.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
