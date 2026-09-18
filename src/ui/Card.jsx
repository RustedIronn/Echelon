import MotionCard from "./MotionCard";

export default function Card({
  children,
  className = "",
  interactive = false,
  ...props
}) {
  return (
    <MotionCard>
      <section
        className={`card ${interactive ? "card--interactive" : ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </section>
    </MotionCard>
  );
}
