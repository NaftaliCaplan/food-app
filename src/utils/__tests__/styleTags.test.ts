import { extractStyles, isStyleWord, normalizeStyle, STYLE_KEYS, STYLE_LABELS } from '../styleTags';

describe('normalizeStyle', () => {
  it('lowercases', () => {
    expect(normalizeStyle('CASUAL')).toBe('casual');
  });

  it('strips hyphens', () => {
    expect(normalizeStyle('smart-casual')).toBe('smartcasual');
  });

  it('strips underscores', () => {
    expect(normalizeStyle('smart_casual')).toBe('smartcasual');
  });

  it('normalizes mixed-case and mixed-separator values to the same result', () => {
    expect(normalizeStyle('Smart-Casual')).toBe(normalizeStyle('smart_casual'));
  });
});

describe('isStyleWord', () => {
  it('recognizes every canonical style key regardless of separator/case', () => {
    expect(isStyleWord('casual')).toBe(true);
    expect(isStyleWord('SMART-CASUAL')).toBe(true);
    expect(isStyleWord('smart_casual')).toBe(true);
    expect(isStyleWord('sleepwear')).toBe(true);
    expect(isStyleWord('beachwear')).toBe(true);
  });

  it('returns false for a non-style tag', () => {
    expect(isStyleWord('navy')).toBe(false);
    expect(isStyleWord('fitted')).toBe(false);
  });
});

describe('extractStyles', () => {
  it('extracts a single style tag', () => {
    expect(extractStyles(['navy', 'solid', 'casual'])).toEqual(['casual']);
  });

  it('extracts multiple style tags in the order they appear (ADR 0018 multi-style items)', () => {
    expect(extractStyles(['white', 'casual', 'solid', 'beachwear'])).toEqual(['casual', 'beachwear']);
  });

  it('normalizes a hyphenated style tag to its canonical underscore form', () => {
    expect(extractStyles(['navy', 'smart-casual'])).toEqual(['smart_casual']);
  });

  it('returns an empty array when no style tag is present', () => {
    expect(extractStyles(['navy', 'solid', 'fitted'])).toEqual([]);
  });

  it('does not duplicate a style tag that somehow appears twice', () => {
    expect(extractStyles(['casual', 'navy', 'casual'])).toEqual(['casual']);
  });

  it('ignores a non-style tag mixed in with real style tags', () => {
    expect(extractStyles(['navy', 'casual', 'fitted', 'beachwear'])).toEqual(['casual', 'beachwear']);
  });
});

describe('STYLE_KEYS / STYLE_LABELS', () => {
  it('has a label for every style key, with no extras', () => {
    const labelKeys = Object.keys(STYLE_LABELS).sort();
    const styleKeys = [...STYLE_KEYS].sort();
    expect(labelKeys).toEqual(styleKeys);
  });
});
