import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PageTransition from "./PageTransition";
import useKeyboard from "@hooks/useKeyboard";
import Toast from "@ui/Toast";
import ScrollToTop from "./ScrollToTop";
import FocusSurface from "@features/focus/components/FocusSurface";
import LegacyToolsMigration from "@features/tools/LegacyToolsMigration";

export default function Layout() {
    useKeyboard();
  return (
    <div className="app">
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
