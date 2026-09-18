import { Button, Card } from "@ui";

export default function OccupiedNowPrompt({ onConfirm, onCancel }) {
  return (
    <Card className="tools-choice" role="alert">
      <div>
        <strong>Now already has one thing.</strong>
        <p>Move the current Now item to Next before bringing this one in?</p>
      </div>
      <div className="tools-actions">
        <Button onClick={onConfirm}>Move current Now to Next</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
