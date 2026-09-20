import MotionCard from "./MotionCard";

export default function Card({
  children,
  className = "",
  interactive = false,
  material = "panel",
  shape = "organic",
  ...props
}) {
  return (
    <MotionCard>
      <section
        className={`card card--${material} card--shape-${shape} ${interactive ? "card--interactive" : ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </section>
    </MotionCard>
  );
}
