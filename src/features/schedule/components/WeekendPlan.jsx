import { weekend } from "../weekend";
import { Card } from "@ui";

export default function WeekendPlan() {
  return (
    <Card>
      <div className="section-header">
        <h2>Weekend Plan</h2>

        <p>Recovery without losing momentum.</p>
      </div>

      <div className="weekend-grid">
        {weekend.map((day) => (
          <div className="weekend-item" key={day.day}>
            <h3>{day.day}</h3>

            <ul>
              {day.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
