import { TripProvider } from './context/trip-context';
import { useTripContext } from './context/use-trip-context';
import { TripForm } from './components/form/trip-form';
import { TripResults } from './components/results/trip-results';
import { TripIntro } from './components/results/trip-intro';
import { LoadingSkeleton } from './components/loading-skeleton';

function AppContent(): React.JSX.Element {
  const { state } = useTripContext();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-fg)]">
        <div className="max-w-[1400px] mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true" className="text-[var(--color-fg)]">
              <rect width="32" height="32" fill="currentColor" />
              <path d="M5 22H11V10H19V16H27" fill="none" style={{ stroke: 'var(--color-bg)' }} strokeWidth="3" strokeLinecap="square" />
            </svg>
            <div>
              <h1 className="text-sm">logbook</h1>
              <p className="hidden sm:block text-xs text-[var(--color-muted)]">~/eld-trip-planner</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 sm:gap-4 text-xs whitespace-nowrap">
            <a href="https://github.com/ad17-2/logbook" target="_blank" rel="noopener noreferrer">
              [ github ]
            </a>
            <a href="https://aristifandi.io" target="_blank" rel="noopener noreferrer">
              [ aristifandi.io ]
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
          <div className="lg:sticky lg:top-6">
            <TripForm />
          </div>
          <div className="animate-fade-in-up">
            {state.loading ? (
              <LoadingSkeleton />
            ) : state.result ? (
              <TripResults result={state.result} />
            ) : (
              <TripIntro />
            )}
          </div>
        </div>
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
