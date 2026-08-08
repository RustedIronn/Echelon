import { useFocus } from "@features/focus/store";
import { getTotalFocusTime, formatTime } from "@features/focus/utils";

export default function FocusAnalytics() {
  const { sessions } = useFocus();

  const total = getTotalFocusTime(sessions);

  return (
    <section className="card analytics-highlight">
      <p>TOTAL FOCUS</p>

      <h1>{formatTime(total)}</h1>

      <span>Across all sessions</span>
    </section>
  );
}
