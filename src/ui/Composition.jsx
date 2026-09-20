export function Stage({ children, className = "", tone = "soft", as: Element = "section" }) {
  return (
    <Element className={`stage stage--${tone} ${className}`.trim()}>
      {children}
    </Element>
  );
}

export function Mosaic({ children, className = "", layout = "split" }) {
  return (
    <div className={`mosaic mosaic--${layout} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function SectionLead({ eyebrow, title, description, children }) {
  return (
    <header className="section-lead">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="section-lead-actions">{children}</div> : null}
    </header>
  );
}
