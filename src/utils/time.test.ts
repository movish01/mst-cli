import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, formatMessageTime } from './time.js';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for < 1 minute ago', () => {
    const time = new Date('2026-04-02T11:59:30Z').toISOString();
    expect(formatRelativeTime(time)).toBe('just now');
  });

  it('returns minutes for < 1 hour ago', () => {
    const time = new Date('2026-04-02T11:45:00Z').toISOString();
    expect(formatRelativeTime(time)).toBe('15m');
  });

  it('returns hours for < 24 hours ago', () => {
    const time = new Date('2026-04-02T09:00:00Z').toISOString();
    expect(formatRelativeTime(time)).toBe('3h');
  });

  it('returns "yesterday" for 1 day ago', () => {
    const time = new Date('2026-04-01T12:00:00Z').toISOString();
    expect(formatRelativeTime(time)).toBe('yesterday');
  });

  it('returns weekday name for 2-6 days ago', () => {
    const time = new Date('2026-03-30T12:00:00Z').toISOString();
    const result = formatRelativeTime(time);
    expect(result).toBe('Mon');
  });

  it('returns month and day for > 7 days ago', () => {
    const time = new Date('2026-03-15T12:00:00Z').toISOString();
    const result = formatRelativeTime(time);
    expect(result).toBe('Mar 15');
  });
});

describe('formatMessageTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns just time for today', () => {
    const time = new Date('2026-04-02T09:30:00Z').toISOString();
    const result = formatMessageTime(time);
    // Should contain time but not a date
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns weekday + time for < 7 days ago', () => {
    const time = new Date('2026-03-30T09:30:00Z').toISOString();
    const result = formatMessageTime(time);
    expect(result).toMatch(/Mon/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns month day + time for > 7 days ago', () => {
    const time = new Date('2026-03-15T09:30:00Z').toISOString();
    const result = formatMessageTime(time);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
