import { generateOutfit } from '../outfitService';
import { WardrobeItem } from '../../types/wardrobe';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(String(body)),
});

function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: '1',
    photoUri: 'file://1.jpg',
    category: 'top',
    tags: [],
    addedAt: 0,
    ...overrides,
  };
}

function promptFrom(mockFetchCall: unknown[]): string {
  const [, options] = mockFetchCall as [string, { body: string }];
  return JSON.parse(options.body).messages[0].content;
}

function okResponseFor(itemIds: string[]) {
  return makeResponse({
    result: { response: { itemIds, reasoning: 'ok', styleNotes: [], recommendation: '' } },
  });
}

const okOutfitResponse = {
  result: {
    response: {
      itemIds: ['1', '2'],
      reasoning: 'Contrast and balance work well.',
      styleNotes: ['Bright top pairs with dark bottom'],
      recommendation: 'Add clean shoes to finish it off.',
    },
  },
};

describe('generateOutfit', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws when fewer than 2 items match the requested style', async () => {
    const wardrobe = [makeItem({ id: '1', category: 'top', tags: ['formal'] })];
    await expect(
      generateOutfit({ wardrobe, stylePrefs: ['formal'] }),
    ).rejects.toThrow('Not enough wardrobe items');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes underscore/hyphen style tags so smart_casual matches smart-casual', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['smart-casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['smart-casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['smart_casual'] });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('[2]');
  });

  it('always includes casual-tagged items regardless of requested style', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['formal'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['formal'] });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('[2]');
  });

  it('excludes accessories from the prompt when includeAccessories is false', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'accessory', tags: [] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: false });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).not.toContain('[3]');
  });

  it('includes accessories by default', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'accessory', tags: [] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('[3]');
  });

  it('only includes the PERSON block when a profile is provided', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(promptFrom(mockFetch.mock.calls[0])).not.toContain('PERSON');

    await generateOutfit({
      wardrobe,
      stylePrefs: ['casual'],
      profile: { heightRange: 'tall', build: 'slim' },
    });
    const promptWithProfile = promptFrom(mockFetch.mock.calls[1]);
    expect(promptWithProfile).toContain('PERSON');
    expect(promptWithProfile).toContain('tall');
    expect(promptWithProfile).toContain('slim');
  });

  it('only includes the CONSTRAINTS block when rejectedIdSets is non-empty', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(promptFrom(mockFetch.mock.calls[0])).not.toContain('CONSTRAINTS');

    await generateOutfit({ wardrobe, stylePrefs: ['casual'], rejectedIdSets: [['1', '2']] });
    const promptWithRejects = promptFrom(mockFetch.mock.calls[1]);
    expect(promptWithRejects).toContain('CONSTRAINTS');
    expect(promptWithRejects).toContain('1, 2');
  });

  it('returns mapped WardrobeItem objects for a direct object response', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'], name: 'White tee' }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'], name: 'Blue jeans' }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
    expect(result.reasoning).toBe('Contrast and balance work well.');
    expect(result.recommendation).toBe('Add clean shoes to finish it off.');
  });

  it('falls back to regex extraction when the model wraps JSON in markdown fences', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    const fenced = '```json\n{"itemIds": ["1", "2"], "reasoning": "Works well together", "styleNotes": ["Balanced"], "recommendation": "Wear it out"}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
    expect(result.reasoning).toBe('Works well together');
  });

  it('drops hallucinated item ids that do not exist in the wardrobe', async () => {
    // Both items are 'top' so no other required category is available in the
    // pool — isolates hallucination-dropping from the missing-category
    // guarantee-fill behavior, which is covered by its own tests below.
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'top', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          itemIds: ['1', '999'],
          reasoning: 'ok',
          styleNotes: [],
          recommendation: '',
        },
      },
    }));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1']);
  });

  it('throws when none of the returned item ids match the wardrobe', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          itemIds: ['999'],
          reasoning: 'ok',
          styleNotes: [],
          recommendation: '',
        },
      },
    }));
    await expect(generateOutfit({ wardrobe, stylePrefs: ['casual'] })).rejects.toThrow(
      'do not match your wardrobe',
    );
  });

  it('throws when the response cannot be parsed at all', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse({ result: { response: 'not json at all' } }));
    await expect(generateOutfit({ wardrobe, stylePrefs: ['casual'] })).rejects.toThrow(
      'could not generate an outfit',
    );
  });

  it('retries once with a correction block when a required, available category is missing', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    const topOnlyResponse = makeResponse({
      result: { response: { itemIds: ['1'], reasoning: 'ok', styleNotes: [], recommendation: '' } },
    });
    const fixedResponse = makeResponse({
      result: { response: { itemIds: ['1', '2'], reasoning: 'fixed', styleNotes: [], recommendation: '' } },
    });
    mockFetch.mockResolvedValueOnce(topOnlyResponse).mockResolvedValueOnce(fixedResponse);

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryPrompt = promptFrom(mockFetch.mock.calls[1]);
    expect(retryPrompt).toContain('CORRECTION');
    expect(retryPrompt).toContain('bottom');
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
  });

  it('does not retry for a category that has no candidates at all', async () => {
    // No shoes anywhere in the wardrobe — requiring them would be an impossible retry.
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2']));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the full wardrobe for a required category the style filter excluded entirely', async () => {
    // Regression case: a small wardrobe where the only top doesn't carry a
    // matching style tag (or 'casual'), so it's absent from the style-filtered
    // candidate pool entirely — retrying can't help since the AI never even
    // sees a top in its inventory. The final guarantee-fill must still pull
    // one in from the full wardrobe rather than ship a topless outfit.
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['formal'] }), // excluded by filterByStyle for a 'sporty' request
      makeItem({ id: '2', category: 'bottom', tags: ['sporty'] }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['2']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['sporty'] });
    // No retry attempted for 'top' — it was never visible in the filtered
    // inventory, so asking the AI again would have been pointless.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.items.map(i => i.id).sort()).toEqual(['1', '2']);
  });

  it('structurally fills in a missing category from the candidate pool if the AI still omits it after the retry', async () => {
    // The AI never includes the bottom, even on retry — code must guarantee it
    // anyway rather than shipping an incomplete outfit despite one being available.
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.items.map(i => i.id).sort()).toEqual(['1', '2']);
  });

  it('treats accessory as required-if-available when includeAccessories is true, filling it in if the AI omits it', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'accessory', tags: [] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: true });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('accessory');
    expect(mockFetch).toHaveBeenCalledTimes(2); // retried since the accessory was available but unused
    expect(result.items.map(i => i.id).sort()).toEqual(['1', '2', '3']); // guaranteed in anyway
  });

  it('does not require an accessory when includeAccessories is false', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2']));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: false });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('instructs the AI to ground reasoning in exact item names and not suggest unselected garments', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('GROUNDING');
    expect(prompt).toContain('exact name');
  });
});
