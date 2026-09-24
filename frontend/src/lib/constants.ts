import type { DutyStatus } from '../types';

export const HOS_CYCLE_LIMIT = 70;

export const STOP_SHAPES: Record<string, 'square' | 'diamond' | 'circle-hollow' | 'circle-filled' | 'triangle'> = {
  pickup: 'square',
  dropoff: 'diamond',
  rest_break: 'circle-hollow',
  ten_hr_rest: 'circle-filled',
  fuel: 'triangle',
};

export const DUTY_STATUS_CONFIG: { key: DutyStatus; label: string; rowIndex: number }[] = [
  { key: 'off_duty', label: '1 off duty', rowIndex: 0 },
  { key: 'sleeper_berth', label: '2 sleeper', rowIndex: 1 },
  { key: 'driving', label: '3 driving', rowIndex: 2 },
  { key: 'on_duty_not_driving', label: '4 on duty', rowIndex: 3 },
];
