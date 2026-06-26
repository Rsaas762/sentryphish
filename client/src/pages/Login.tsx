import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      nav("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 font-mono text-sm tracking-widest text-accent">SENTRYPHISH // ACCESS</div>
        <Panel title="Sign in">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <div className="text-sm text-risk-high font-mono">{error}</div>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Authenticating…" : "Sign in"}
            </Button>
          </form>
        </Panel>
        <div className="mt-4 text-center text-sm text-muted">
          No account?{" "}
          <Link to="/signup" className="text-accent">
            Provision an organization
          </Link>
        </div>
      </div>
    </div>
  );
}
