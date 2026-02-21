import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tripPlanResponseSchema, locationSearchResultSchema } from '../api/schemas';
import { ApiError, apiFetch } from '../api/client';

describe('tripPlanResponseSchema', () => {
  const validResponse = {
    route: {
      total_distance_miles: 1234.5,
      total_duration_hours: 18.3,
      polyline: [[37.7749, -122.4194], [40.7128, -74.006]],
    },
    stops: [
      {
        type: 'pickup',
        location: { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
        arrival_time: '2024-01-01T08:00:00Z',
        departure_time: '2024-01-01T09:00:00Z',
        duration_hours: 1,
      },
    ],
    daily_logs: [
      {
        date: '2024-01-01',
        day_number: 1,
        from_location: 'San Francisco',
        to_location: 'Sacramento',
        total_miles: 90,
        segments: [
          { status: 'driving', start_time: 8, end_time: 10, remark: 'Driving to pickup' },
        ],
        totals: { driving: 2, off_duty: 14, sleeper_berth: 8, on_duty_not_driving: 0 },
        recap: { cycle_hours_used: 20, cycle_hours_available: 50 },
        remarks: ['Started trip'],
      },
    ],
  };

  it('parses a valid response and transforms to camelCase', () => {
    const result = tripPlanResponseSchema.parse(validResponse);

    expect(result.route.totalDistanceMiles).toBe(1234.5);
    expect(result.route.totalDurationHours).toBe(18.3);
    expect(result.stops[0].arrivalTime).toBe('2024-01-01T08:00:00Z');
    expect(result.stops[0].departureTime).toBe('2024-01-01T09:00:00Z');
    expect(result.stops[0].durationHours).toBe(1);
    expect(result.dailyLogs[0].dayNumber).toBe(1);
    expect(result.dailyLogs[0].fromLocation).toBe('San Francisco');
    expect(result.dailyLogs[0].totalMiles).toBe(90);
    expect(result.dailyLogs[0].segments[0].startTime).toBe(8);
    expect(result.dailyLogs[0].recap.cycleHoursUsed).toBe(20);
    expect(result.dailyLogs[0].recap.cycleHoursAvailable).toBe(50);
  });

  it('rejects response with missing route', () => {
    expect(() => tripPlanResponseSchema.parse({ stops: [], daily_logs: [] })).toThrow();
  });

  it('rejects response with invalid polyline', () => {
    const invalid = {
      ...validResponse,
      route: { ...validResponse.route, polyline: [[1, 2, 3]] },
    };
    expect(() => tripPlanResponseSchema.parse(invalid)).toThrow();
  });

  it('rejects response with missing stop fields', () => {
    const invalid = {
      ...validResponse,
      stops: [{ type: 'pickup' }],
    };
    expect(() => tripPlanResponseSchema.parse(invalid)).toThrow();
  });
});

describe('locationSearchResultSchema', () => {
  it('parses valid location results', () => {
    const data = [
      { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
      { name: 'San Jose, CA', lat: 37.3382, lng: -121.8863 },
    ];
    const result = locationSearchResultSchema.parse(data);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('San Francisco, CA');
  });

  it('parses empty array', () => {
    expect(locationSearchResultSchema.parse([])).toEqual([]);
  });

  it('rejects items missing required fields', () => {
    expect(() => locationSearchResultSchema.parse([{ name: 'Test' }])).toThrow();
  });
});

describe('ApiError', () => {
  it('joins error messages', () => {
    const err = new ApiError(
      [
        { field: 'pickup', message: 'Required' },
        { field: 'dropoff', message: 'Too short' },
      ],
      422,
    );
    expect(err.message).toBe('Required; Too short');
    expect(err.statusCode).toBe(422);
    expect(err.errors).toHaveLength(2);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      }),
    );

    const result = await apiFetch<{ data: string }>('/api/test');
    expect(result).toEqual({ data: 'test' });
  });

  it('throws ApiError with structured errors from backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            errors: [{ field: 'name', message: 'Too short' }],
            status_code: 422,
          }),
      }),
    );

    await expect(apiFetch('/api/test')).rejects.toThrow(ApiError);
    try {
      await apiFetch('/api/test');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.errors[0].field).toBe('name');
      expect(apiErr.statusCode).toBe(422);
    }
  });

  it('falls back to detail/message on non-structured errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Internal error' }),
      }),
    );

    await expect(apiFetch('/api/test')).rejects.toThrow('Internal error');
  });

  it('handles unparseable error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not json')),
      }),
    );

    await expect(apiFetch('/api/test')).rejects.toThrow('HTTP 502');
  });
});
