import { minimumStandard } from "@/features/dashboard/standards";

export default function MinimumStandard() {
  return (
    <section className="card minimum-card">
      <div className="section-header">
        <h2>Minimum Standard</h2>

        <p>Bad days still count.</p>
      </div>

      <div className="minimum-list">
        {minimumStandard.map((item) => (
          <div key={item} className="minimum-item">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
