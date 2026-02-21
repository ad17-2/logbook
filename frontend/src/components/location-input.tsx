import { useState, useRef, useEffect, useCallback } from 'react';
import { searchLocations } from '../api';
import type { LocationSuggestion } from '../types';

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: () => void;
  icon?: React.ReactNode;
}

export function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  onBlur,
  icon,
}: LocationInputProps): React.JSX.Element {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchLocations(query);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
      setActiveIndex(-1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(text: string): void {
    onChange(text);
    fetchSuggestions(text);
  }

  function selectSuggestion(suggestion: LocationSuggestion): void {
    onChange(suggestion.name);
    setIsOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const borderClass = error
    ? 'border-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/20'
    : 'border-[var(--color-border)] focus-within:border-[var(--color-border-focus)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/15';

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className={`flex items-center gap-2 bg-[var(--color-surface-raised)] rounded-lg border px-3 py-2.5 transition-all duration-150 ${borderClass}`}>
        {icon && (
          <span className="text-[var(--color-text-tertiary)] shrink-0">
            {icon}
          </span>
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]/60"
        />
        {isLoading && (
          <div className="shrink-0">
            <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full mt-1.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg shadow-lg shadow-black/8 overflow-hidden animate-fade-in-up"
          style={{ animationDuration: '0.15s' }}
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lng}`}
              onMouseDown={() => selectSuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors duration-75 ${
                i === activeIndex
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-accent)]'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]'
              } ${i > 0 ? 'border-t border-[var(--color-border-light)]' : ''}`}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span className="leading-snug">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
