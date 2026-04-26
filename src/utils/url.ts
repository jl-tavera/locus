const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function normalizeUrl(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('url must be a string');
  }
  let value = input.trim().toLowerCase();
  if (!value) throw new Error('url is empty');

  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/^\/\//, '');
  const slashIdx = value.indexOf('/');
  if (slashIdx !== -1) value = value.slice(0, slashIdx);
  value = value.replace(/^www\./, '');
  value = value.replace(/:\d+$/, '');

  if (!value) throw new Error('url is empty after normalization');
  if (value === 'localhost' || value === '127.0.0.1' || value === '::1') {
    throw new Error('refusing to block localhost');
  }
  if (!HOSTNAME_RE.test(value)) {
    throw new Error(`"${input}" is not a valid hostname`);
  }
  return value;
}
