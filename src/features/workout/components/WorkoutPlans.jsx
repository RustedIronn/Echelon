import WorkoutPlan from "./WorkoutPlan";

export default function WorkoutPlans() {
  return (
    <div className="stack">
      <div className="section-header">
        <h2>This week</h2>
        <p>Open any day to see its prescribed workout. Recovery is part of the plan.</p>
      </div>

      <WorkoutPlan />
    </div>
  );
}
