import type { DailyLog, DutyStatus, LogSegment } from '../../types';
import { DUTY_STATUS_CONFIG } from '../../lib/constants';

const GRID_LEFT = 110;
const HOUR_WIDTH = 28;
const GRID_WIDTH = HOUR_WIDTH * 24;
const GRID_RIGHT = GRID_LEFT + GRID_WIDTH;
const GRID_TOP = 40;
const ROW_HEIGHT = 45;
const TOTALS_X = GRID_RIGHT + 10;

const STATUS_ROW_INDEX: Record<DutyStatus, number> = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
};

function rowCenterY(index: number): number {
  return GRID_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2;
}

function timeToX(hours: number): number {
  return GRID_LEFT + (hours / 24) * GRID_WIDTH;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return 'mid';
  if (h === 12) return 'noon';
  return h > 12 ? String(h - 12) : String(h);
}

function formatTotalHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return String(h);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function LogSheetGrid({ log }: { log: DailyLog }): React.JSX.Element {
  const gridBottom = GRID_TOP + DUTY_STATUS_CONFIG.length * ROW_HEIGHT;

  const summary = DUTY_STATUS_CONFIG
    .map(({ key, label }) => `${label}: ${formatTotalHours(log.totals[key] || 0)}h`)
    .join(', ');

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 870 250"
        className="w-full h-auto"
        style={{ minWidth: '600px', fontFamily: 'var(--font-mono)', color: 'var(--color-fg)' }}
        role="img"
        aria-label={`day ${log.dayNumber} duty status log, ${summary}`}
      >
        <GridBackground gridBottom={gridBottom} />
        <DutyStatusLines segments={log.segments} />
        <TotalHoursColumn totals={log.totals} gridBottom={gridBottom} />
      </svg>
    </div>
  );
}

function GridBackground({ gridBottom }: { gridBottom: number }): React.JSX.Element {
  return (
    <g>
      <rect
        x={GRID_LEFT}
        y={GRID_TOP}
        width={GRID_WIDTH}
        height={gridBottom - GRID_TOP}
        style={{ fill: 'var(--color-bg)' }}
        stroke="currentColor"
        strokeWidth={1.5}
      />

      {Array.from({ length: 25 }, (_, i) => {
        const x = GRID_LEFT + i * HOUR_WIDTH;
        const isMidnight = i === 0 || i === 24;
        const isNoon = i === 12;
        return (
          <g key={`hour-${i}`}>
            <line
              x1={x} y1={GRID_TOP} x2={x} y2={gridBottom}
              style={{ stroke: 'var(--color-line)' }}
              strokeWidth={isMidnight || isNoon ? 1.5 : 0.5}
            />
            {i < 24 && (
              <text
                x={x + HOUR_WIDTH / 2}
                y={GRID_TOP - 6}
                textAnchor="middle"
                fontSize={i === 0 || i === 12 ? 11 : 12}
                style={{ fill: 'var(--color-muted)' }}
              >
                {formatHour(i)}
              </text>
            )}
          </g>
        );
      })}

      {Array.from({ length: 24 }, (_, hour) =>
        [1, 2, 3].map((q) => {
          const x = GRID_LEFT + (hour + q * 0.25) * HOUR_WIDTH;
          return (
            <line
              key={`tick-${hour}-${q}`}
              x1={x} y1={GRID_TOP} x2={x} y2={GRID_TOP + 4}
              style={{ stroke: 'var(--color-line)' }}
              strokeWidth={0.5}
            />
          );
        })
      )}

      {DUTY_STATUS_CONFIG.map(({ key, label, rowIndex }) => {
        const y = GRID_TOP + rowIndex * ROW_HEIGHT;
        return (
          <g key={key}>
            {rowIndex > 0 && (
              <line
                x1={GRID_LEFT} y1={y} x2={GRID_RIGHT} y2={y}
                style={{ stroke: 'var(--color-line)' }} strokeWidth={0.75}
              />
            )}
            <text
              x={GRID_LEFT - 8}
              y={y + ROW_HEIGHT / 2 + 4}
              textAnchor="end"
              fontSize={13}
              fill="currentColor"
            >
              {label}
            </text>
          </g>
        );
      })}

      <text
        x={TOTALS_X + 30}
        y={GRID_TOP - 8}
        textAnchor="middle"
        fontSize={11}
        style={{ fill: 'var(--color-muted)' }}
      >
        total h
      </text>
    </g>
  );
}

function DutyStatusLines({ segments }: { segments: LogSegment[] }): React.JSX.Element {
  const lines: React.JSX.Element[] = [];

  segments.forEach((seg, i) => {
    const x1 = timeToX(seg.startTime);
    const x2 = timeToX(seg.endTime);
    const rowIdx = STATUS_ROW_INDEX[seg.status];
    const y = rowCenterY(rowIdx);

    lines.push(
      <line
        key={`h-${i}`}
        x1={x1} y1={y} x2={x2} y2={y}
        stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      />
    );

    if (i > 0) {
      const prevSeg = segments[i - 1];
      const prevRowIdx = STATUS_ROW_INDEX[prevSeg.status];
      if (prevRowIdx !== rowIdx) {
        const prevY = rowCenterY(prevRowIdx);
        lines.push(
          <line
            key={`v-${i}`}
            x1={x1} y1={prevY} x2={x1} y2={y}
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
          />
        );
      }
    }
  });

  return <g>{lines}</g>;
}

function TotalHoursColumn({
  totals,
  gridBottom,
}: {
  totals: Record<DutyStatus, number>;
  gridBottom: number;
}): React.JSX.Element {
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <g>
      <line
        x1={GRID_RIGHT} y1={GRID_TOP} x2={GRID_RIGHT} y2={gridBottom}
        stroke="currentColor" strokeWidth={1.5}
      />

      {DUTY_STATUS_CONFIG.map(({ key, rowIndex }) => (
        <text
          key={key}
          x={TOTALS_X + 30}
          y={rowCenterY(rowIndex) + 4}
          textAnchor="middle"
          fontSize={15}
          fontWeight="bold"
          fill="currentColor"
        >
          {formatTotalHours(totals[key] || 0)}
        </text>
      ))}

      <line
        x1={TOTALS_X}
        y1={gridBottom + 2}
        x2={TOTALS_X + 60}
        y2={gridBottom + 2}
        stroke="currentColor"
        strokeWidth={1}
      />
      <text
        x={TOTALS_X + 30}
        y={gridBottom + 20}
        textAnchor="middle"
        fontSize={15}
        fontWeight="bold"
        fill="currentColor"
      >
        {formatTotalHours(grandTotal)}
      </text>
    </g>
  );
}
