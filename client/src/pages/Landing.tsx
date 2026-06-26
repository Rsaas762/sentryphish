import { Link } from "react-router-dom";
import { Stat } from "../components/ui/Stat";

export default function Landing() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="soc-grid pointer-events-none absolute inset-0" />
      <header className="relative flex items-center justify-between px-8 py-5">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/login" className="text-muted hover:text-text">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-sm border border-accent/40 bg-accent/10 px-4 py-2 text-accent"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-5xl px-8 pt-20">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          Phishing simulation · Security awareness
        </div>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">
          Find the click before an attacker does.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          SentryPhish runs consented phishing simulations against your own staff, turns every click
          into a teachable moment, and gives leadership one number that matters — your
          organization's human risk score.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            to="/signup"
            className="rounded-sm border border-accent/40 bg-accent/10 px-6 py-3 text-accent"
          >
            Provision your organization
          </Link>
          <Link
            to="/login"
            className="rounded-sm border border-border px-6 py-3 text-muted hover:text-text"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Avg. SMB click rate" value="1 in 3" tone="risk-high" />
          <Stat label="Training trigger" value="On click" tone="accent" />
          <Stat label="Setup time" value="< 10 min" />
        </div>

        <p className="mt-16 max-w-2xl text-xs text-muted">
          Built for consented internal testing only. SentryPhish never captures real credentials and
          uses fictional brands in its templates. See our Responsible Use guidance.
        </p>
      </main>
    </div>
  );
}
