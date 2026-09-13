import MotionCard from "./MotionCard";

export default function Card({ children, className = "", ...props }) {
  return (
    <MotionCard>
      <section className={`card ${className}`.trim()} {...props}>
        {children}
      </section>
    </MotionCard>
  );
}
