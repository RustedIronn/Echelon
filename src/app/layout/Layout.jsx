import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PageTransition from "./PageTransition";
import useKeyboard from "@hooks/useKeyboard";
import Toast from "@ui/Toast";
import ScrollToTop from "./ScrollToTop";
import FocusSurface from "@features/focus/components/FocusSurface.jsx";
import LegacyToolsMigration from "@features/plan/legacyTools/LegacyToolsMigration.jsx";

export default function Layout() {
  useKeyboard();
  const location = useLocation();
  const route = location.pathname === "/"
    ? "today"
    : location.pathname.split("/").filter(Boolean)[0] ?? "today";
  return (
    <div className="app" data-route={route}>
      <Toast />
      <FocusSurface />
      <LegacyToolsMigration />
      <ScrollToTop />

      <Sidebar />

      <main className="app-main">
        <div className="app-canvas">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
