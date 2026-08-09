import Card from "./Card";

export default function Section({ title, description, children }) {
  return (
    <Card>
      <div className="section-header">
        <h2>{title}</h2>

        {description && <p>{description}</p>}
      </div>

      {children}
    </Card>
  );
}
