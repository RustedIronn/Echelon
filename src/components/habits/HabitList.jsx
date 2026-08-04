import { useHabits } from "@store/useHabits";
import { habits as defaultHabits } from "@data/habits";

export default function HabitList() {
  const { habits, toggleHabit } = useHabits();

  const list = habits.length
    ? habits
    : defaultHabits.map((name) => ({
        name,
        done: false,
      }));

  return (
    <div className="card">
      <h2>Daily Habits</h2>

      <div className="habit-list">
        {list.map((habit) => (
          <label
            className={`habit-item ${habit.done ? "completed" : ""}`}
            key={habit.name}
          >
            <input
              type="checkbox"
              checked={habit.done}
              onChange={() => toggleHabit(habit.name)}
            />

            <span>{habit.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
