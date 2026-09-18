import AppRoot from "./AppRoot";
import { useAuth } from "@core/auth/store";
import Login from "@core/auth/components/Login";

export default function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card auth-loading-card" role="status" aria-live="polite">
          <img src="/assets/echelon.svg" alt="" />

          <h1>Echelon</h1>

          <p>Preparing your workspace…</p>

          <span className="auth-loading-indicator" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return <AppRoot key={user.uid} />;
}
