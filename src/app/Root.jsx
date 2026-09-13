import AppRoot from "./AppRoot";
import { useAuth } from "@core/auth/store";
import Login from "@core/auth/components/Login";

export default function Root() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Login />;

  return <AppRoot key={user.uid} />;
}
