import AppRoot from "./AppRoot";
import { useAuth } from "@core/auth/store";
import Login from "@core/auth/components/Login";
import { LoadingState } from "@ui";

export default function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card auth-loading-card">
          <img src="/assets/echelon.svg" alt="" />

          <h1>Echelon</h1>

          <LoadingState
            description="Preparing your workspace…"
          />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return <AppRoot key={user.uid} />;
}
