import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PageTransition from "./PageTransition";
import useKeyboard from "@hooks/useKeyboard";
import Toast from "@ui/Toast";

export default function Layout() {
    useKeyboard();
  return (
    <div className="app">
      <Toast />

      <Sidebar />

      <main>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <MobileNav />
    </div>
  );
}
