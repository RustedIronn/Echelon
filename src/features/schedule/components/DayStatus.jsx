import { useToday } from "@/features/schedule/todayStore";
import { Card } from "@ui";

export default function DayStatus() {
  const { date } = useToday();

  return (
    <Card>
      <h2>Today</h2>

      <p>{date}</p>
    </Card>
  );
}
