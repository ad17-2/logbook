import { createContext } from 'react';
import type { TripInput, TripResult } from '../types';

export interface AppState {
  input: TripInput;
  loading: boolean;
  result: TripResult | null;
  error: string | null;
}

export type Action =
  | { type: 'SET_INPUT'; payload: TripInput }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESULT'; payload: TripResult }
  | { type: 'SET_ERROR'; payload: string };

export interface TripContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export const TripContext = createContext<TripContextValue | null>(null);
