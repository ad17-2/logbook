import { useTripContext } from '../../context/use-trip-context';
import { currentHourLocal } from '../../lib/format';

const EXAMPLE_ROUTE = {
  currentLocation: 'San Francisco, CA',
  pickupLocation: 'Sacramento, CA',
  dropoffLocation: 'New York, NY',
  currentCycleUsed: 10,
};

export function TripIntro(): React.JSX.Element {
  const { dispatch } = useTripContext();

  return (
    <div className="border border-[var(--color-fg)] p-6 text-sm text-[var(--color-muted)] space-y-4">
      <p>enter a route and cycle hours used. logbook plans stops under FMCSA hos rules.</p>
      <p>it draws the daily log sheets for the trip.</p>
      <button
        type="button"
        onClick={() => dispatch({ type: 'REQUEST_EXAMPLE', payload: { ...EXAMPLE_ROUTE, startTime: currentHourLocal() } })}
        className="px-3 py-2 text-xs border border-[var(--color-fg)] text-[var(--color-fg)]"
      >
        &gt; load example
      </button>
    </div>
  );
}
