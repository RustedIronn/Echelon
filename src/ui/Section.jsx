import Card from "./Card";

export default function Section({ title, description, children, material = "panel" }) {
  return (
    <Card material={material}>
      <div className="section-header">
        <h2>{title}</h2>

        {description && <p>{description}</p>}
      </div>

      {children}
    </Card>
  );
}
