import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useTripContext } from '../context/trip-context';
import { planTrip } from '../api';
import { LocationInput } from './location-input';
import type { TripInput } from '../types';

const locationField = z.string().min(3, 'Location must be at least 3 characters');

const tripSchema = z.object({
  currentLocation: locationField,
  pickupLocation: locationField,
  dropoffLocation: locationField,
  currentCycleUsed: z.number().min(0, 'Must be at least 0').max(70, 'Must be at most 70'),
  startTime: z.string(),
}).refine(
  (d) => d.pickupLocation.trim().toLowerCase() !== d.dropoffLocation.trim().toLowerCase(),
  { message: 'Dropoff must be different from pickup', path: ['dropoffLocation'] },
);

type FieldErrors = Partial<Record<keyof TripInput, string>>;
type TouchedFields = Partial<Record<keyof TripInput, boolean>>;

function validateForm(form: TripInput): { errors: FieldErrors; warnings: FieldErrors } {
  const warnings: FieldErrors = {};

  if (form.currentCycleUsed > 60) {
    warnings.currentCycleUsed = 'Limited driving time available';
  }
  if (
    form.currentLocation.length >= 3 &&
    form.pickupLocation.length >= 3 &&
    form.currentLocation.trim().toLowerCase() === form.pickupLocation.trim().toLowerCase()
  ) {
    warnings.pickupLocation = 'Same as current location';
  }

  const result = tripSchema.safeParse(form);
  if (result.success) return { errors: {}, warnings };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof TripInput;
    if (!errors[field]) errors[field] = issue.message;
  }
  return { errors, warnings };
}

export function TripForm(): React.JSX.Element {
  const { state, dispatch } = useTripContext();
  const [form, setForm] = useState<TripInput>({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleUsed: 0,
    startTime: getDefaultStartTime(),
  });
  const [touched, setTouched] = useState<TouchedFields>({});

  const { errors, warnings } = useMemo(() => validateForm(form), [form]);

  const isFormComplete =
    form.currentLocation.length >= 3 &&
    form.pickupLocation.length >= 3 &&
    form.dropoffLocation.length >= 3 &&
    Object.keys(errors).length === 0;

  function updateField(field: keyof TripInput, value: string | number): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: keyof TripInput): void {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function getFieldError(field: keyof TripInput): string | undefined {
    if (!touched[field]) return undefined;
    if (errors[field]) return errors[field];
    if ((field === 'currentLocation' || field === 'pickupLocation' || field === 'dropoffLocation') &&
        form[field].length === 0) {
      return 'Required';
    }
    return undefined;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!isFormComplete) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_INPUT', payload: form });

    try {
      const result = await planTrip(form);
      dispatch({ type: 'SET_RESULT', payload: result });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'An error occurred',
      });
    }
  }

  function handleCycleChange(value: number): void {
    const clamped = Math.min(70, Math.max(0, Math.round(value * 2) / 2));
    updateField('currentCycleUsed', clamped);
  }

  const cyclePercent = (form.currentCycleUsed / 70) * 100;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Trip Details</h2>

      <div className="space-y-4">
        <LocationInput
          label="Current Location"
          placeholder="e.g. San Francisco, CA"
          value={form.currentLocation}
          onChange={(v) => updateField('currentLocation', v)}
          error={getFieldError('currentLocation')}
          onBlur={() => markTouched('currentLocation')}
        />
        <LocationInput
          label="Pickup Location"
          placeholder="e.g. Sacramento, CA"
          value={form.pickupLocation}
          onChange={(v) => updateField('pickupLocation', v)}
          error={getFieldError('pickupLocation')}
          onBlur={() => markTouched('pickupLocation')}
        />
        {warnings.pickupLocation && !getFieldError('pickupLocation') && (
          <p className="text-xs text-amber-600 -mt-3">{warnings.pickupLocation}</p>
        )}
        <LocationInput
          label="Dropoff Location"
          placeholder="e.g. New York, NY"
          value={form.dropoffLocation}
          onChange={(v) => updateField('dropoffLocation', v)}
          error={getFieldError('dropoffLocation')}
          onBlur={() => markTouched('dropoffLocation')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Cycle Used
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={70}
                step={0.5}
                value={form.currentCycleUsed}
                onChange={(e) => handleCycleChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                style={{
                  background: `linear-gradient(to right, #22c55e ${Math.min(cyclePercent, 85.7)}%, #eab308 ${Math.min(cyclePercent, 85.7)}%, #eab308 ${Math.min(cyclePercent, 100)}%, #ef4444 ${cyclePercent}%, #e5e7eb ${cyclePercent}%)`,
                }}
              />
            </div>
            <input
              type="number"
              min={0}
              max={70}
              step={0.5}
              value={form.currentCycleUsed}
              onChange={(e) => handleCycleChange(parseFloat(e.target.value) || 0)}
              onBlur={() => markTouched('currentCycleUsed')}
              className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
            />
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-500">
              {form.currentCycleUsed} of 70 hours used
            </p>
            {getFieldError('currentCycleUsed') && (
              <p className="text-xs text-red-600">{getFieldError('currentCycleUsed')}</p>
            )}
          </div>
          {warnings.currentCycleUsed && !getFieldError('currentCycleUsed') && (
            <p className="mt-1 text-xs text-amber-600">{warnings.currentCycleUsed}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Time
          </label>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={state.loading || !isFormComplete}
        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {state.loading ? 'Planning Trip...' : 'Plan Trip'}
      </button>

      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {state.error}
        </div>
      )}
    </form>
  );
}

function getDefaultStartTime(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString().slice(0, 16);
}
