import { useStats } from "@store/useStats";
import { Card } from "../ui";

export default function WeeklyProgress() {
  const { history } = useStats();

  return (
    <Card>
      <h2>Weekly Progress</h2>

      {history.length ? (
        history.slice(-7).map((day) => (
          <div key={day.date}>
            <p>
              {day.date} {day.progress}%
            </p>
          </div>
        ))
      ) : (
        <p>No completed days yet.</p>
      )}
    </Card>
  );
}
