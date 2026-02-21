import { useEffect, type RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<Element | null>,
  callback: () => void,
): void {
  useEffect(() => {
    function handleMouseDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, callback]);
}
