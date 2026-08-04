import HabitList from "@components/habits/HabitList";
import PageTitle from "@components/ui/PageTitle";

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
