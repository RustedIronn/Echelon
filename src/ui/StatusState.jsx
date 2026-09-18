export default function StatusState({
  title,
  description,
  tone = "empty",
  compact = false,
}) {
  const liveProps = tone === "error"
    ? { role: "alert" }
    : tone === "loading"
      ? { role: "status", "aria-live": "polite", "aria-busy": "true" }
      : {};

  return (
    <div
      className={`state-message state-message--${tone} ${compact ? "state-message--compact" : ""}`.trim()}
      {...liveProps}
    >
      {tone === "loading" ? (
        <span className="state-message__indicator" aria-hidden="true" />
      ) : null}
      {title ? <h3>{title}</h3> : null}
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function LoadingState(props) {
  return <StatusState {...props} tone="loading" />;
}

export function ErrorState(props) {
  return <StatusState {...props} tone="error" />;
}
