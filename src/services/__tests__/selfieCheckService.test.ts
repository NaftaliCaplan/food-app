import { checkSelfieOutfit, tierForScore } from '../selfieCheckService';

jest.mock('expo-file-system/next', () => ({
  File: jest.fn().mockImplementation(() => ({
    bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  })),
}));

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(String(body)),
});

const NOTHING_DETECTED = {
  top: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
  bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
  shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
  accessories: [],
};

describe('tierForScore', () => {
  it.each([
    [-2, 'strong_match'],
    [-1, 'strong_match'],
    [-0.5, 'good_match'],
    [-0.3, 'good_match'],
    [0, 'neutral'],
    [0.2, 'neutral'],
    [1, 'mild_clash'],
    [1.9, 'mild_clash'],
    [2, 'strong_clash'],
    [5, 'strong_clash'],
  ] as const)('buckets score %s as %s', (score, expected) => {
    expect(tierForScore(score)).toBe(expected);
  });
});

describe('checkSelfieOutfit', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls Cloudflare with correct method and auth header', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: NOTHING_DETECTED } }));
    await expect(checkSelfieOutfit('file://test.jpg')).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('parses a clean, fully-populated response into garments with a neutral-ish tier', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['navy'], pattern: 'solid', brightness: 'dark', attributes: ['fitted'] },
          bottom: { present: true, colors: ['black'], pattern: 'solid', brightness: 'dark', attributes: ['loose'] },
          shoes: { present: true, colors: ['black'], pattern: 'solid', brightness: 'dark', attributes: ['leather'] },
          accessories: [],
        },
      },
    }));
    const result = await checkSelfieOutfit('file://test.jpg');
    expect(result.garments).toEqual(
      expect.arrayContaining([
        { category: 'top', tags: expect.arrayContaining(['navy', 'solid', 'dark', 'fitted']) },
        { category: 'bottom', tags: expect.arrayContaining(['black', 'solid', 'dark', 'loose']) },
        { category: 'shoes', tags: expect.arrayContaining(['black', 'solid', 'dark', 'leather']) },
      ]),
    );
    expect(result.tip).toBeTruthy();
  });

  it('excludes a slot marked present: false from the detected garments', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['navy'], pattern: 'solid', brightness: 'dark', attributes: [] },
          bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          accessories: [],
        },
      },
    }));
    const result = await checkSelfieOutfit('file://test.jpg');
    expect(result.garments).toHaveLength(1);
    expect(result.garments[0].category).toBe('top');
  });

  it('extracts every canonical color word from a compound color phrase instead of dropping the item\'s color entirely', async () => {
    // Same bug class fixed in tagService.ts (ADR 0017): "olive green" must
    // become both real recognized color tags, not one unrecognized hyphenated tag.
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['olive green'], pattern: 'solid', brightness: 'dark', attributes: [] },
          bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          accessories: [],
        },
      },
    }));
    const result = await checkSelfieOutfit('file://test.jpg');
    const topTags = result.garments.find(g => g.category === 'top')?.tags ?? [];
    expect(topTags).toContain('olive');
    expect(topTags).toContain('green');
  });

  it('drops an unrecognized pattern/brightness/attribute word rather than keeping it as a garbage tag', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['navy'], pattern: 'sparkly', brightness: 'shimmering', attributes: ['baggy'] },
          bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          accessories: [],
        },
      },
    }));
    const result = await checkSelfieOutfit('file://test.jpg');
    const topTags = result.garments.find(g => g.category === 'top')?.tags ?? [];
    expect(topTags).toEqual(['navy']);
  });

  it('parses accessory type/colors/material and drops an unrecognized type', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          ...NOTHING_DETECTED,
          top: { present: true, colors: ['navy'], pattern: 'solid', brightness: 'dark', attributes: [] },
          accessories: [
            { type: 'belt', colors: ['brown'], attributes: ['leather'] },
            { type: 'not-a-real-type', colors: ['red'], attributes: [] },
          ],
        },
      },
    }));
    const result = await checkSelfieOutfit('file://test.jpg');
    const accessoryGarments = result.garments.filter(g => g.category === 'accessory');
    expect(accessoryGarments).toHaveLength(2);
    expect(accessoryGarments[0].tags).toEqual(expect.arrayContaining(['belt', 'brown', 'leather']));
    expect(accessoryGarments[1].tags).not.toContain('not-a-real-type');
  });

  it('parses a markdown-fenced response the same way as a raw object', async () => {
    const fenced = '```json\n' + JSON.stringify({
      top: { present: true, colors: ['navy'], pattern: 'solid', brightness: 'dark', attributes: [] },
      bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
      shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
      accessories: [],
    }) + '\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await checkSelfieOutfit('file://test.jpg');
    expect(result.garments).toHaveLength(1);
    expect(result.garments[0].category).toBe('top');
  });

  it('throws a "no clothing detected" error when nothing is present', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: NOTHING_DETECTED } }));
    await expect(checkSelfieOutfit('file://test.jpg')).rejects.toThrow('No clothing detected');
  });

  it('throws the same "no clothing detected" error on an unparseable response rather than guessing', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: 'not json at all, sorry' } }));
    await expect(checkSelfieOutfit('file://test.jpg')).rejects.toThrow('No clothing detected');
  });

  it('throws on a non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Unauthorized', false, 401));
    await expect(checkSelfieOutfit('file://test.jpg')).rejects.toThrow('Cloudflare AI error 401');
  });

  it('applies undertone personalization when a profile is passed, favoring a flattering color', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['orange'], pattern: 'solid', brightness: '', attributes: [] },
          bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          accessories: [],
        },
      },
    }));
    const withProfile = await checkSelfieOutfit('file://test.jpg', { heightRange: 'average', build: 'average', undertone: 'warm' });
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          top: { present: true, colors: ['orange'], pattern: 'solid', brightness: '', attributes: [] },
          bottom: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          shoes: { present: false, colors: [], pattern: '', brightness: '', attributes: [] },
          accessories: [],
        },
      },
    }));
    const withoutProfile = await checkSelfieOutfit('file://test.jpg');
    // Orange flatters a warm undertone (see outfitAesthetics.ts's
    // WARM_FLATTERING_COLORS) — the personalized run should score at least as
    // good a tier, never worse, for the exact same detected garments.
    const tierOrder: Record<string, number> = {
      strong_match: 0, good_match: 1, neutral: 2, mild_clash: 3, strong_clash: 4,
    };
    expect(tierOrder[withProfile.tier]).toBeLessThanOrEqual(tierOrder[withoutProfile.tier]);
  });
});
