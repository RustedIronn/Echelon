import Subnav from "./Subnav";

export default function WorkspaceHeader({ title, context, description, tabs, actions, className = "" }) {
  return (
    <header className={`workspace-header ${className}`.trim()}>
      <div className="workspace-header__copy">
        {context ? <span>{context}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {tabs ? <Subnav {...tabs} /> : null}
      {actions ? <div className="workspace-header__actions">{actions}</div> : null}
    </header>
  );
}
