import type { TripInput, TripResult, LocationSuggestion } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function planTrip(input: TripInput): Promise<TripResult> {
  const response = await fetch(`${API_BASE}/api/trip/plan/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_location: input.currentLocation,
      pickup_location: input.pickupLocation,
      dropoff_location: input.dropoffLocation,
      current_cycle_used: input.currentCycleUsed,
      start_time: input.startTime || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return transformResponse(data);
}

export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const response = await fetch(
    `${API_BASE}/api/locations/search/?q=${encodeURIComponent(query)}`,
  );

  if (!response.ok) {
    return [];
  }

  return response.json();
}

function transformResponse(data: Record<string, unknown>): TripResult {
  const raw = data as {
    route: { total_distance_miles: number; total_duration_hours: number; polyline: [number, number][] };
    stops: Array<{
      type: string; location: { lat: number; lng: number; name: string };
      arrival_time: string; departure_time: string; duration_hours: number;
    }>;
    daily_logs: Array<{
      date: string; day_number: number; from_location: string; to_location: string;
      total_miles: number; segments: Array<{ status: string; start_time: number; end_time: number; remark: string }>;
      totals: Record<string, number>; recap: { cycle_hours_used: number; cycle_hours_available: number };
      remarks: string[];
    }>;
  };

  return {
    route: {
      totalDistanceMiles: raw.route.total_distance_miles,
      totalDurationHours: raw.route.total_duration_hours,
      polyline: raw.route.polyline,
    },
    stops: raw.stops.map((s) => ({
      type: s.type as TripResult['stops'][0]['type'],
      location: s.location,
      arrivalTime: s.arrival_time,
      departureTime: s.departure_time,
      durationHours: s.duration_hours,
    })),
    dailyLogs: raw.daily_logs.map((log) => ({
      date: log.date,
      dayNumber: log.day_number,
      fromLocation: log.from_location,
      toLocation: log.to_location,
      totalMiles: log.total_miles,
      segments: log.segments.map((seg) => ({
        status: seg.status as TripResult['dailyLogs'][0]['segments'][0]['status'],
        startTime: seg.start_time,
        endTime: seg.end_time,
        remark: seg.remark,
      })),
      totals: log.totals as TripResult['dailyLogs'][0]['totals'],
      recap: {
        cycleHoursUsed: log.recap.cycle_hours_used,
        cycleHoursAvailable: log.recap.cycle_hours_available,
      },
      remarks: log.remarks,
    })),
  };
}
