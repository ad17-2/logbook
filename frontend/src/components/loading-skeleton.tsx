export function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="h-5 w-32 rounded animate-shimmer mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 rounded-lg animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
      <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="h-12 animate-shimmer" />
        <div className="h-[400px] animate-shimmer" style={{ animationDelay: '200ms' }} />
      </div>
      <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="h-5 w-48 rounded animate-shimmer mb-4" />
        <div className="h-64 rounded-lg animate-shimmer" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
