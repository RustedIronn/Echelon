import { motion } from "framer-motion";

export default function ProgressChart({ history }) {
  const data = history.slice(-7);

  return (
    <section className="card">
      <div className="section-header">
        <h2>Weekly Consistency</h2>

        <p>Last 7 days</p>
      </div>

      <div className="chart">
        {data.length ? (
          data.map((day) => (
            <div className="bar-wrapper" key={day.date}>
              <motion.div
                className="bar"
                initial={{
                  height: 0,
                }}
                animate={{
                  height: `${day.progress}%`,
                }}
                transition={{
                  duration: 0.5,
                }}
              />

              <span>{day.date.slice(8)}</span>
            </div>
          ))
        ) : (
          <p>No data yet.</p>
        )}
      </div>
    </section>
  );
}
