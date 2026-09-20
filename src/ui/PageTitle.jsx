export default function PageTitle({ label, title, description, actions, tone = "default" }) {
  return (
    <header className={`page-header page-header--${tone}`}>
      <div className="page-header-copy">
        <p className="page-header-kicker"><span aria-hidden="true" />{label}</p>
        <h1>{title}</h1>
        <p className="page-header-description">{description}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
