import type { DailyLog } from '../../types';
import { formatHours } from '../../lib/format';
import { LogSheetGrid } from './log-sheet-grid';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function LogSheet({ log, totalDays }: { log: DailyLog; totalDays: number }): React.JSX.Element {
  const dateStr = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const cyclePercent = Math.round((log.recap.cycleHoursUsed / 70) * 100);

  return (
    <div className="border border-[var(--color-fg)]">
      <div className="px-5 py-3 border-b border-[var(--color-fg)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm tabular-nums">
            day {pad(log.dayNumber)} / {pad(totalDays)} · {dateStr}
          </h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {log.fromLocation} → {log.toLocation}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--color-muted)] tabular-nums">
          <span>{log.totalMiles} mi</span>
          <span>{formatHours(log.totals.driving)} driving</span>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <LogSheetGrid log={log} />
      </div>

      {log.remarks.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--color-line)]">
          <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1.5">remarks</p>
          <div className="text-xs text-[var(--color-muted)] space-y-0.5">
            {log.remarks.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-[var(--color-line)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">
              70-hour / 8-day recap
            </p>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <span className="text-[var(--color-muted)]">
                used: <span className="text-[var(--color-fg)]">{formatHours(log.recap.cycleHoursUsed)}</span>
              </span>
              <span className="text-[var(--color-muted)]">
                available: <span className="text-[var(--color-fg)]">{formatHours(log.recap.cycleHoursAvailable)}</span>
              </span>
            </div>
          </div>
          <div className="w-20 h-2 border border-[var(--color-fg)]">
            <div className="h-full bg-[var(--color-fg)]" style={{ width: `${cyclePercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
