import { useToday } from "@/features/schedule/todayStore";
import { Button } from "@ui";

export default function ResetDay() {
  const { resetDay } = useToday();

  return (
    <section className="card danger-card">
      <h2>Reset</h2>

      <p>Clear today's progress.</p>

      <Button variant="danger" onClick={resetDay}>Reset Day</Button>
    </section>
  );
}
