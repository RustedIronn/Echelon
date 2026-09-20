import HabitList from "@features/habits/components/HabitList";
import { PageTitle, PanelHeader, Stage } from "@ui";
import { useHabits } from "@features/habits/store";

export default function Habits() {
  const habits = useHabits((state) => state.habits);
  const completed = habits.filter((habit) => habit.done).length;

  return (
    <div className="page">
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
          <div className="habit-orbit" aria-hidden="true">
            <span style={{ "--habit-progress": habits.length ? `${(completed / habits.length) * 360}deg` : "0deg" }} />
          </div>
          )}
        />
        <HabitList />
      </Stage>
    </div>
  );
}
