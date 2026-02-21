import type { DutyStatus } from '../types';

export const HOS_CYCLE_LIMIT = 70;

export const STOP_COLORS: Record<string, string> = {
  pickup: '#2d9d78',
  dropoff: '#e07a2f',
  rest_break: '#d4930d',
  ten_hr_rest: '#d94f4f',
  fuel: '#6366f1',
};

export const STOP_LABELS: Record<string, string> = {
  pickup: 'P',
  dropoff: 'D',
  rest_break: 'B',
  ten_hr_rest: 'R',
  fuel: 'F',
};

export const DUTY_STATUS_CONFIG: { key: DutyStatus; label: string; rowIndex: number }[] = [
  { key: 'off_duty', label: '1. Off Duty', rowIndex: 0 },
  { key: 'sleeper_berth', label: '2. Sleeper Berth', rowIndex: 1 },
  { key: 'driving', label: '3. Driving', rowIndex: 2 },
  { key: 'on_duty_not_driving', label: '4. On Duty (Not Driving)', rowIndex: 3 },
];
