import { useToast } from "@store/useToast";

export default function Toast() {
  const { message } = useToast();

  if (!message) return null;

  return <div className="toast">{message}</div>;
}
