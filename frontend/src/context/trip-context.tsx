import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { TripInput, TripResult } from '../types';

interface AppState {
  input: TripInput;
  loading: boolean;
  result: TripResult | null;
  error: string | null;
}

type Action =
  | { type: 'SET_INPUT'; payload: TripInput }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESULT'; payload: TripResult }
  | { type: 'SET_ERROR'; payload: string };

const initialState: AppState = {
  input: {
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleUsed: 0,
    startTime: '',
  },
  loading: false,
  result: null,
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null };
    case 'SET_RESULT':
      return { ...state, result: action.payload, loading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
  }
}

const TripContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function TripProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <TripContext.Provider value={{ state, dispatch }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext(): { state: AppState; dispatch: React.Dispatch<Action> } {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}
