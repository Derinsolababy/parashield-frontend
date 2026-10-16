'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  onSearch:   (query: string) => void;
  placeholder?: string;
  className?:   string;
  /** Delay before `onSearch` fires after the user stops typing. */
  debounceMs?:  number;
  /** Accessible name for the input (placeholder text is not a label). */
  label?:       string;
  /** id of the element whose contents this search filters (aria-controls). */
  resultsId?:   string;
  /**
   * Number of results currently shown. When provided, changes are announced
   * to screen readers via a polite live region while a query is active.
   */
  resultCount?: number;
}

export function SearchBar({
  onSearch,
  placeholder = 'Search…',
  className,
  debounceMs = 250,
  label = 'Search',
  resultsId,
  resultCount,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery   = useDebounce(query, debounceMs);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/') {
      setQuery('');
      onSearch('');
    }
  }, [pathname, onSearch]);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    // #716: this is a live filter over the page's results (not an autocomplete
    // popup), so it uses the search-landmark + labelled input + live-region
    // pattern rather than combobox/listbox. Options may not contain
    // interactive content, and the filtered product cards have buttons/links.
    <div role="search" className={`relative ${className ?? ''}`}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-controls={resultsId}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-gray-400 focus:border-teal-500 focus:outline-none"
      />
      {query && (
        <button
          onClick={() => {
            // Clearing is a deliberate action, so reset the results immediately.
            setQuery('');
            onSearch('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          aria-label="Clear search"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {resultCount !== undefined && (
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {debouncedQuery.trim()
            ? `${resultCount} ${resultCount === 1 ? 'result' : 'results'} for "${debouncedQuery.trim()}"`
            : ''}
        </p>
      )}
    </div>
  );
}
