import type { DailyLog } from '../types';
import { LogSheetGrid } from './log-sheet-grid';

export function LogSheet({ log }: { log: DailyLog }): React.JSX.Element {
  const dateStr = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Day {log.dayNumber} — {dateStr}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {log.fromLocation} → {log.toLocation}
            </p>
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <span className="font-medium">{log.totalMiles} miles</span>
            <span>
              Driving: <span className="font-medium">{formatHours(log.totals.driving)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <LogSheetGrid log={log} />
      </div>

      {log.remarks.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
          <div className="text-sm text-gray-700 space-y-0.5">
            {log.remarks.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Recap — 70 Hour / 8 Day
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Cycle hours used: </span>
            <span className="font-semibold text-gray-800">
              {formatHours(log.recap.cycleHoursUsed)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Hours available: </span>
            <span className="font-semibold text-green-700">
              {formatHours(log.recap.cycleHoursAvailable)}
            </span>
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
