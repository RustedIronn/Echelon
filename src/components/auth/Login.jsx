import { loginWithGoogle } from "@services/auth";
import { Button } from "@components/ui";

async function handleLogin() {
  try {
    await loginWithGoogle();
  } catch (error) {
    console.error("Login failed:", error);
  }
}

export default function Login() {
  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/assets/echelon.svg" alt="Echelon" />

        <h1>Echelon</h1>

        <p>Personal Growth System</p>

        <Button onClick={handleLogin}>Continue with Google</Button>
      </div>
    </div>
  );
}
