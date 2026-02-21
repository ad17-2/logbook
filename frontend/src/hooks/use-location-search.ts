import { useState, useEffect } from 'react';
import { useDebounce } from './use-debounce';
import { searchLocations } from '../api/locations';
import type { LocationSuggestion } from '../types';

interface LocationSearchResult {
  suggestions: LocationSuggestion[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

export function useLocationSearch(query: string): LocationSearchResult {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [fetchedQuery, setFetchedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const shouldSearch = debouncedQuery.length >= 3;

  useEffect(() => {
    if (!shouldSearch) return;

    let cancelled = false;

    searchLocations(debouncedQuery).then((results) => {
      if (cancelled) return;
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setFetchedQuery(debouncedQuery);
      setActiveIndex(-1);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, shouldSearch]);

  return {
    suggestions: shouldSearch ? suggestions : [],
    isLoading: shouldSearch && fetchedQuery !== debouncedQuery,
    isOpen: shouldSearch && isOpen,
    setIsOpen,
    activeIndex: shouldSearch ? activeIndex : -1,
    setActiveIndex,
  };
}
