import WorkoutPlan from "./WorkoutPlan";

export default function WorkoutPlans() {
  return (
    <div className="stack">
      <div className="section-header">
        <h2>Workout Plans</h2>
        <p>Your current weekly training plan.</p>
      </div>

      <WorkoutPlan />
    </div>
  );
}
