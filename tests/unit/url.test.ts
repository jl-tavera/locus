import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../src/utils/url.js';

describe('normalizeUrl', () => {
  it('strips https:// scheme', () => {
    expect(normalizeUrl('https://example.com')).toBe('example.com');
  });

  it('strips http:// scheme', () => {
    expect(normalizeUrl('http://example.com')).toBe('example.com');
  });

  it('strips protocol-relative //', () => {
    expect(normalizeUrl('//example.com')).toBe('example.com');
  });

  it('strips path', () => {
    expect(normalizeUrl('example.com/foo/bar?x=1')).toBe('example.com');
  });

  it('strips port', () => {
    expect(normalizeUrl('example.com:8080')).toBe('example.com');
  });

  it('strips leading www.', () => {
    expect(normalizeUrl('www.example.com')).toBe('example.com');
  });

  it('lowercases', () => {
    expect(normalizeUrl('Example.COM')).toBe('example.com');
  });

  it('combines all transforms', () => {
    expect(normalizeUrl('  HTTPS://WWW.Example.com:443/path  ')).toBe('example.com');
  });

  it('preserves subdomains other than www', () => {
    expect(normalizeUrl('mail.example.com')).toBe('mail.example.com');
  });

  it('is idempotent', () => {
    const once = normalizeUrl('https://www.example.com/path');
    const twice = normalizeUrl(once);
    expect(twice).toBe(once);
  });

  it.each([
    ['localhost'],
    ['127.0.0.1'],
    ['::1'],
    ['http://localhost:3000'],
  ])('rejects loopback host %s', (input) => {
    expect(() => normalizeUrl(input)).toThrow();
  });

  it.each([
    [''],
    ['   '],
    ['no-tld'],
    ['has spaces.com'],
    ['-leading-hyphen.com'],
    ['trailing-hyphen-.com'],
  ])('rejects invalid hostname %s', (input) => {
    expect(() => normalizeUrl(input)).toThrow();
  });

  it('rejects non-string input', () => {
    // intentionally violating the type to test runtime guard
    expect(() => normalizeUrl(42 as unknown as string)).toThrow('url must be a string');
  });
});
