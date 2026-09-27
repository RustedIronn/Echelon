import AppRoot from "./AppRoot";
import { useAuth } from "@core/auth/store";
import Login from "@core/auth/components/Login";
import { LoadingState } from "@ui";
import DesktopTitleBar from "@/desktop/DesktopTitleBar";
import { isDesktop } from "@/desktop/environment";

export default function Root() {
  const { user, loading } = useAuth();
  const desktop = isDesktop();

  let content;

  if (loading) {
    content = (
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
  } else if (!user) {
    content = <Login />;
  } else {
    content = <AppRoot key={user.uid} />;
  }

  if (!desktop) return content;

  return (
    <div className="desktop-window-frame">
      <DesktopTitleBar />
      <div className="desktop-window-content">{content}</div>
    </div>
  );
}
