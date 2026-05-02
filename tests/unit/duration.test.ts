import { describe, it, expect } from 'vitest';
import { parseDuration, formatRemaining, formatDurationLong } from '../../src/utils/duration.js';

describe('parseDuration', () => {
  it.each([
    ['25m', 25 * 60_000],
    ['1h', 60 * 60_000],
    ['90s', 90_000],
    ['1h30m', 90 * 60_000],
    ['1h30m45s', 90 * 60_000 + 45_000],
    ['  1H30M  ', 90 * 60_000],
  ])('parses %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['0m'],
    ['0h'],
    ['0s'],
    ['hello'],
    ['25'],
    ['m25'],
    ['-5m'],
    ['1.5h'],
  ])('rejects %s', (input) => {
    expect(() => parseDuration(input)).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => parseDuration(null as unknown as string)).toThrow('duration must be a string');
  });
});

describe('formatRemaining', () => {
  it('formats zero as 00:00', () => {
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('clamps negative ms to 00:00', () => {
    expect(formatRemaining(-500)).toBe('00:00');
  });

  it('rounds up partial seconds', () => {
    expect(formatRemaining(1500)).toBe('00:02');
  });

  it('formats exact minute boundary', () => {
    expect(formatRemaining(60_000)).toBe('01:00');
  });

  it('formats 25 minutes', () => {
    expect(formatRemaining(25 * 60_000)).toBe('25:00');
  });

  it('shows minutes >= 60 (no hour rollover)', () => {
    expect(formatRemaining(75 * 60_000)).toBe('75:00');
  });
});

describe('formatDurationLong', () => {
  it('formats zero as 0s', () => {
    expect(formatDurationLong(0)).toBe('0s');
  });

  it('formats sub-minute as Ns', () => {
    expect(formatDurationLong(45_000)).toBe('45s');
  });

  it('formats 1h30m without seconds component', () => {
    expect(formatDurationLong(90 * 60_000)).toBe('1h 30m');
  });

  it('formats 1h30m45s with all parts', () => {
    expect(formatDurationLong(90 * 60_000 + 45_000)).toBe('1h 30m 45s');
  });
});
