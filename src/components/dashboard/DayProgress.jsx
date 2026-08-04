import { calculateProgress } from "@utils/stats";

export default function DayProgress({ tasks }) {
  const progress = calculateProgress(tasks);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const offset = circumference - (progress / 100) * circumference;

  return (
    <section className="progress-card">
      <div className="ring">
        <svg width="110" height="110">
          <circle className="ring-bg" cx="55" cy="55" r={radius} />

          <circle
            className="ring-progress"
            cx="55"
            cy="55"
            r={radius}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>

        <strong>{progress}%</strong>
      </div>

      <div>
        <p>DAILY EXECUTION</p>

        <h2>{progress >= 80 ? "Excellent momentum" : "Keep moving"}</h2>

        <span>Consistency beats intensity.</span>
      </div>
    </section>
  );
}
