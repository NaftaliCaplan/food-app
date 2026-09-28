import { analyzeFood } from '../cloudflareService';

jest.mock('expo-file-system/next', () => ({
  File: jest.fn().mockImplementation(() => ({
    bytes: jest.fn().mockResolvedValue(new Uint8Array(200_000)),
  })),
}));

const { File } = require('expo-file-system/next');

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(String(body)),
});

function mockImageSize(bytes: number) {
  File.mockImplementation(() => ({
    bytes: jest.fn().mockResolvedValue(new Uint8Array(bytes)),
  }));
}

function promptFrom(mockFetchCall: unknown[]): string {
  const [, options] = mockFetchCall as [string, { body: string }];
  return JSON.parse(options.body).messages[0].content[1].text;
}

describe('analyzeFood', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockImageSize(200_000);
  });

  it('calls Cloudflare with correct method, auth header, and max_tokens', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { state: 'ripe', confidencePercent: 60, visualCues: [], recommendation: '' } },
    }));
    await analyzeFood('file://test.jpg', 'banana');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body).max_tokens).toBe(512);
  });

  it('includes the food label in the prompt', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { state: 'ripe', confidencePercent: 60, visualCues: [], recommendation: '' } },
    }));
    await analyzeFood('file://test.jpg', 'banana');
    expect(promptFrom(mockFetch.mock.calls[0])).toContain('"banana"');
  });

  it('returns parsed result when the model returns a JSON object', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          observedFood: 'a yellow banana with brown spots',
          state: 'ripe',
          stateLabel: 'Ripe',
          confidencePercent: 60,
          visualCues: ['brown spots', 'soft texture'],
          recommendation: 'Eat it today.',
        },
      },
    }));
    const result = await analyzeFood('file://test.jpg', 'banana');
    expect(result.state).toBe('ripe');
    expect(result.stateLabel).toBe('Ripe');
    expect(result.visualCues).toEqual(['brown spots', 'soft texture']);
    expect(result.recommendation).toBe('Eat it today.');
    expect(result.observedFood).toBe('a yellow banana with brown spots');
  });

  it('derives stateLabel via labelForState when the model omits it', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { state: 'overripe', confidencePercent: 60, visualCues: [], recommendation: '' } },
    }));
    const result = await analyzeFood('file://test.jpg', 'banana');
    expect(result.stateLabel).toBe('Past its prime');
  });

  it('falls back to parseLLMResponse when the model returns a raw string', async () => {
    const fenced = '```json\n{"state": "ripe", "confidencePercent": 70, "visualCues": [], "recommendation": "Eat now."}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await analyzeFood('file://test.jpg', 'banana');
    expect(result.state).toBe('ripe');
    expect(result.recommendation).toBe('Eat now.');
  });

  it('throws on a non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Unauthorized', false, 401));
    await expect(analyzeFood('file://test.jpg', 'banana')).rejects.toThrow('Cloudflare AI error 401');
  });

  describe('label/observed-food mismatch detection', () => {
    it('sets labelMatch true when the observed food contains a word from the label', async () => {
      mockFetch.mockResolvedValue(makeResponse({
        result: {
          response: {
            observedFood: 'a yellow banana with brown spots',
            state: 'ripe',
            confidencePercent: 60,
            visualCues: [],
            recommendation: '',
          },
        },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.labelMatch).toBe(true);
    });

    it('sets labelMatch false when the observed food does not match the label', async () => {
      mockFetch.mockResolvedValue(makeResponse({
        result: {
          response: {
            observedFood: 'a red apple',
            state: 'ripe',
            confidencePercent: 60,
            visualCues: [],
            recommendation: '',
          },
        },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.labelMatch).toBe(false);
    });

    it('defaults labelMatch to true when observedFood is missing', async () => {
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 60, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.labelMatch).toBe(true);
    });
  });

  describe('confidence adjustment', () => {
    it('rescales a high (>85) model confidence down for a large, unpenalized image', async () => {
      mockImageSize(200_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 95, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      // 95 > 85 -> 75 + (95-85)*0.4 = 79, no size penalty at 200kb
      expect(result.confidencePercent).toBe(79);
    });

    it('does not rescale a model confidence at or below 85', async () => {
      mockImageSize(200_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 80, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.confidencePercent).toBe(80);
    });

    it('caps confidence at 55 for a very small (<50kb) image', async () => {
      mockImageSize(1_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 90, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      // 90 > 85 -> 77, then capped to 55 for a <50kb image
      expect(result.confidencePercent).toBe(55);
    });

    it('caps confidence at 70 for a small-but-not-tiny (<150kb) image', async () => {
      mockImageSize(100_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 80, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.confidencePercent).toBe(70);
    });

    it('applies no size-based cap for an image at or above 150kb', async () => {
      mockImageSize(150_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 60, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.confidencePercent).toBe(60);
    });

    it('never returns a confidence below 10 or above 99', async () => {
      mockImageSize(200_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', confidencePercent: 0, visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.confidencePercent).toBeGreaterThanOrEqual(10);
      expect(result.confidencePercent).toBeLessThanOrEqual(99);
    });

    it('defaults to 50 when confidencePercent is missing from the response', async () => {
      mockImageSize(200_000);
      mockFetch.mockResolvedValue(makeResponse({
        result: { response: { state: 'ripe', visualCues: [], recommendation: '' } },
      }));
      const result = await analyzeFood('file://test.jpg', 'banana');
      expect(result.confidencePercent).toBe(50);
    });
  });
});
