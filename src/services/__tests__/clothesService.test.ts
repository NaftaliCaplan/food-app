import { analyzeClothes, labelForVerdict } from '../clothesService';

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

describe('labelForVerdict', () => {
  it.each([
    ['strong_match', 'Strong Match'],
    ['good_match',   'Good Match'],
    ['neutral',      'Neutral'],
    ['mild_clash',   'Mild Clash'],
    ['strong_clash', 'Strong Clash'],
    ['unknown',      'Unknown'],
  ] as const)('maps %s → %s', (verdict, expected) => {
    expect(labelForVerdict(verdict)).toBe(expected);
  });
});

describe('analyzeClothes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls Cloudflare with correct method and auth header', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          verdict: 'neutral',
          verdictLabel: 'Neutral',
          confidencePercent: 60,
          garmentDescriptions: [],
          contrastNotes: [],
          patternNotes: [],
          toneNotes: [],
          recommendation: '',
        },
      },
    }));
    await analyzeClothes('file://test.jpg');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('returns parsed result when model returns JSON object', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          verdict: 'good_match',
          verdictLabel: 'Good Match',
          confidencePercent: 70,
          garmentDescriptions: ['Dark jacket'],
          contrastNotes: ['Good contrast'],
          patternNotes: [],
          toneNotes: ['Both neutral'],
          recommendation: 'Looks good.',
        },
      },
    }));
    const result = await analyzeClothes('file://test.jpg');
    expect(result.verdict).toBe('good_match');
    expect(result.recommendation).toBe('Looks good.');
    expect(result.garmentDescriptions).toEqual(['Dark jacket']);
  });

  it('falls back to keyword matching on malformed response', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: 'The outfit is a strong_clash because the patterns conflict.' },
    }));
    const result = await analyzeClothes('file://test.jpg');
    expect(result.verdict).toBe('strong_clash');
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Unauthorized', false, 401));
    await expect(analyzeClothes('file://test.jpg')).rejects.toThrow('Cloudflare AI error 401');
  });

  it('applies confidence adjustment for small images', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          verdict: 'strong_match',
          verdictLabel: 'Strong Match',
          confidencePercent: 95,
          garmentDescriptions: [],
          contrastNotes: [],
          patternNotes: [],
          toneNotes: [],
          recommendation: '',
        },
      },
    }));
    const result = await analyzeClothes('file://test.jpg');
    // bytes mock returns 3 bytes — very small, should cap at 55
    expect(result.confidencePercent).toBeLessThanOrEqual(55);
  });
});
