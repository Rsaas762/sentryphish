import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel } from "../components/ui/Panel";
import { Stat } from "../components/ui/Stat";
import { Button } from "../components/ui/Button";

export default function Dashboard() {
  const { user, org, logout } = useAuth();
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/app" className="text-text">
            Overview
          </Link>
          <Link to="/app/employees" className="text-muted hover:text-text">
            Employees
          </Link>
          <span className="text-muted">{org?.name}</span>
          <Button onClick={() => logout()} className="px-3 py-1">
            Sign out
          </Button>
        </nav>
      </header>
      <main className="p-6 space-y-6">
        <div className="text-sm text-muted font-mono">OPERATOR // {user?.email}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Org risk score" value="—" tone="accent" pulse />
          <Stat label="Active campaigns" value="0" />
          <Stat label="Employees enrolled" value="0" />
        </div>
        <Panel title="Getting started">
          <ol className="list-decimal pl-5 text-sm text-muted space-y-1">
            <li>
              Upload your employee roster (CSV) on the{" "}
              <Link to="/app/employees" className="text-accent">
                Employees
              </Link>{" "}
              page.
            </li>
            <li>Campaign engine, risk scoring, and training arrive in the next phases.</li>
          </ol>
        </Panel>
      </main>
    </div>
  );
}
