import { useState } from "react";

import { useToday } from "@/features/schedule/todayStore";
import { Button } from "@ui";

export default function ResetDay() {
  const { resetDay } = useToday();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");

  const confirmReset = () => {
    const reset = resetDay();
    setConfirming(false);
    setStatus(reset ? "Today’s completion marks were cleared." : "Today could not be reset.");
  };

  return (
    <section className="card danger-card">
      <h2>Reset</h2>

      <p>Clear today's progress.</p>

      {confirming ? (
        <div className="cluster">
          <Button variant="danger" onClick={confirmReset}>Confirm reset</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => { setStatus(""); setConfirming(true); }}>Reset Day</Button>
      )}
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}
