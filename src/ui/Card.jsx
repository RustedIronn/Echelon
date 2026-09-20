export default function Card({
  children,
  className = "",
  interactive = false,
  material = "panel",
  shape = "organic",
  ...props
}) {
  return (
    <section
      className={`card card--${material} card--shape-${shape} ${interactive ? "card--interactive" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  );
}
