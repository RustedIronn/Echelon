import { useEffect } from "react";
import { useWorkout } from "@store/useWorkout";

export default function TestWorkout() {
  const { workout, phase, seconds, round, exerciseIndex, tick } = useWorkout();

  useEffect(() => {
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, []);

  const exercise = workout?.exercises[exerciseIndex];

  return (
    <div>
      <h2>{phase}</h2>

      <h3>{exercise?.name}</h3>

      <p>Round {round}</p>

      <strong>{seconds}</strong>
    </div>
  );
}
