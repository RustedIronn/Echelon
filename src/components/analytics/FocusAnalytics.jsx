import { useFocus } from "@store/useFocus";
import { getTotalFocusTime, formatTime } from "@utils/focusStats";

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
