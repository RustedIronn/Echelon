import MotionCard from "./MotionCard";

export default function Card({ children }) {
  return (
    <MotionCard>
      <section className="card">{children}</section>
    </MotionCard>
  );
}
