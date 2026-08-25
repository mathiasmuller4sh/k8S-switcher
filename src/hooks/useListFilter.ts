import { useState, useEffect, useRef } from 'react';

export function useListFilter() {
  const [filterText, setFilterText] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in another input/textarea or if a modifier is pressed
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.classList.contains('xterm-helper-textarea') ||
        e.ctrlKey || e.metaKey || e.altKey
      ) {
        return;
      }

      // If it's a printable character (length === 1)
      if (e.key.length === 1) {
        setIsFilterVisible(prev => {
          if (!prev) {
            setFilterText(e.key);
          }
          return true;
        });
        
        // We let the input focus itself in the next tick
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
      
      if (e.key === 'Escape') {
        setIsFilterVisible(false);
        setFilterText('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeFilter = () => {
    setIsFilterVisible(false);
    setFilterText('');
  };

  return { filterText, setFilterText, isFilterVisible, closeFilter, inputRef };
}
