import { useEffect, useState } from "react";
import { loginWithGoogle } from "../authRemote";
import { Button } from "@ui";
import { DESKTOP_AUTH_STATUS_EVENT, isDesktop } from "@/desktop/environment";
import { cancelDesktopGoogleLogin } from "@/desktop/auth";

export default function Login() {
  const desktop = isDesktop();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!desktop) return undefined;
    const handleStatus = ({ detail }) => {
      setStatus(detail.status);
      setMessage(detail.message ?? "");
    };
    window.addEventListener(DESKTOP_AUTH_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(DESKTOP_AUTH_STATUS_EVENT, handleStatus);
  }, [desktop]);

  const handleLogin = async () => {
    setStatus("opening");
    setMessage("");
    try {
      await loginWithGoogle();
    } catch (error) {
      setStatus((current) => current === "cancelled" ? current : "error");
      setMessage((current) => current || error?.message || "Google sign-in could not be started.");
    }
  };

  const pending = desktop && ["opening", "waiting", "finishing"].includes(status);

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/assets/echelon.svg" alt="Echelon" />

        <h1>Echelon</h1>

        <p>Personal Growth System</p>

        <Button onClick={handleLogin} disabled={pending}>
          {status === "opening" ? "Opening browser…" : status === "waiting" ? "Waiting for Google…" : status === "finishing" ? "Finishing sign-in…" : "Continue with Google"}
        </Button>

        {pending ? <Button variant="ghost" onClick={() => void cancelDesktopGoogleLogin()}>Cancel sign-in</Button> : null}

        {message && (
          <p className={status === "error" ? "form-error" : "form-help"} role={status === "error" ? "alert" : "status"}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
