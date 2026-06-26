import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", orgName: "", email: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup({ ...form, legalAuthorityConfirmed: consent });
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
        <div className="mb-6 font-mono text-sm tracking-widest text-accent">
          SENTRYPHISH // PROVISION ORG
        </div>
        <Panel title="Create organization">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Your name" value={form.name} onChange={set("name")} required />
            <Field
              label="Organization name"
              value={form.orgName}
              onChange={set("orgName")}
              required
            />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} required />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
            />
            <label className="flex gap-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 accent-accent"
              />
              <span>
                I confirm my organization has the legal authority to run phishing simulations
                against the employees we upload, and that staff will be given appropriate notice per
                local employment law and GDPR.
              </span>
            </label>
            {error && <div className="text-sm text-risk-high font-mono">{error}</div>}
            <Button type="submit" disabled={busy || !consent} className="w-full">
              {busy ? "Provisioning…" : "Create organization"}
            </Button>
          </form>
        </Panel>
        <div className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-accent">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
