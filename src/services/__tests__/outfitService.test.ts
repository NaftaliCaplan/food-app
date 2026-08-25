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
    result: { response: { itemIds, recommendation: '' } },
  });
}

const okOutfitResponse = {
  result: {
    response: {
      itemIds: ['1', '2'],
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
    const promptWithProfile = promptFrom(mockFetch.mock.calls[3]);
    expect(promptWithProfile).toContain('PERSON');
    expect(promptWithProfile).toContain('tall');
    expect(promptWithProfile).toContain('slim');
  });

  it('only includes the WEATHER block when a temperature is provided, as advisory context', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(promptFrom(mockFetch.mock.calls[0])).not.toContain('WEATHER');

    await generateOutfit({ wardrobe, stylePrefs: ['casual'], temperatureF: 95 });
    const promptWithWeather = promptFrom(mockFetch.mock.calls[3]);
    expect(promptWithWeather).toContain('WEATHER');
    expect(promptWithWeather).toContain('95°F (35°C)');
  });

  it('does not exclude items by weight tag even at an extreme temperature — advisory only, not a hard filter', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual', 'heavyweight'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2']));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'], temperatureF: 100 });
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
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
    const promptWithRejects = promptFrom(mockFetch.mock.calls[3]);
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
    expect(result.recommendation).toBe('Add clean shoes to finish it off.');
  });

  it('falls back to regex extraction when the model wraps JSON in markdown fences', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    const fenced = '```json\n{"itemIds": ["1", "2"], "recommendation": "Wear it out"}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
    expect(result.recommendation).toBe('Wear it out');
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
          recommendation: '',
        },
      },
    }));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1']);
  });

  it('dedupes a repeated item id so the same item never appears twice in the output', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '1', '2']));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1', '2']);
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
      result: { response: { itemIds: ['1'], recommendation: '' } },
    });
    const fixedResponse = makeResponse({
      result: { response: { itemIds: ['1', '2'], recommendation: '' } },
    });
    mockFetch.mockResolvedValueOnce(topOnlyResponse).mockResolvedValueOnce(fixedResponse);

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });

    // 2 calls for the winning candidate's own retry, plus 1 more for a second
    // candidate attempt that fails once the mocked queue runs out — that
    // failure is expected and non-fatal (see generateOutfit's per-candidate
    // try/catch); only the first, successful candidate is scored and returned.
    expect(mockFetch).toHaveBeenCalledTimes(3);
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
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 fetch per candidate (3 candidates), no retries needed
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
    // 1 fetch per candidate (3 candidates), same guarantee-fill result each time.
    expect(mockFetch).toHaveBeenCalledTimes(3);
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
    expect(mockFetch).toHaveBeenCalledTimes(6); // 2 fetches (1 retry) per candidate, 3 candidates
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
    expect(mockFetch).toHaveBeenCalledTimes(6); // retried since the accessory was available but unused, x3 candidates
    expect(result.items.map(i => i.id).sort()).toEqual(['1', '2', '3']); // guaranteed in anyway
  });

  it('does not require an accessory when includeAccessories is false', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2']));

    await generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: false });
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 fetch per candidate, 3 candidates
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

  it('trims a second bottom the AI incorrectly included down to one', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '4', category: 'shoes', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2', '3', '4']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const bottoms = result.items.filter(i => i.category === 'bottom');
    expect(bottoms).toHaveLength(1);
    expect(bottoms[0].id).toBe('2'); // keeps the first one the AI listed
  });

  it('keeps the duplicate bottom the recommendation actually names, even if it was listed second', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', name: 'black pants', tags: ['casual'] }),
      makeItem({ id: '3', category: 'bottom', name: 'khaki pants', tags: ['casual'] }),
      makeItem({ id: '4', category: 'shoes', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          itemIds: ['1', '2', '3', '4'],
          recommendation: "Tuck in your shirt with the 'khaki pants' for a clean look.",
        },
      },
    }));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const bottoms = result.items.filter(i => i.category === 'bottom');
    expect(bottoms).toHaveLength(1);
    expect(bottoms[0].id).toBe('3'); // keeps 'khaki pants', not the array-order-first 'black pants'
  });

  it('trims a second pair of shoes the AI incorrectly included down to one', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'shoes', tags: ['casual'] }),
      makeItem({ id: '4', category: 'shoes', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2', '3', '4']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.filter(i => i.category === 'shoes')).toHaveLength(1);
  });

  it('allows a second top for layering (e.g. a sweater over a t-shirt)', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'top', tags: ['casual'] }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2', '3']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.filter(i => i.category === 'top')).toHaveLength(2);
  });

  it('caps tops at two even if the AI selects three', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'top', tags: ['casual'] }),
      makeItem({ id: '3', category: 'top', tags: ['casual'] }),
      makeItem({ id: '4', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2', '3', '4']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.filter(i => i.category === 'top')).toHaveLength(2);
  });

  it('does not cap accessories — multiple are legitimate', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      makeItem({ id: '3', category: 'accessory', tags: [] }),
      makeItem({ id: '4', category: 'accessory', tags: [] }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1', '2', '3', '4']));

    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'], includeAccessories: true });
    expect(result.items.filter(i => i.category === 'accessory')).toHaveLength(2);
  });

  it('excludes items marked inLaundry from the candidate pool sent to the AI', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'bottom', tags: ['casual'], inLaundry: true }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'] }),
    ];
    mockFetch.mockResolvedValue(makeResponse(okOutfitResponse));
    await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).not.toContain('[2]');
    expect(prompt).toContain('[3]');
  });

  it('drops an AI-selected item that is actually in laundry, since it was never in the id map', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'top', tags: ['casual'] }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'], inLaundry: true }),
    ];
    // The AI shouldn't be able to select '3' since it's excluded from the prompt,
    // but this guards the defensive path too: even if it somehow did, the id map
    // built from the laundry-excluded set won't resolve it to a WardrobeItem.
    mockFetch.mockResolvedValue(okResponseFor(['1', '3']));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.map(i => i.id)).toEqual(['1']);
  });

  it('does not fill a missing category from the guarantee-fill fallback with a laundry item', async () => {
    const wardrobe = [
      makeItem({ id: '1', category: 'top', tags: ['casual'] }),
      makeItem({ id: '2', category: 'top', tags: ['casual'] }),
      makeItem({ id: '3', category: 'bottom', tags: ['casual'], inLaundry: true }),
    ];
    mockFetch.mockResolvedValue(okResponseFor(['1']));
    const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
    expect(result.items.some(i => i.id === '3')).toBe(false);
  });

  describe('candidate generation and aesthetic ranking', () => {
    it('generates multiple candidates and returns the one with the best color score, not just the first', async () => {
      const wardrobe = [
        makeItem({ id: '1', category: 'top', name: 'red top', tags: ['casual', 'red'] }),
        makeItem({ id: '2', category: 'bottom', name: 'green bottom', tags: ['casual', 'green'] }),
        makeItem({ id: '3', category: 'top', name: 'black top', tags: ['casual', 'black'] }),
        makeItem({ id: '4', category: 'bottom', name: 'white bottom', tags: ['casual', 'white'] }),
        makeItem({ id: '5', category: 'top', name: 'blue top', tags: ['casual', 'blue'] }),
        makeItem({ id: '6', category: 'bottom', name: 'purple bottom', tags: ['casual', 'purple'] }),
      ];
      mockFetch
        .mockResolvedValueOnce(okResponseFor(['1', '2'])) // red+green: a known clash — worst
        .mockResolvedValueOnce(okResponseFor(['3', '4'])) // black+white: all-neutral — best (score 0)
        .mockResolvedValueOnce(okResponseFor(['5', '6'])); // blue+purple: two accents, no listed clash — middling

      const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.items.map(i => i.id).sort()).toEqual(['3', '4']);
    });

    it('still returns a result if a later candidate attempt fails, using only the ones that succeeded', async () => {
      const wardrobe = [
        makeItem({ id: '1', category: 'top', tags: ['casual'] }),
        makeItem({ id: '2', category: 'bottom', tags: ['casual'] }),
      ];
      mockFetch
        .mockResolvedValueOnce(okResponseFor(['1', '2']))
        .mockResolvedValueOnce(makeResponse({}, false, 500))
        .mockResolvedValueOnce(makeResponse({}, false, 500));

      const result = await generateOutfit({ wardrobe, stylePrefs: ['casual'] });
      expect(result.items.map(i => i.id)).toEqual(['1', '2']);
    });
  });
});
