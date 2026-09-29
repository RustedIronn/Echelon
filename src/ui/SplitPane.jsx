export default function SplitPane({ as: Element = "div", side = "start", className = "", children }) {
  return <Element className={`split-pane split-pane--${side} ${className}`.trim()}>{children}</Element>;
}
