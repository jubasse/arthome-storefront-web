import { describe, expect, it } from 'vitest';

import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it('keeps a relative path with its query', () => {
    expect(safeReturnPath('/live/abc?x=1')).toBe('/live/abc?x=1');
  });

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example', 'live/abc', '', '/a\nb'])(
    'refuses %j',
    (raw) => {
      expect(safeReturnPath(raw)).toBe('/');
    },
  );

  it('falls back to the home when absent', () => {
    expect(safeReturnPath(null)).toBe('/');
    expect(safeReturnPath(undefined)).toBe('/');
  });
});
