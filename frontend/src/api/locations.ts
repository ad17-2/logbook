import type { LocationSuggestion } from '../types';
import { apiFetch } from './client';
import { locationSearchResultSchema } from './schemas';

export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  try {
    const data = await apiFetch<unknown>(
      `/api/locations/search/?q=${encodeURIComponent(query)}`,
    );
    return locationSearchResultSchema.parse(data);
  } catch {
    return [];
  }
}
