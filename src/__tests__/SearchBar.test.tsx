import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SearchBar } from '../components/SearchBar';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<SearchBar onSearch={onSearch} />);
    expect(html).toContain('placeholder="Search…"');
  });

  it('renders with custom placeholder', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<SearchBar onSearch={onSearch} placeholder="Find policies" />);
    expect(html).toContain('placeholder="Find policies"');
  });

  it('applies custom className', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<SearchBar onSearch={onSearch} className="my-class" />);
    expect(html).toContain('my-class');
  });

  it('renders search input element', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<SearchBar onSearch={onSearch} />);
    expect(html).toContain('<input');
    expect(html).toContain('type="text"');
  });

  it('renders the lucide Search icon instead of an emoji (#651)', () => {
    const html = renderToStaticMarkup(<SearchBar onSearch={vi.fn()} />);
    expect(html).toContain('lucide-search');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('🔍');
  });

  it('does not render clear button when query is empty', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<SearchBar onSearch={onSearch} />);
    expect(html).not.toContain('Clear search');
  });
});

describe('SearchBar debouncing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onSearch once with the final query after typing stops', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('textbox');
    onSearch.mockClear(); // ignore the initial empty-query call on mount

    for (const value of ['f', 'fl', 'flo', 'floo', 'flood']) {
      fireEvent.change(input, { target: { value } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('flood');
  });

  it('respects a custom debounceMs', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} debounceMs={500} />);
    onSearch.mockClear();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'crop' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onSearch).toHaveBeenCalledWith('crop');
  });

  it('clears results immediately when the clear button is pressed', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rain' } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    onSearch.mockClear();

    const clear = screen.getByLabelText('Clear search');
    expect(clear.querySelector('svg.lucide-x')).not.toBeNull();
    expect(clear.textContent).not.toContain('✕');

    fireEvent.click(clear);
    expect(onSearch).toHaveBeenCalledWith('');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });
});

describe('SearchBar accessibility (#716)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a search landmark and a labelled input', () => {
    render(<SearchBar onSearch={vi.fn()} label="Search insurance products" />);
    expect(screen.getByRole('search')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Search insurance products' })).toBeTruthy();
  });

  it('falls back to a default accessible name', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeTruthy();
  });

  it('points aria-controls at the results region', () => {
    render(<SearchBar onSearch={vi.fn()} resultsId="product-results" />);
    expect(screen.getByRole('textbox').getAttribute('aria-controls')).toBe('product-results');
  });

  it('announces the result count politely once the query settles', () => {
    vi.useFakeTimers();
    const { rerender } = render(<SearchBar onSearch={vi.fn()} resultCount={4} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'crop' } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    rerender(<SearchBar onSearch={vi.fn()} resultCount={1} />);
    expect(status.textContent).toBe('1 result for "crop"');

    rerender(<SearchBar onSearch={vi.fn()} resultCount={0} />);
    expect(status.textContent).toBe('0 results for "crop"');
  });

  it('renders no live region when resultCount is not provided', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
