import { useEffect, useRef, useState } from "react";
import { useHabits } from "@features/habits/js/store";
import { createHabits } from "@features/habits/js/habits";
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
  const [respondingId, setRespondingId] = useState(null);
  const responseTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(responseTimer.current), []);

  const list = habits.length
    ? habits
    : createHabits();

  return (
    <section className="habit-board" aria-label="Daily habits">
      <div className="habit-list">
        {list.map((habit, index) => {
          const identity = presentation[habit.id] ?? presentation["focused-work"];
          const Icon = identity.icon;

          const toggle = () => {
            if (toggleHabit(habit.id) === false) return;
            window.clearTimeout(responseTimer.current);
            setRespondingId(habit.id);
            responseTimer.current = window.setTimeout(() => setRespondingId(null), 520);
          };

          return (
            <label
              className={`habit-item habit-item--${identity.tone} ${habit.done ? "completed" : ""} ${respondingId === habit.id ? "is-responding" : ""}`.trim()}
              key={habit.id}
              style={{ "--habit-index": index }}
            >
              <input
                type="checkbox"
                checked={habit.done}
                onChange={toggle}
                aria-label={`${habit.done ? "Reopen" : "Complete"} ${habit.name}`}
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
