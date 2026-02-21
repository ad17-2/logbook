import type { TripInput, TripResult } from '../types';
import { apiFetch } from './client';
import { tripPlanResponseSchema } from './schemas';

export async function planTrip(input: TripInput): Promise<TripResult> {
  const data = await apiFetch<unknown>('/api/trip/plan/', {
    method: 'POST',
    body: JSON.stringify({
      current_location: input.currentLocation,
      pickup_location: input.pickupLocation,
      dropoff_location: input.dropoffLocation,
      current_cycle_used: input.currentCycleUsed,
      start_time: input.startTime || undefined,
    }),
  });

  return tripPlanResponseSchema.parse(data);
}
