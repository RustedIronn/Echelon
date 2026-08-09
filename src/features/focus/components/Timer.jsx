import { useState, useEffect } from "react";
import { Button } from "@ui";

export default function Timer() {
  const [seconds, setSeconds] = useState(1500);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return (
    <div className="card">
      <h2>Focus Timer</h2>

      <h1>
        {minutes}:{remaining.toString().padStart(2, "0")}
      </h1>

      <Button onClick={() => setRunning(!running)}>
        {running ? "Pause" : "Start"}
      </Button>
    </div>
  );
}
