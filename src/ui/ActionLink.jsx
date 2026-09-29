import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const DirectionIcon = ({ direction }) => {
  if (direction === "back") return <ChevronLeft size={16} aria-hidden="true" />;
  if (direction === "forward") return <ChevronRight size={16} aria-hidden="true" />;
  return <ArrowUpRight size={16} aria-hidden="true" />;
};

export default function ActionLink({ children, direction = "external", className = "", ...props }) {
  return (
    <Link className={`action-link ${className}`.trim()} {...props}>
      {direction === "back" ? <DirectionIcon direction={direction} /> : null}
      <span>{children}</span>
      {direction !== "back" ? <DirectionIcon direction={direction} /> : null}
    </Link>
  );
}
