export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';

export interface TripInput {
  currentLocation: string;
  pickupLocation: string;
  dropoffLocation: string;
  currentCycleUsed: number;
  startTime: string;
}

export interface Location {
  lat: number;
  lng: number;
  name: string;
}

export interface Stop {
  type: 'pickup' | 'dropoff' | 'rest_break' | 'ten_hr_rest' | 'fuel';
  location: Location;
  arrivalTime: string;
  departureTime: string;
  durationHours: number;
}

export interface LogSegment {
  status: DutyStatus;
  startTime: number;
  endTime: number;
  remark?: string;
}

export interface DailyLog {
  date: string;
  dayNumber: number;
  fromLocation: string;
  toLocation: string;
  totalMiles: number;
  segments: LogSegment[];
  totals: Record<DutyStatus, number>;
  recap: {
    cycleHoursUsed: number;
    cycleHoursAvailable: number;
  };
  remarks: string[];
}

export interface RouteData {
  totalDistanceMiles: number;
  totalDurationHours: number;
  polyline: [number, number][];
}

export interface TripResult {
  route: RouteData;
  stops: Stop[];
  dailyLogs: DailyLog[];
}

export interface LocationSuggestion {
  name: string;
  lat: number;
  lng: number;
}
