import { describe, it, expect } from 'vitest';
import { formatHours, stopTypeName } from '../lib/format';

describe('formatHours', () => {
  it('formats whole hours', () => {
    expect(formatHours(5)).toBe('5h');
  });

  it('formats zero', () => {
    expect(formatHours(0)).toBe('0h');
  });

  it('formats fractional hours', () => {
    expect(formatHours(2.5)).toBe('2h 30m');
  });

  it('formats small fractions', () => {
    expect(formatHours(0.25)).toBe('0h 15m');
  });

  it('formats large values', () => {
    expect(formatHours(70)).toBe('70h');
  });

  it('rounds minutes', () => {
    expect(formatHours(1.33)).toBe('1h 20m');
  });
});

describe('stopTypeName', () => {
  it('returns known stop type names', () => {
    expect(stopTypeName('pickup')).toBe('Pickup');
    expect(stopTypeName('dropoff')).toBe('Dropoff');
    expect(stopTypeName('rest_break')).toBe('30-Min Break');
    expect(stopTypeName('ten_hr_rest')).toBe('10-Hour Rest');
    expect(stopTypeName('fuel')).toBe('Fuel Stop');
  });

  it('returns the type string for unknown types', () => {
    expect(stopTypeName('custom_stop')).toBe('custom_stop');
  });
});
