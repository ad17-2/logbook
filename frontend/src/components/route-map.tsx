import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TripResult } from '../types';
import 'leaflet/dist/leaflet.css';

const STOP_COLORS: Record<string, string> = {
  pickup: '#16a34a',
  dropoff: '#16a34a',
  rest_break: '#f97316',
  ten_hr_rest: '#dc2626',
  fuel: '#2563eb',
};

const STOP_LABELS: Record<string, string> = {
  pickup: 'P',
  dropoff: 'D',
  rest_break: 'B',
  ten_hr_rest: 'R',
  fuel: 'F',
};

function createStopIcon(type: string): L.DivIcon {
  const color = STOP_COLORS[type] || '#6b7280';
  const label = STOP_LABELS[type] || '?';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      color:white;
      width:28px;
      height:28px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:bold;
      font-size:13px;
      border:2px solid white;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function stopTypeName(type: string): string {
  const names: Record<string, string> = {
    pickup: 'Pickup',
    dropoff: 'Dropoff',
    rest_break: '30-Min Break',
    ten_hr_rest: '10-Hour Rest',
    fuel: 'Fuel Stop',
  };
  return names[type] || type;
}

export function RouteMap({ result }: { result: TripResult }): React.JSX.Element {
  const center: [number, number] = result.route.polyline.length > 0
    ? result.route.polyline[Math.floor(result.route.polyline.length / 2)]
    : [39.8, -98.5];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Route Map</h2>
        <p className="text-sm text-gray-500 mt-1">
          {result.route.totalDistanceMiles.toLocaleString()} miles
          {' · '}
          {Math.round(result.route.totalDurationHours)} hrs driving time
          {' · '}
          {result.stops.length} stops
        </p>
      </div>
      <MapContainer center={center} zoom={5} className="h-[500px] w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={result.route.polyline} color="#3b82f6" weight={4} opacity={0.8} />
        <FitBounds polyline={result.route.polyline} />

        {result.stops.map((stop, i) => (
          <Marker
            key={i}
            position={[stop.location.lat, stop.location.lng]}
            icon={createStopIcon(stop.type)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{stopTypeName(stop.type)}</p>
                <p className="text-gray-600">{stop.location.name}</p>
                <p className="text-gray-500">
                  {formatTime(stop.arrivalTime)} — {formatTime(stop.departureTime)}
                </p>
                <p className="text-gray-500">{stop.durationHours}h</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="p-3 flex flex-wrap gap-4 text-xs text-gray-600 border-t border-gray-200">
        {Object.entries(STOP_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {stopTypeName(type)}
          </span>
        ))}
      </div>
    </div>
  );
}
