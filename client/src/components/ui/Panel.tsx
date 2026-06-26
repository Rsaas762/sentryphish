import { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-border bg-panel rounded ${className}`}>
      {title && (
        <header className="border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted font-mono">
          {title}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
