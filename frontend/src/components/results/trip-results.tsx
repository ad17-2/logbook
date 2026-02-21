import type { TripResult } from '../../types';
import { formatHours } from '../../lib/format';
import { RouteMap } from './route-map';
import { LogSheet } from './log-sheet';

const STAT_CONFIG = [
  {
    key: 'distance',
    label: 'Total Distance',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64" />
      </svg>
    ),
    accent: 'var(--color-accent)',
    accentBg: 'var(--color-accent-soft)',
  },
  {
    key: 'driving',
    label: 'Driving Time',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: '#6366f1',
    accentBg: '#eef2ff',
  },
  {
    key: 'days',
    label: 'Total Days',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    accent: 'var(--color-success)',
    accentBg: 'var(--color-success-soft)',
  },
  {
    key: 'stops',
    label: 'Total Stops',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
    accent: 'var(--color-warning)',
    accentBg: 'var(--color-warning-soft)',
  },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CONFIG.map((stat, i) => (
          <div
            key={stat.key}
            className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-4 animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.accentBg, color: stat.accent }}
              >
                {stat.icon}
              </div>
              <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                {stat.label}
              </span>
            </div>
            <p className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-text)] tracking-tight">
              {statValues[stat.key]}
            </p>
          </div>
        ))}
      </div>

      <RouteMap result={result} />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-text)] tracking-tight">
            Daily Log Sheets
          </h2>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
            {result.dailyLogs.length} {result.dailyLogs.length === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="space-y-4">
          {result.dailyLogs.map((log, i) => (
            <div key={log.date} className="animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 80}ms` }}>
              <LogSheet log={log} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
