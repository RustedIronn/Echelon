import { useToday } from "@features/schedule/today";
import Timeline from "@features/schedule/components/Timeline";
import { PageTitle } from "@ui";

export default function Schedule() {
  const { tasks, toggleTask } = useToday();

  return (
    <div className="page">
      <PageTitle
        label="STRUCTURE"
        title="Schedule"
        description="One deliberate day."
      />

      <Timeline tasks={tasks} toggleTask={toggleTask} />
    </div>
  );
}
