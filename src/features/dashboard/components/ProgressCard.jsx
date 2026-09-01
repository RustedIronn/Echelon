import { calculateProgress, getCompletedCount, getScore } from "@/shared/stats";

import { Card } from "@ui";

import { useStats } from "@/features/analytics/useStats";

export default function ProgressCard({ tasks }) {
  const progress = calculateProgress(tasks);
  const completed = getCompletedCount(tasks);
  const { saveDay } = useStats();
  const score = getScore(tasks);

  return (
    <Card>
      <h2>Today's Progress</h2>

      <h3>{progress}%</h3>

      <p>
        {completed}/{tasks.length} completed
      </p>

      <p>{score}</p>

      <button onClick={() => saveDay(progress)}>Save Day</button>
    </Card>
  );
}
