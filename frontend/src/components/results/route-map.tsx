import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TripResult } from '../../types';
import { formatTime, stopTypeName } from '../../lib/format';
import { STOP_SHAPES } from '../../lib/constants';

const SHAPE_MARKUP: Record<string, string> = {
  square: '<rect x="6" y="6" width="12" height="12"/>',
  diamond: '<path d="M12 2 L22 12 L12 22 L2 12 Z"/>',
  'circle-filled': '<circle cx="12" cy="12" r="8"/>',
  'circle-hollow': '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="3"/>',
  triangle: '<path d="M12 4 L21 20 L3 20 Z"/>',
};

function shapeSvg(shape: string): string {
  const markup = SHAPE_MARKUP[shape] ?? SHAPE_MARKUP['circle-filled'];
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">${markup}</svg>`;
}

function createStopIcon(type: string): L.DivIcon {
  const shape = STOP_SHAPES[type] ?? 'circle-filled';
  const borderRadius = shape === 'square' || shape === 'diamond' || shape === 'triangle' ? '0' : '50%';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:var(--color-bg);
      color:var(--color-fg);
      border:1.5px solid var(--color-fg);
      border-radius:${borderRadius};
      width:24px;
      height:24px;
      display:flex;
      align-items:center;
      justify-content:center;
    ">${shapeSvg(shape)}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitBounds({ polyline }: { polyline: [number, number][] }): null {
  const map = useMap();

  useEffect(() => {
    if (polyline.length > 0) {
      const bounds = L.latLngBounds(polyline.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, polyline]);

  return null;
}

export function RouteMap({ result }: { result: TripResult }): React.JSX.Element {
  const center: [number, number] = result.route.polyline.length > 0
    ? result.route.polyline[Math.floor(result.route.polyline.length / 2)]
    : [39.8, -98.5];

  return (
    <div className="border border-[var(--color-fg)]">
      <div className="px-5 py-3 border-b border-[var(--color-fg)] flex items-center justify-between gap-3">
        <h2 className="text-sm text-[var(--color-fg)] whitespace-nowrap">route map</h2>
        <p className="text-xs text-[var(--color-muted)] tabular-nums text-right">
          {result.route.totalDistanceMiles.toLocaleString()} mi
          <span className="mx-1.5">·</span>
          {Math.round(result.route.totalDurationHours)}h drive
          <span className="mx-1.5">·</span>
          {result.stops.length} stops
        </p>
      </div>

      <MapContainer center={center} zoom={5} className="h-[450px] w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={result.route.polyline} className="route-line" weight={3} opacity={0.9} />
        <FitBounds polyline={result.route.polyline} />

        {result.stops.map((stop, i) => (
          <Marker
            key={i}
            position={[stop.location.lat, stop.location.lng]}
            icon={createStopIcon(stop.type)}
          >
            <Popup>
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-sm">{stopTypeName(stop.type)}</p>
                <p className="mt-0.5">{stop.location.name}</p>
                <p className="mt-1">
                  {formatTime(stop.arrivalTime)} — {formatTime(stop.departureTime)}
                </p>
                <p>{stop.durationHours}h</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--color-fg)]">
        {Object.entries(STOP_SHAPES).map(([type, shape]) => (
          <span key={type} className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <span
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: shapeSvg(shape) }}
              className="w-3 h-3 shrink-0 text-[var(--color-fg)] [&>svg]:w-full [&>svg]:h-full"
            />
            {stopTypeName(type).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
