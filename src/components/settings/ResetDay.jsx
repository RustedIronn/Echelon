import { useToday } from "@/store/useToday";
import { Button } from "../ui";

export default function ResetDay() {
  const { resetDay } = useToday();

  return (
    <section className="card danger-card">
      <h2>Reset</h2>

      <p>Clear today's progress.</p>

      <Button onClick={resetDay}>Reset Day</Button>
    </section>
  );
}
