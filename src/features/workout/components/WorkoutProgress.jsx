import WorkoutAnalytics from "./WorkoutAnalytics";

export default function WorkoutProgress() {
  return (
    <div className="stack">
      <div className="section-header">
        <h2>Workout Progress</h2>
        <p>Your existing training totals and consistency.</p>
      </div>

      <WorkoutAnalytics />
    </div>
  );
}
