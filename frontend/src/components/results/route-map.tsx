import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TripResult } from '../../types';
import { formatTime, stopTypeName } from '../../lib/format';
import { STOP_COLORS, STOP_LABELS } from '../../lib/constants';
import 'leaflet/dist/leaflet.css';

function createStopIcon(type: string): L.DivIcon {
  const color = STOP_COLORS[type] || '#6b7280';
  const label = STOP_LABELS[type] || '?';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      color:white;
      width:26px;
      height:26px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:600;
      font-size:11px;
      font-family:'Outfit',system-ui,sans-serif;
      border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
    ">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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
    <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-6H5.625c-.621 0-1.125.504-1.125 1.125v5.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V9.875c0-.621-.504-1.125-1.125-1.125H15M9 3.75l3-1.5 3 1.5M9 3.75v3M15 3.75v3" />
          </svg>
          <h2 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-text)]">
            Route Map
          </h2>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {result.route.totalDistanceMiles.toLocaleString()} mi
          <span className="mx-1.5 text-[var(--color-border)]">|</span>
          {Math.round(result.route.totalDurationHours)}h drive
          <span className="mx-1.5 text-[var(--color-border)]">|</span>
          {result.stops.length} stops
        </p>
      </div>

      <MapContainer center={center} zoom={5} className="h-[450px] w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={result.route.polyline} color="#e07a2f" weight={3.5} opacity={0.85} />
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
                <p className="text-gray-600 mt-0.5">{stop.location.name}</p>
                <p className="text-gray-500 mt-1">
                  {formatTime(stop.arrivalTime)} — {formatTime(stop.departureTime)}
                </p>
                <p className="text-gray-500">{stop.durationHours}h</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--color-border)]">
        {Object.entries(STOP_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            {stopTypeName(type)}
          </span>
        ))}
      </div>
    </div>
  );
}
