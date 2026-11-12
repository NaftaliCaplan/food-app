import { checkLight } from '../lightCheckerService';
import { makeResponse } from '../../testUtils/mockResponse';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn().mockReturnValue({
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({ base64: 'AAAA' }),
      }),
    }),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

describe('checkLight', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls Cloudflare with correct method, auth header, and max_tokens', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: { color: 'red', detail: '' } } }));
    await checkLight('file://test.jpg');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body).max_tokens).toBe(300);
  });

  it.each(['red', 'green', 'amber'] as const)('parses a clean "%s" response', async (color) => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: { color, detail: '' } } }));
    const result = await checkLight('file://test.jpg');
    expect(result.color).toBe(color);
    expect(result.colorLabel).toBe(color[0].toUpperCase() + color.slice(1));
    expect(result.detail).toBeUndefined();
  });

  it('passes through the forced-reasoning observation sentence', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { observation: 'The red region has a soft glow and is brighter than its surroundings — it is genuinely lit.', color: 'red', detail: '' } },
    }));
    const result = await checkLight('file://test.jpg');
    expect(result.observation).toBe('The red region has a soft glow and is brighter than its surroundings — it is genuinely lit.');
  });

  it('returns unclear with the model-provided detail when no light is lit', async () => {
    mockFetch.mockResolvedValue(makeResponse({
      result: { response: { color: 'unclear', detail: 'No illuminated light visible in the photo' } },
    }));
    const result = await checkLight('file://test.jpg');
    expect(result.color).toBe('unclear');
    expect(result.detail).toBe('No illuminated light visible in the photo');
  });

  it('parses a markdown-fenced response the same way as a raw object', async () => {
    const fenced = '```json\n' + JSON.stringify({ color: 'green', detail: '' }) + '\n```';
    mockFetch.mockResolvedValue(makeResponse({ result: { response: fenced } }));
    const result = await checkLight('file://test.jpg');
    expect(result.color).toBe('green');
  });

  it('falls back to unclear (not a throw) on a totally unparseable response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: 'not json at all, sorry' } }));
    const result = await checkLight('file://test.jpg');
    expect(result.color).toBe('unclear');
    expect(result.detail).toBe('Could not clearly identify a lit indicator light.');
  });

  it('falls back to unclear on an out-of-vocabulary color', async () => {
    mockFetch.mockResolvedValue(makeResponse({ result: { response: { color: 'blue', detail: '' } } }));
    const result = await checkLight('file://test.jpg');
    expect(result.color).toBe('unclear');
  });

  it('throws on a non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Unauthorized', false, 401));
    await expect(checkLight('file://test.jpg')).rejects.toThrow('AI proxy error 401');
  });
});
