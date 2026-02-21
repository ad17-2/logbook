import { TripProvider, useTripContext } from './context/trip-context';
import { TripForm } from './components/trip-form';
import { TripResults } from './components/trip-results';

function AppContent(): React.JSX.Element {
  const { state } = useTripContext();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ELD Trip Planner</h1>
              <p className="text-xs text-gray-500">FMCSA HOS Compliant Route Planning</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className={state.result ? 'space-y-8' : 'max-w-lg mx-auto'}>
          <TripForm />

          {state.loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Calculating route & HOS compliance...</p>
              </div>
            </div>
          )}

          {state.result && !state.loading && (
            <TripResults result={state.result} />
          )}
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
