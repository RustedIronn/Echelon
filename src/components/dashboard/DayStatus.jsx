import { useLockIn } from "@store/useLockIn";
import { Card } from "../ui";

export default function DayStatus() {
  const { date } = useLockIn();

  return (
    <Card>
      <h2>Today</h2>

      <p>{date}</p>
    </Card>
  );
}
