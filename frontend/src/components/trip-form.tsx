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

const PIN_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);

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
  const hoursRemaining = 70 - form.currentCycleUsed;

  const trackGradient = cyclePercent <= 85.7
    ? `linear-gradient(to right, #2d9d78 0%, #2d9d78 ${cyclePercent}%, var(--color-surface-sunken) ${cyclePercent}%)`
    : `linear-gradient(to right, #2d9d78 0%, #d4930d 85.7%, #d94f4f ${cyclePercent}%, var(--color-surface-sunken) ${cyclePercent}%)`;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] overflow-hidden"
    >
      {/* Route Section */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0-3-3m3 3 3-3m-3 3V6.75M15 18.75V9m0 0 3 3m-3-3-3 3" />
          </svg>
          <h2 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
            Route
          </h2>
        </div>

        <div className="relative pl-6">
          {/* Vertical connector line */}
          <div className="absolute left-[7px] top-5 bottom-5 w-px border-l border-dashed border-[var(--color-border)]" />

          <div className="space-y-3">
            <div className="relative">
              <div className="absolute -left-6 top-7 w-3 h-3 rounded-full border-2 border-[var(--color-text-tertiary)] bg-[var(--color-surface-raised)] z-10" />
              <LocationInput
                label="Current Location"
                placeholder="e.g. San Francisco, CA"
                value={form.currentLocation}
                onChange={(v) => updateField('currentLocation', v)}
                error={getFieldError('currentLocation')}
                onBlur={() => markTouched('currentLocation')}
                icon={PIN_ICON}
              />
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-7 w-3 h-3 rounded-full border-2 border-[var(--color-success)] bg-[var(--color-success-soft)] z-10" />
              <LocationInput
                label="Pickup Location"
                placeholder="e.g. Sacramento, CA"
                value={form.pickupLocation}
                onChange={(v) => updateField('pickupLocation', v)}
                error={getFieldError('pickupLocation')}
                onBlur={() => markTouched('pickupLocation')}
                icon={PIN_ICON}
              />
              {warnings.pickupLocation && !getFieldError('pickupLocation') && (
                <p className="mt-1 text-xs text-[var(--color-warning)] flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {warnings.pickupLocation}
                </p>
              )}
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-7 w-3 h-3 rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)] z-10" />
              <LocationInput
                label="Dropoff Location"
                placeholder="e.g. New York, NY"
                value={form.dropoffLocation}
                onChange={(v) => updateField('dropoffLocation', v)}
                error={getFieldError('dropoffLocation')}
                onBlur={() => markTouched('dropoffLocation')}
                icon={PIN_ICON}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--color-border)]" />

      {/* HOS Section */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h2 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
            Hours of Service
          </h2>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              Current Cycle Used
            </label>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              <span className={`font-semibold ${hoursRemaining <= 10 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {hoursRemaining}h
              </span>
              {' '}remaining
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={70}
                step={0.5}
                value={form.currentCycleUsed}
                onChange={(e) => handleCycleChange(parseFloat(e.target.value))}
                className="w-full"
                style={{ background: trackGradient }}
              />
            </div>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={70}
                step={0.5}
                value={form.currentCycleUsed}
                onChange={(e) => handleCycleChange(parseFloat(e.target.value) || 0)}
                onBlur={() => markTouched('currentCycleUsed')}
                className="w-[72px] px-2 py-1.5 text-sm font-medium text-center bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-text-tertiary)] pointer-events-none">h</span>
            </div>
          </div>

          {getFieldError('currentCycleUsed') && (
            <p className="mt-1.5 text-xs text-[var(--color-danger)]">{getFieldError('currentCycleUsed')}</p>
          )}
          {warnings.currentCycleUsed && !getFieldError('currentCycleUsed') && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20">
              <svg className="w-3.5 h-3.5 text-[var(--color-warning)] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-[var(--color-warning)]">{warnings.currentCycleUsed}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
            Start Time
          </label>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="p-5 pt-0">
        <button
          type="submit"
          disabled={state.loading || !isFormComplete}
          className="w-full py-3 px-4 rounded-lg font-[var(--font-display)] font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-150 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {state.loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Planning Route...
            </>
          ) : (
            <>
              Plan Trip
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>

      {state.error && (
        <div className="mx-5 mb-5 p-3 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 flex items-start gap-2">
          <svg className="w-4 h-4 text-[var(--color-danger)] mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
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
