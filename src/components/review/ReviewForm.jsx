import { useLockIn } from "@store/useLockIn";

export default function ReviewForm() {
  const { review, setReview } = useLockIn();

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
