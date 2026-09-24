export function LoadingSkeleton(): React.JSX.Element {
  return (
    <div aria-live="polite" className="space-y-5 animate-fade-in-up">
      <div className="border border-[var(--color-fg)] p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 border border-dashed border-[var(--color-line)]" />
          ))}
        </div>
      </div>
      <div className="border border-[var(--color-fg)] h-[400px]" />
      <div className="border border-[var(--color-fg)] h-64" />
      <p className="text-sm text-[var(--color-muted)]">
        planning route
        <span aria-hidden="true" className="inline-block w-2 h-3.5 ml-1 -mb-0.5 bg-[var(--color-fg)] animate-blink" />
      </p>
    </div>
  );
}
