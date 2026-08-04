import { useFocus } from "@store/useFocus";
import { getTodayFocusTime, formatTime } from "@utils/focusStats";
import { Card } from "../ui";

export default function FocusStats() {
  const { sessions } = useFocus();

  const today = getTodayFocusTime(sessions);

  return (
    <Card>
      <h2>Deep Work</h2>

      <h1>{today ? formatTime(today) : "0m"}</h1>

      <p>{sessions.length} sessions completed</p>
    </Card>
  );
}
