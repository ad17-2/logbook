import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useTripContext } from '../../context/use-trip-context';
import { planTrip } from '../../api/trips';
import { ApiError } from '../../api/client';
import { LocationInput } from './location-input';
import type { TripInput } from '../../types';
import { currentHourLocal } from '../../lib/format';

const locationField = z.string().min(3, 'location must be at least 3 characters');

const tripSchema = z.object({
  currentLocation: locationField,
  pickupLocation: locationField,
  dropoffLocation: locationField,
  currentCycleUsed: z.number().min(0, 'must be at least 0').max(70, 'must be at most 70'),
  startTime: z.string(),
}).refine(
  (d) => d.pickupLocation.trim().toLowerCase() !== d.dropoffLocation.trim().toLowerCase(),
  { message: 'dropoff must be different from pickup', path: ['dropoffLocation'] },
);

type FieldErrors = Partial<Record<keyof TripInput, string>>;
type TouchedFields = Partial<Record<keyof TripInput, boolean>>;

function validateForm(form: TripInput): { errors: FieldErrors; warnings: FieldErrors } {
  const warnings: FieldErrors = {};

  if (form.currentCycleUsed > 60) {
    warnings.currentCycleUsed = 'limited driving time available';
  }
  if (
    form.currentLocation.length >= 3 &&
    form.pickupLocation.length >= 3 &&
    form.currentLocation.trim().toLowerCase() === form.pickupLocation.trim().toLowerCase()
  ) {
    warnings.pickupLocation = 'same as current location';
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

function buildAsciiBar(percent: number, slots = 20): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * slots);
  return `[${'█'.repeat(filled)}${'░'.repeat(slots - filled)}…]`;
}

export function TripForm(): React.JSX.Element {
  const { state, dispatch } = useTripContext();
  const [form, setForm] = useState<TripInput>({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleUsed: 0,
    startTime: currentHourLocal(),
  });
  const [touched, setTouched] = useState<TouchedFields>({});
  const [appliedExample, setAppliedExample] = useState(state.exampleInput);

  if (state.exampleInput !== appliedExample) {
    setAppliedExample(state.exampleInput);
    if (state.exampleInput) {
      setForm(state.exampleInput);
      setTouched({});
    }
  }

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
      return 'required';
    }
    return undefined;
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!isFormComplete) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_INPUT', payload: form });

    try {
      const result = await planTrip(form);
      dispatch({ type: 'SET_RESULT', payload: result });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldError = err.errors.find((e) => e.field !== '_root');
        dispatch({ type: 'SET_ERROR', payload: fieldError?.message ?? err.message });
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'an error occurred',
        });
      }
    }
  }

  function handleCycleChange(value: number): void {
    const clamped = Math.min(70, Math.max(0, Math.round(value * 2) / 2));
    updateField('currentCycleUsed', clamped);
  }

  const cyclePercent = (form.currentCycleUsed / 70) * 100;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-bg)] border border-[var(--color-fg)]"
    >
      <div className="px-5 py-3 border-b border-[var(--color-line)]">
        <p className="text-xs text-[var(--color-muted)]">$ plan --trip</p>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-3">
          <LocationInput
            label="01 current location"
            placeholder="e.g. san francisco, ca"
            value={form.currentLocation}
            onChange={(v) => updateField('currentLocation', v)}
            error={getFieldError('currentLocation')}
            onBlur={() => markTouched('currentLocation')}
          />

          <div>
            <LocationInput
              label="02 pickup"
              placeholder="e.g. sacramento, ca"
              value={form.pickupLocation}
              onChange={(v) => updateField('pickupLocation', v)}
              error={getFieldError('pickupLocation')}
              onBlur={() => markTouched('pickupLocation')}
            />
            {warnings.pickupLocation && !getFieldError('pickupLocation') && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">{warnings.pickupLocation}</p>
            )}
          </div>

          <LocationInput
            label="03 dropoff"
            placeholder="e.g. new york, ny"
            value={form.dropoffLocation}
            onChange={(v) => updateField('dropoffLocation', v)}
            error={getFieldError('dropoffLocation')}
            onBlur={() => markTouched('dropoffLocation')}
          />
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]" />

      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="cycle-used" className="text-xs text-[var(--color-muted)]">
              04 cycle used
            </label>
            <span className="text-xs tabular-nums text-[var(--color-muted)]">
              {form.currentCycleUsed} / 70 h
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="cycle-used"
              type="range"
              min={0}
              max={70}
              step={0.5}
              value={form.currentCycleUsed}
              onChange={(e) => handleCycleChange(parseFloat(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={70}
              step={0.5}
              value={form.currentCycleUsed}
              onChange={(e) => handleCycleChange(parseFloat(e.target.value) || 0)}
              onBlur={() => markTouched('currentCycleUsed')}
              aria-label="cycle used, hours"
              className="w-16 px-2 py-1 text-xs text-center tabular-nums bg-[var(--color-bg)] border border-[var(--color-line)] outline-none"
            />
          </div>
          <p aria-hidden="true" className="mt-1.5 text-xs tabular-nums text-[var(--color-muted)]">
            {buildAsciiBar(cyclePercent)}
          </p>

          {getFieldError('currentCycleUsed') && (
            <p className="mt-1.5 text-xs text-[var(--color-fg)]">{getFieldError('currentCycleUsed')}</p>
          )}
          {warnings.currentCycleUsed && !getFieldError('currentCycleUsed') && (
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">{warnings.currentCycleUsed}</p>
          )}
        </div>

        <div>
          <label htmlFor="start-time" className="block text-xs text-[var(--color-muted)] mb-1.5">
            05 start time
          </label>
          <input
            id="start-time"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-line)] outline-none"
          />
        </div>
      </div>

      <div className="p-5 pt-0">
        <button
          type="submit"
          disabled={state.loading || !isFormComplete}
          aria-busy={state.loading}
          className="w-full py-3 px-4 text-sm tracking-wide bg-[var(--color-fg)] text-[var(--color-bg)] disabled:bg-[var(--color-subtle)] disabled:text-[var(--color-muted)] disabled:cursor-not-allowed"
        >
          {state.loading ? '> planning…' : '> run plan'}
        </button>
      </div>

      {state.error && (
        <div role="alert" className="mx-5 mb-5 p-3 border border-dashed border-[var(--color-fg)]">
          <p className="text-sm text-[var(--color-fg)]">err: {state.error}</p>
        </div>
      )}
    </form>
  );
}
