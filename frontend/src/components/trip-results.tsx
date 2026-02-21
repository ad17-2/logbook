import type { TripResult } from '../types';
import { RouteMap } from './route-map';
import { LogSheet } from './log-sheet';

export function TripResults({ result }: { result: TripResult }): React.JSX.Element {
  const drivingHours = result.dailyLogs.reduce((sum, log) => sum + (log.totals.driving || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-3">Trip Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Distance" value={`${result.route.totalDistanceMiles.toLocaleString()} mi`} />
          <StatCard label="Driving Time" value={formatHours(drivingHours)} />
          <StatCard label="Total Days" value={String(result.dailyLogs.length)} />
          <StatCard label="Total Stops" value={String(result.stops.length)} />
        </div>
      </div>

      <RouteMap result={result} />

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Daily Log Sheets ({result.dailyLogs.length})
        </h2>
        <div className="space-y-6">
          {result.dailyLogs.map((log) => (
            <LogSheet key={log.date} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
