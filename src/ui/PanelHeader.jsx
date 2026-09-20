export default function PanelHeader({ eyebrow, title, description, actions, as: Element = "header", className = "" }) {
  return (
    <Element className={`panel-header ${className}`.trim()}>
      <div>
        {eyebrow ? <span className="panel-header__eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="panel-header__actions">{actions}</div> : null}
    </Element>
  );
}
