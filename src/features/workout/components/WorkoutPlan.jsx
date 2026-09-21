import { Link } from "react-router-dom";

import { getToday } from "@/shared/date";
import { workouts } from "../constants";
import { shiftWorkoutPlanDate } from "../utils";

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function WorkoutPlan() {
  const today = getToday();
  const dayIndex = (new Date().getDay() + 6) % 7;
  const monday = shiftWorkoutPlanDate(today, -dayIndex);

  return (
    <div className="workout-week-plan" aria-label="Weekly training plan">
      {weekdays.map((day, index) => {
        const workout = workouts.find((item) => item.day === day);
        const date = shiftWorkoutPlanDate(monday, index);
        const recovery = day === "SUN";
        const activeRecovery = day === "WED" || day === "SAT";
        const kind = recovery ? "Recovery" : activeRecovery ? "Active recovery" : "Training";
        return (
          <Link key={day} to={`/workouts/today?date=${date}`} className={`workout-week-plan__day${date === today ? " is-today" : ""}`} aria-current={date === today ? "date" : undefined}>
            <span className="workout-week-plan__date"><strong>{day}</strong><small>{date.slice(-2)}</small></span>
            <span className="workout-week-plan__workout"><strong>{workout.title}</strong><small>{workout.description}</small></span>
            <span className={`workout-week-plan__kind is-${recovery ? "recovery" : activeRecovery ? "active" : "training"}`}>{kind}</span>
            <span className="workout-week-plan__open" aria-hidden="true">↗</span>
          </Link>
        );
      })}
    </div>
  );
}
