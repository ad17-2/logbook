import { z } from 'zod';

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  name: z.string(),
});

const stopSchema = z
  .object({
    type: z.string(),
    location: locationSchema,
    arrival_time: z.string(),
    departure_time: z.string(),
    duration_hours: z.number(),
  })
  .transform((s) => ({
    type: s.type as 'pickup' | 'dropoff' | 'rest_break' | 'ten_hr_rest' | 'fuel',
    location: s.location,
    arrivalTime: s.arrival_time,
    departureTime: s.departure_time,
    durationHours: s.duration_hours,
  }));

const logSegmentSchema = z
  .object({
    status: z.string(),
    start_time: z.number(),
    end_time: z.number(),
    remark: z.string().optional().default(''),
  })
  .transform((seg) => ({
    status: seg.status as 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving',
    startTime: seg.start_time,
    endTime: seg.end_time,
    remark: seg.remark,
  }));

const dailyLogSchema = z
  .object({
    date: z.string(),
    day_number: z.number(),
    from_location: z.string(),
    to_location: z.string(),
    total_miles: z.number(),
    segments: z.array(logSegmentSchema),
    totals: z.record(z.string(), z.number()),
    recap: z.object({
      cycle_hours_used: z.number(),
      cycle_hours_available: z.number(),
    }),
    remarks: z.array(z.string()),
  })
  .transform((log) => ({
    date: log.date,
    dayNumber: log.day_number,
    fromLocation: log.from_location,
    toLocation: log.to_location,
    totalMiles: log.total_miles,
    segments: log.segments,
    totals: log.totals as Record<'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving', number>,
    recap: {
      cycleHoursUsed: log.recap.cycle_hours_used,
      cycleHoursAvailable: log.recap.cycle_hours_available,
    },
    remarks: log.remarks,
  }));

export const tripPlanResponseSchema = z
  .object({
    route: z.object({
      total_distance_miles: z.number(),
      total_duration_hours: z.number(),
      polyline: z.array(z.tuple([z.number(), z.number()])),
    }),
    stops: z.array(stopSchema),
    daily_logs: z.array(dailyLogSchema),
  })
  .transform((data) => ({
    route: {
      totalDistanceMiles: data.route.total_distance_miles,
      totalDurationHours: data.route.total_duration_hours,
      polyline: data.route.polyline,
    },
    stops: data.stops,
    dailyLogs: data.daily_logs,
  }));

export const locationSearchResultSchema = z.array(
  z.object({
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
);
