import { extractSkinTone, tagClothingItem } from '../tagService';

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

function promptFrom(mockFetchCall: unknown[]): string {
  const [, options] = mockFetchCall as [string, { body: string }];
  return JSON.parse(options.body).messages[0].content[1].text;
}

const okTagResponse = {
  result: {
    response: {
      isClothing: true,
      colors: ['navy'],
      category: 'top',
      name: 'navy tee',
      styles: ['casual'],
      tags: [],
    },
  },
};

describe('tagClothingItem', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('merges the dedicated styles field into tags', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          name: 'plaid flannel pajama pants',
          styles: ['casual'],
          tags: ['plaid', 'light', 'loose'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'bottom');
    expect(result.tags).toEqual(expect.arrayContaining(['plaid', 'light', 'loose', 'casual']));
    expect(result.tags.filter(t => t === 'casual')).toHaveLength(1);
  });

  it('merges multiple styles into tags when the model gives both', async () => {
    // A plain t-shirt can genuinely be both casual and beachwear (ADR 0018).
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          name: 'white cotton tee',
          styles: ['casual', 'beachwear'],
          tags: ['white', 'solid'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toEqual(expect.arrayContaining(['white', 'solid', 'casual', 'beachwear']));
  });

  it('strips contradictory style words the model put in the free-form tags list', async () => {
    // Regression case: the model tagged an item with both "casual" and "formal"
    // directly in the tags array. The dedicated "styles" field should win, and
    // any stray style words in tags must be removed, not just deduplicated.
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          name: 'plaid pajama pants',
          styles: ['casual'],
          tags: ['plaid', 'casual', 'formal'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'bottom');
    expect(result.tags).toEqual(expect.arrayContaining(['plaid', 'casual']));
    expect(result.tags).not.toContain('formal');
  });

  it('normalizes hyphenated style values to the underscore form', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          name: 'chinos',
          styles: ['smart-casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'bottom');
    expect(result.tags).toContain('smart_casual');
  });

  it('flags non-clothing photos via isClothing', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: false,
          name: '',
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.isClothing).toBe(false);
  });

  it('defaults isClothing to true when the field is missing', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          name: 'white tee',
          styles: ['casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.isClothing).toBe(true);
  });

  it('falls back to regex extraction when the model wraps JSON in markdown fences', async () => {
    const fenced = '```json\n{"isClothing": true, "name": "denim jacket", "styles": ["casual"], "tags": ["denim", "casual", "formal"]}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.name).toBe('denim jacket');
    expect(result.tags).toEqual(expect.arrayContaining(['denim', 'casual']));
    expect(result.tags).not.toContain('formal');
  });

  it('returns the AI\'s independently detected category, overriding a wrong pre-selection', async () => {
    // Regression case: user had "top" selected but photographed bottoms.
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          category: 'bottom',
          name: 'jeans',
          styles: ['casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.detectedCategory).toBe('bottom');
  });

  it('parses detectedCategory from the markdown-fence fallback path too', async () => {
    const fenced = '```json\n{"isClothing": true, "category": "shoes", "name": "sneakers", "styles": ["casual"], "tags": []}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.detectedCategory).toBe('shoes');
  });

  it('leaves detectedCategory undefined for an invalid or missing category value', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          category: 'not-a-real-category',
          name: 'sweater',
          styles: ['casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.detectedCategory).toBeUndefined();
  });

  it('merges detected colors into tags', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          colors: ['navy', 'white'],
          category: 'top',
          name: 'navy polo',
          styles: ['smart_casual'],
          tags: ['solid'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toEqual(expect.arrayContaining(['solid', 'navy', 'white']));
  });

  it('does not duplicate a color already present in the raw tags list', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          colors: ['navy'],
          category: 'top',
          name: 'navy polo',
          styles: ['smart_casual'],
          tags: ['navy', 'solid'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags.filter(t => t === 'navy')).toHaveLength(1);
  });

  it('extracts every canonical color word from a compound color phrase instead of hyphenating it whole', async () => {
    // The model is instructed to use a single canonical word, but doesn't
    // always comply. Hyphenating "olive green" into "olive-green" would
    // produce a tag that never matches anything in COLOR_TAGS, making the
    // item invisible to outfit-generation's color-clash scoring entirely —
    // a real bug found via live testing (see ADR 0017 follow-up).
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          colors: ['olive green'],
          category: 'top',
          name: 'olive jacket',
          styles: ['casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toContain('olive');
    expect(result.tags).toContain('green');
    expect(result.tags).not.toContain('olive-green');
  });

  it('falls back to a hyphenated phrase only when a color contains no recognizable canonical word', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          colors: ['neon chartreuse'],
          category: 'top',
          name: 'bright jacket',
          styles: ['casual'],
          tags: [],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toContain('neon-chartreuse');
  });

  it('parses colors from the markdown-fence fallback path too', async () => {
    const fenced = '```json\n{"isClothing": true, "colors": ["burgundy"], "category": "top", "name": "burgundy sweater", "styles": ["casual"], "tags": ["solid"]}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toEqual(expect.arrayContaining(['solid', 'burgundy']));
  });

  it('parses multiple styles from the markdown-fence fallback path too', async () => {
    const fenced = '```json\n{"isClothing": true, "name": "white tee", "styles": ["casual", "beachwear"], "tags": ["white"]}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await tagClothingItem('file://test.jpg', 'top');
    expect(result.tags).toEqual(expect.arrayContaining(['white', 'casual', 'beachwear']));
  });

  it('asks for fit/weight attributes for top and bottom categories', async () => {
    mockFetch.mockResolvedValue(makeResponse(okTagResponse));
    await tagClothingItem('file://test.jpg', 'top');
    expect(promptFrom(mockFetch.mock.calls[0])).toContain('Weight/fit');

    await tagClothingItem('file://test.jpg', 'bottom');
    expect(promptFrom(mockFetch.mock.calls[1])).toContain('Weight/fit');
  });

  it('asks for material/type attributes for shoes instead of fit', async () => {
    mockFetch.mockResolvedValue(makeResponse(okTagResponse));
    await tagClothingItem('file://test.jpg', 'shoes');
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('Material/type');
    expect(prompt).not.toContain('Weight/fit');
  });

  it('asks for material attributes for accessories instead of fit', async () => {
    mockFetch.mockResolvedValue(makeResponse(okTagResponse));
    await tagClothingItem('file://test.jpg', 'accessory');
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('Material:');
    expect(prompt).not.toContain('Weight/fit');
  });

  it('asks for an accessory type guess (hat/belt/bag/etc.) only for accessories', async () => {
    mockFetch.mockResolvedValue(makeResponse(okTagResponse));
    await tagClothingItem('file://test.jpg', 'accessory');
    expect(promptFrom(mockFetch.mock.calls[0])).toContain('hat / belt / bag / watch / scarf / jewelry');

    await tagClothingItem('file://test.jpg', 'top');
    expect(promptFrom(mockFetch.mock.calls[1])).not.toContain('hat / belt / bag / watch / scarf / jewelry');
  });

  it('passes an AI-suggested accessory type straight through as a plain tag', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          isClothing: true,
          colors: ['black'],
          category: 'accessory',
          name: 'black wool hat',
          styles: ['casual'],
          tags: ['solid', 'knit', 'hat'],
        },
      },
    }));
    const result = await tagClothingItem('file://test.jpg', 'accessory');
    expect(result.tags).toContain('hat');
  });

  it('allows sleepwear and beachwear as their own styles in the prompt, not folded into casual', async () => {
    mockFetch.mockResolvedValue(makeResponse(okTagResponse));
    await tagClothingItem('file://test.jpg', 'top');
    const prompt = promptFrom(mockFetch.mock.calls[0]);
    expect(prompt).toContain('sleepwear');
    expect(prompt).toContain('beachwear');
    expect(prompt).not.toMatch(/pajamas and sleepwear are always casual/i);
  });
});

describe('extractSkinTone', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('parses the structured undertone field alongside the free-text description', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          undertone: 'warm',
          skinToneDesc: 'Warm undertone, high contrast, average build.',
        },
      },
    }));
    const result = await extractSkinTone('file://profile.jpg');
    expect(result.undertone).toBe('warm');
    expect(result.skinToneDesc).toBe('Warm undertone, high contrast, average build.');
  });

  it('drops an unrecognized undertone value rather than passing it through', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: {
        response: {
          undertone: 'olive',
          skinToneDesc: 'Some description.',
        },
      },
    }));
    const result = await extractSkinTone('file://profile.jpg');
    expect(result.undertone).toBeUndefined();
  });

  it('parses undertone from the markdown-fence fallback path too', async () => {
    const fenced = '```json\n{"undertone": "cool", "skinToneDesc": "Cool undertone, medium contrast."}\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await extractSkinTone('file://profile.jpg');
    expect(result.undertone).toBe('cool');
  });

  it('leaves undertone undefined when the field is missing entirely', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { skinToneDesc: 'Neutral undertone.' } },
    }));
    const result = await extractSkinTone('file://profile.jpg');
    expect(result.undertone).toBeUndefined();
  });
});
