import HabitList from "@features/habits/components/HabitList.jsx";
import { useHabits } from "@features/habits/store.js";
import { PageTitle, PanelHeader, Stage } from "@ui";

export default function Habits() {
  const habits = useHabits((state) => state.habits);
  const completed = habits.filter((habit) => habit.done).length;

  return (
    <div className="page habits-page">
      <PageTitle
        tone="garden"
        label="CONSISTENCY"
        title="Habits"
        description="Small actions repeated."
      />

      <Stage tone="garden" className="habit-stage">
        <PanelHeader
          eyebrow="Today’s rhythm"
          title={`${completed} of ${habits.length} complete`}
          description="Each action is small. Together they shape the texture of the day."
          actions={(
          <div className="habit-progress-meter" aria-label={`${completed} of ${habits.length} habits complete`}>
            <strong>{completed}/{habits.length}</strong>
            <span><i style={{ width: habits.length ? `${(completed / habits.length) * 100}%` : "0%" }} /></span>
          </div>
          )}
        />
        <HabitList />
      </Stage>
    </div>
  );
}
