export function Stat({
  label,
  value,
  tone = "text",
  pulse = false,
}: {
  label: string;
  value: string;
  tone?: "text" | "accent" | "risk-high";
  pulse?: boolean;
}) {
  const color =
    tone === "accent" ? "text-accent" : tone === "risk-high" ? "text-risk-high" : "text-text";
  return (
    <div className="border border-border bg-panel-2 rounded p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted font-mono">
        {pulse && <span className={`inline-block h-1.5 w-1.5 rounded-full bg-accent sp-pulse`} />}
        {label}
      </div>
      <div className={`mt-1 font-mono text-3xl ${color}`}>{value}</div>
    </div>
  );
}
