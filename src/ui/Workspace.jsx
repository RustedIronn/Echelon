export default function Workspace({ as: Element = "div", mode = "standard", className = "", children }) {
  return <Element className={`workspace workspace--${mode} ${className}`.trim()}>{children}</Element>;
}
