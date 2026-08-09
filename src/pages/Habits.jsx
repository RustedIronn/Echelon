import HabitList from "@features/habits/components/HabitList";
import PageTitle from "@ui/PageTitle";

export default function Habits() {

  return (
    <div className="page">
      <PageTitle
        label="CONSISTENCY"
        title="Habits"
        description="Small actions repeated."
      />

      <HabitList />
    </div>
  );
}
