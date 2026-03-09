import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRelativeTime } from '../getRelativeTime';

describe('getRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for very recent timestamps (< 1 minute ago)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:30Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('Just now');
  });

  it('returns minutes ago for timestamps 1-59 minutes old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:05:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('5 minutes ago');
  });

  it('returns "1 minute ago" (singular) for exactly 1 minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:01:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('1 minute ago');
  });

  it('returns hours ago for timestamps 1-23 hours old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T15:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('3 hours ago');
  });

  it('returns "1 hour ago" (singular) for exactly 1 hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T13:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('1 hour ago');
  });

  it('returns days ago for timestamps 1-6 days old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('3 days ago');
  });

  it('returns "1 day ago" (singular) for exactly 1 day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('1 day ago');
  });

  it('returns weeks ago for timestamps 1-3 weeks old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('2 weeks ago');
  });

  it('returns months ago for timestamps more than 30 days old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T12:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('2 months ago');
  });

  it('returns "1 month ago" (singular) for exactly 1 month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-01T12:00:00Z'));

    const result = getRelativeTime('2024-01-01T12:00:00Z');
    expect(result).toBe('1 month ago');
  });
});
