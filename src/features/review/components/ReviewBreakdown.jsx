import { Card } from "@ui";

export default function ReviewBreakdown({ breakdown, compact = false }) {
  const Wrapper = compact ? "section" : Card;
  return (
    <Wrapper className={compact ? "review-contribution" : undefined}>
      <div className="section-header">
        <h2>What contributed</h2>

        <p>Existing execution-score components, shown separately.</p>
      </div>

      <div className="review-breakdown">
        {breakdown.map((item) => (
          <div key={item.label}>
            <strong>{item.value}%</strong>

            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </Wrapper>
  );
}
