import { useContext } from 'react';
import { TripContext } from './trip-context-value';
import type { TripContextValue } from './trip-context-value';

export function useTripContext(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}
