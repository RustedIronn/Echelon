import { useHabits } from "@features/habits/store";
import { createHabits } from "@features/habits/habits";
import { Apple, Check, Crosshair, Dumbbell, EyeOff, Moon } from "lucide-react";

const presentation = {
  exercise: { icon: Dumbbell, note: "Wake the body", tone: "coral" },
  "focused-work": { icon: Crosshair, note: "Protect attention", tone: "plum" },
  "eat-healthy": { icon: Apple, note: "Nourish deliberately", tone: "moss" },
  "no-doom-scrolling": { icon: EyeOff, note: "Keep the feed quiet", tone: "teal" },
  "sleep-on-time": { icon: Moon, note: "Close the day gently", tone: "lavender" },
};

export default function HabitList() {
  const { habits, toggleHabit } = useHabits();

  const list = habits.length
    ? habits
    : createHabits();

  return (
    <section className="habit-board" aria-label="Daily habits">
      <div className="habit-list">
        {list.map((habit, index) => {
          const identity = presentation[habit.id] ?? presentation["focused-work"];
          const Icon = identity.icon;

          return (
            <label
              className={`habit-item habit-item--${identity.tone} ${habit.done ? "completed" : ""}`}
              key={habit.id}
              style={{ "--habit-index": index }}
            >
              <input
                type="checkbox"
                checked={habit.done}
                onChange={() => toggleHabit(habit.id)}
              />
              <span className="habit-node" aria-hidden="true">
                {habit.done ? <Check size={20} /> : <Icon size={20} />}
              </span>
              <span className="habit-copy">
                <strong>{habit.name}</strong>
                <small>{identity.note}</small>
              </span>
              <span className="habit-index" aria-hidden="true">0{index + 1}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
