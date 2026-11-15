import { extractJsonObject } from '../extractJsonObject';

describe('extractJsonObject', () => {
  it('returns an already-parsed object unchanged', () => {
    const obj = { color: 'red' };
    expect(extractJsonObject(obj)).toBe(obj);
  });

  it('parses a raw JSON string', () => {
    expect(extractJsonObject('{"color": "red"}')).toEqual({ color: 'red' });
  });

  it('strips ```json fences before parsing', () => {
    expect(extractJsonObject('```json\n{"color": "red"}\n```')).toEqual({ color: 'red' });
  });

  it('strips bare ``` fences before parsing', () => {
    expect(extractJsonObject('```\n{"color": "red"}\n```')).toEqual({ color: 'red' });
  });

  it('returns null for a non-object, non-string value', () => {
    expect(extractJsonObject(42)).toBeNull();
    expect(extractJsonObject(undefined)).toBeNull();
  });

  it('returns null when no {...} block is present', () => {
    expect(extractJsonObject('not json at all')).toBeNull();
  });

  it('returns null on malformed JSON inside a {...} block', () => {
    expect(extractJsonObject('{color: red}')).toBeNull();
  });
});
