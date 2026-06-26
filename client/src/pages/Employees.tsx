import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel } from "../components/ui/Panel";

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string | null;
  active: boolean;
}
interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.get<{ employees: Employee[] }>("/api/employees").then((r) => setEmployees(r.employees));
  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const result = await api.upload<ImportSummary>("/api/employees/import", file);
      setSummary(result);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deactivate(id: string) {
    await api.patch(`/api/employees/${id}/deactivate`);
    await load();
  }

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="font-mono text-sm tracking-widest text-accent">SENTRYPHISH</div>
        <nav className="flex gap-4 text-sm">
          <Link to="/app" className="text-muted hover:text-text">
            Overview
          </Link>
          <Link to="/app/employees" className="text-text">
            Employees
          </Link>
        </nav>
      </header>
      <main className="p-6 space-y-6">
        <Panel title="Import roster (CSV: name,email,department)">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={onUpload}
            className="text-sm text-muted"
          />
          {error && <div className="mt-3 text-sm text-risk-high font-mono">{error}</div>}
          {summary && (
            <div className="mt-3 font-mono text-sm text-muted">
              <span className="text-risk-low">{summary.created} created</span> ·{" "}
              <span className="text-accent">{summary.updated} updated</span> ·{" "}
              <span className="text-risk-elevated">{summary.skipped} skipped</span>
              {summary.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-risk-high">
                  {summary.errors.map((er) => (
                    <li key={er.row}>
                      row {er.row}: {er.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        <Panel title={`Employees (${employees.length})`}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted font-mono">
              <tr className="border-b border-border">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border/50">
                  <td className="py-2 font-sans">{emp.name}</td>
                  <td className="text-muted">{emp.email}</td>
                  <td className="text-muted">{emp.department ?? "—"}</td>
                  <td className={emp.active ? "text-risk-low" : "text-muted"}>
                    {emp.active ? "ACTIVE" : "INACTIVE"}
                  </td>
                  <td className="text-right">
                    {emp.active && (
                      <button
                        onClick={() => deactivate(emp.id)}
                        className="text-xs text-risk-high hover:underline"
                      >
                        deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No employees yet — import a CSV above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </main>
    </div>
  );
}
