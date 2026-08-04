import { nonNegotiables } from "@data/principles";
import { Check } from "lucide-react";

export default function NonNegotiables() {
  return (
    <section className="card checklist-card">
      <div className="section-header">
        <h2>Non-Negotiables</h2>

        <p>The rules that keep the system alive.</p>
      </div>

      <div className="checklist">
        {nonNegotiables.map((item) => (
          <div className="check-item" key={item}>
            <div className="check-icon">
              <Check size={15} />
            </div>

            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
