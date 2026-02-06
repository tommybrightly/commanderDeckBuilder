interface PageDirectionsProps {
  title: string;
  steps: string[];
  className?: string;
}

export function PageDirections({ title, steps, className = "" }: PageDirectionsProps) {
  return (
    <div
      className={`card border-l-4 border-[var(--accent)] bg-[var(--card)]/80 px-4 py-3 ${className}`}
      role="region"
      aria-label="How to use this page"
    >
      <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[var(--accent)]" aria-hidden>•</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
