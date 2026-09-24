import { useRef, useCallback, useId, useState } from 'react';
import { useClickOutside } from '../../hooks/use-click-outside';
import { useLocationSearch } from '../../hooks/use-location-search';
import type { LocationSuggestion } from '../../types';

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: () => void;
}

export function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  onBlur,
}: LocationInputProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { suggestions, isLoading, isOpen, setIsOpen, activeIndex, setActiveIndex } =
    useLocationSearch(value);
  const showList = isOpen && focused && value !== selected && suggestions.length > 0;

  useClickOutside(containerRef, useCallback(() => setIsOpen(false), [setIsOpen]));

  function selectSuggestion(suggestion: LocationSuggestion): void {
    setSelected(suggestion.name);
    onChange(suggestion.name);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (!showList) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const borderClass = error ? 'border-dashed' : 'border-solid';

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="block text-xs text-[var(--color-muted)] mb-1.5">
        {label}
      </label>
      <div className={`flex items-center gap-2 bg-[var(--color-bg)] border ${borderClass} border-[var(--color-fg)] px-3 py-2`}>
        <input
          id={inputId}
          type="text"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            setIsOpen(false);
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
        />
        {isLoading && <span aria-hidden="true" className="shrink-0 text-xs text-[var(--color-muted)]">…</span>}
      </div>
      {error && <p className="mt-1.5 text-xs text-[var(--color-fg)]">err: {error}</p>}

      {showList && (
        <ul id={listId} role="listbox" className="absolute z-50 w-full mt-1.5 bg-[var(--color-bg)] border border-[var(--color-fg)] overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectSuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex
                  ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                  : 'text-[var(--color-fg)]'
              } ${i > 0 ? 'border-t border-[var(--color-line)]' : ''}`}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
