import { TripProvider } from './context/trip-context';
import { useTripContext } from './context/use-trip-context';
import { TripForm } from './components/form/trip-form';
import { TripResults } from './components/results/trip-results';
import { LoadingSkeleton } from './components/loading-skeleton';

function AppContent(): React.JSX.Element {
  const { state } = useTripContext();
  const hasResults = state.result && !state.loading;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <header className="bg-[var(--color-surface-dark)] border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.072-.504.914-1.108a20.467 20.467 0 0 0-1.578-4.08l-1.264-2.212A2.25 2.25 0 0 0 17.37 9.75H14.25m-5.25 9V6.75a2.25 2.25 0 0 1 2.25-2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-.345.258" />
              </svg>
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-lg font-semibold text-white tracking-tight leading-tight">
                ELD Trip Planner
              </h1>
              <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">
                FMCSA HOS Compliant
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            System Online
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-6">
        {hasResults ? (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
            <div className="lg:sticky lg:top-6">
              <TripForm />
            </div>
            <div className="animate-fade-in-up">
              <TripResults result={state.result!} />
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto pt-8">
            <div className="text-center mb-8">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)] tracking-tight">
                Plan Your Route
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                Enter your trip details for HOS-compliant routing with automatic rest stops.
              </p>
            </div>
            <TripForm />
          </div>
        )}

        {state.loading && (
          <div className="mt-8">
            <LoadingSkeleton />
          </div>
        )}
      </main>
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <TripProvider>
      <AppContent />
    </TripProvider>
  );
}
