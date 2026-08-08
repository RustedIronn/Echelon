import { useToday } from "@features/schedule/today";

export default function ReviewForm() {
  const { review, setReview } = useToday();

  return (
    <div className="card">
      <h2>Daily Review</h2>

      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="What went well? What needs improvement?"
      />
    </div>
  );
}
