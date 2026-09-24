import type { TripResult } from '../../types';
import { formatHours } from '../../lib/format';
import { RouteMap } from './route-map';
import { LogSheet } from './log-sheet';

const STAT_CONFIG = [
  { key: 'distance', label: 'total distance' },
  { key: 'driving', label: 'driving time' },
  { key: 'days', label: 'total days' },
  { key: 'stops', label: 'total stops' },
] as const;

export function TripResults({ result }: { result: TripResult }): React.JSX.Element {
  const drivingHours = result.dailyLogs.reduce((sum, log) => sum + (log.totals.driving || 0), 0);

  const statValues: Record<string, string> = {
    distance: `${result.route.totalDistanceMiles.toLocaleString()} mi`,
    driving: formatHours(drivingHours),
    days: String(result.dailyLogs.length),
    stops: String(result.stops.length),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {STAT_CONFIG.map((stat) => (
          <div key={stat.key} className="border border-[var(--color-fg)] p-4 -ml-px -mt-px">
            <p className="text-[11px] text-[var(--color-muted)] mb-2">{stat.label}</p>
            <p className="text-xl tabular-nums">{statValues[stat.key]}</p>
          </div>
        ))}
      </div>

      <RouteMap result={result} />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm text-[var(--color-fg)]">daily log sheets</h2>
          <span className="ml-auto text-xs text-[var(--color-muted)]">
            {result.dailyLogs.length} {result.dailyLogs.length === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="space-y-4">
          {result.dailyLogs.map((log) => (
            <LogSheet key={log.date} log={log} totalDays={result.dailyLogs.length} />
          ))}
        </div>
      </div>
    </div>
  );
}
