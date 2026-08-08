import { Card } from "@components/ui";

export default function ReviewBreakdown({ breakdown }) {
  return (
    <Card>
      <div className="section-header">
        <h2>Breakdown</h2>

        <p>Where your score came from.</p>
      </div>

      <div className="review-breakdown">
        {breakdown.map((item) => (
          <div key={item.label}>
            <strong>{item.value}%</strong>

            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
