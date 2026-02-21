import type { DailyLog } from '../types';
import { LogSheetGrid } from './log-sheet-grid';

export function LogSheet({ log }: { log: DailyLog }): React.JSX.Element {
  const dateStr = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const cyclePercent = Math.round((log.recap.cycleHoursUsed / 70) * 100);

  return (
    <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center font-[var(--font-display)] text-sm font-bold text-[var(--color-accent)]">
            {log.dayNumber}
          </div>
          <div>
            <h3 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-text)] leading-tight">
              {dateStr}
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 flex items-center gap-1">
              {log.fromLocation}
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
              {log.toLocation}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <svg className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64" />
            </svg>
            <span className="font-semibold text-[var(--color-text)]">{log.totalMiles}</span> mi
          </span>
          <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <svg className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="font-semibold text-[var(--color-text)]">{formatHours(log.totals.driving)}</span> driving
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="px-3 py-2.5 bg-[var(--color-surface)]">
        <LogSheetGrid log={log} />
      </div>

      {/* Remarks */}
      {log.remarks.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--color-border-light)]">
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Remarks</p>
          <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5 leading-relaxed">
            {log.remarks.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        </div>
      )}

      {/* Recap */}
      <div className="px-5 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-surface-sunken)]/50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
              70-Hour / 8-Day Recap
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-[var(--color-text-secondary)]">
                Used: <span className="font-semibold text-[var(--color-text)]">{formatHours(log.recap.cycleHoursUsed)}</span>
              </span>
              <span className="text-[var(--color-text-secondary)]">
                Available: <span className="font-semibold text-[var(--color-success)]">{formatHours(log.recap.cycleHoursAvailable)}</span>
              </span>
            </div>
          </div>
          <div className="w-20 h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${cyclePercent}%`,
                backgroundColor: cyclePercent > 85 ? 'var(--color-danger)' : cyclePercent > 60 ? 'var(--color-warning)' : 'var(--color-success)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
