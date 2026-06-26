import { InputHTMLAttributes } from "react";

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted font-mono">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
      />
    </label>
  );
}
