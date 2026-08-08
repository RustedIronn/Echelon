import FocusSession from "@features/focus/components/FocusSession";
import { useFocus } from "@features/focus/store";
import { PageTitle, Card } from "@components/ui";

export default function Focus() {
  const { sessions } = useFocus();

  return (
    <div className="page">
      <PageTitle
        label="DEEP WORK"
        title="Focus"
        description="Protect your attention."
      />

      <FocusSession />

      <Card>
        <h2>Recent Sessions</h2>

        {sessions
          .slice(-5)
          .reverse()
          .map((session, index) => (
            <div className="session-item" key={index}>
              <strong>{session.task}</strong>

              <span>{Math.floor(session.duration / 60)} min</span>
            </div>
          ))}
      </Card>
    </div>
  );
}
