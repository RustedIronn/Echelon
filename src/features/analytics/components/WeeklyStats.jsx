import { useStats } from "@/features/analytics/useStats";
import { Card } from "@ui";

export default function WeeklyStats() {
  const { history } = useStats();

  const recent = history.slice(-7);

  return (
    <Card>
      <h2>This Week</h2>

      {recent.map((day) => (
        <div key={day.date}>
          <p>
            {day.date}
            &nbsp;
            {day.progress}%
          </p>
        </div>
      ))}
    </Card>
  );
}
