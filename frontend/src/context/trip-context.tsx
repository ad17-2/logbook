import { useReducer } from 'react';
import type { ReactNode } from 'react';
import { TripContext } from './trip-context-value';
import type { AppState, Action } from './trip-context-value';

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

export function TripProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <TripContext.Provider value={{ state, dispatch }}>
      {children}
    </TripContext.Provider>
  );
}
