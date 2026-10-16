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

describe('SearchBar input responsiveness (#666)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reflects every keystroke in the input immediately, before the debounce fires', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} debounceMs={1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    onSearch.mockClear();

    for (const value of ['d', 'dr', 'dro', 'drou', 'drought']) {
      fireEvent.change(input, { target: { value } });
      // No timers advanced: the field must already show the typed value.
      expect(input.value).toBe(value);
    }
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('handles a burst of keystrokes quickly', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    const start = performance.now();
    let value = '';
    for (let i = 0; i < 200; i++) {
      value += 'a';
      fireEvent.change(input, { target: { value } });
    }
    const elapsed = performance.now() - start;

    expect(input.value).toHaveLength(200);
    // Generous bound: per-keystroke work is just a state update.
    expect(elapsed / 200).toBeLessThan(16);
  });

  it('does not re-emit an empty query after clearing once the debounce settles', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hail' } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    onSearch.mockClear();

    fireEvent.click(screen.getByLabelText('Clear search'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
