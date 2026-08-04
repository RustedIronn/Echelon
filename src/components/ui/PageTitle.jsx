export default function PageTitle({ label, title, description }) {
  return (
    <header className="page-header">
      <p>{label}</p>

      <h1>{title}</h1>

      <span>{description}</span>
    </header>
  );
}
