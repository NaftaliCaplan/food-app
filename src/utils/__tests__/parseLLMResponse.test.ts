import { parseLLMResponse } from '../parseLLMResponse';

describe('parseLLMResponse', () => {
  describe('JSON parsing', () => {
    it('parses a clean JSON response', () => {
      const raw = JSON.stringify({
        state: 'ripe',
        stateLabel: 'Ripe',
        confidencePercent: 85,
        visualCues: ['Yellow skin', 'Brown spots'],
        recommendation: 'Eat today.',
      });

      const result = parseLLMResponse(raw);
      expect(result.state).toBe('ripe');
      expect(result.stateLabel).toBe('Ripe');
      expect(result.confidencePercent).toBe(85);
      expect(result.visualCues).toEqual(['Yellow skin', 'Brown spots']);
      expect(result.recommendation).toBe('Eat today.');
    });

    it('strips markdown code fences before parsing', () => {
      const raw = '```json\n{"state":"unripe","stateLabel":"Not ready yet","confidencePercent":70,"visualCues":["Green skin"],"recommendation":"Wait 2 days."}\n```';
      const result = parseLLMResponse(raw);
      expect(result.state).toBe('unripe');
    });

    it('strips plain code fences before parsing', () => {
      const raw = '```\n{"state":"overripe","stateLabel":"Past its prime","confidencePercent":90,"visualCues":[],"recommendation":"Discard."}\n```';
      const result = parseLLMResponse(raw);
      expect(result.state).toBe('overripe');
    });

    it('falls back to unknown state if state field is missing', () => {
      const raw = JSON.stringify({
        stateLabel: 'Ripe',
        confidencePercent: 80,
        visualCues: [],
        recommendation: '',
      });
      const result = parseLLMResponse(raw);
      expect(result.state).toBe('unknown');
    });

    it('falls back to 50 confidence if confidencePercent is missing', () => {
      const raw = JSON.stringify({ state: 'ripe', visualCues: [], recommendation: '' });
      const result = parseLLMResponse(raw);
      expect(result.confidencePercent).toBe(50);
    });

    it('returns empty array if visualCues is missing', () => {
      const raw = JSON.stringify({ state: 'ripe', confidencePercent: 80, recommendation: '' });
      const result = parseLLMResponse(raw);
      expect(result.visualCues).toEqual([]);
    });

    it('passes observedFood through when present', () => {
      const raw = JSON.stringify({
        state: 'ripe',
        confidencePercent: 80,
        visualCues: [],
        recommendation: '',
        observedFood: 'a yellow banana',
      });
      const result = parseLLMResponse(raw);
      expect(result.observedFood).toBe('a yellow banana');
    });

    it('omits observedFood entirely when not present in the response', () => {
      const raw = JSON.stringify({ state: 'ripe', confidencePercent: 80, visualCues: [], recommendation: '' });
      const result = parseLLMResponse(raw);
      expect(result.observedFood).toBeUndefined();
    });

    it('falls through to keyword parsing when the braces contain invalid JSON', () => {
      // Looks JSON-shaped (passes the {...} regex) but isn't valid JSON, so
      // JSON.parse throws and the catch{} must fall through to the keyword
      // fallback below rather than propagating the error.
      const raw = 'The food looks ripe and ready. {not: valid, json}';
      const result = parseLLMResponse(raw);
      expect(result.state).toBe('ripe');
    });
  });

  describe('keyword fallback parsing', () => {
    it('detects ripe from plain text', () => {
      const result = parseLLMResponse('This banana looks ripe and ready to eat.');
      expect(result.state).toBe('ripe');
    });

    it('detects unripe from plain text', () => {
      const result = parseLLMResponse('The avocado is not ripe yet, still firm.');
      expect(result.state).toBe('unripe');
    });

    it('detects overripe from plain text', () => {
      const result = parseLLMResponse('This mango is overripe and mushy.');
      expect(result.state).toBe('overripe');
    });

    it('detects well-done from plain text', () => {
      const result = parseLLMResponse('The steak appears well done throughout.');
      expect(result.state).toBe('well-done');
    });

    it('detects medium-rare from plain text', () => {
      const result = parseLLMResponse('The beef looks medium rare with a pink center.');
      expect(result.state).toBe('medium-rare');
    });

    it('detects raw from plain text', () => {
      const result = parseLLMResponse('The chicken is raw and should not be eaten.');
      expect(result.state).toBe('raw');
    });

    it('detects almost_ready from plain text', () => {
      const result = parseLLMResponse('This avocado is almost ready, just a day or two more.');
      expect(result.state).toBe('almost_ready');
    });

    it('detects use_soon from plain text', () => {
      const result = parseLLMResponse('This bread should use soon before it goes stale.');
      expect(result.state).toBe('use_soon');
    });

    it('returns unknown for unrecognized text', () => {
      const result = parseLLMResponse('I cannot determine the state of this food.');
      expect(result.state).toBe('unknown');
    });

    it('sets confidence to 50 on fallback', () => {
      const result = parseLLMResponse('This banana looks ripe.');
      expect(result.confidencePercent).toBe(50);
    });

    it('extracts a confidence percentage from prose when present', () => {
      const result = parseLLMResponse('This banana looks ripe. Confidence Percent: 85%');
      expect(result.confidencePercent).toBe(85);
    });

    it('extracts bullet-point visual cues, capped at 3', () => {
      const raw = [
        'This banana looks ripe.',
        '* Yellow skin with brown spots',
        '* Soft to the touch',
        '* Sweet smell',
        '* Fourth cue that should be dropped',
      ].join('\n');
      const result = parseLLMResponse(raw);
      expect(result.visualCues).toEqual([
        'Yellow skin with brown spots',
        'Soft to the touch',
        'Sweet smell',
      ]);
    });

    it('returns no visual cues when there are no bullet points', () => {
      const result = parseLLMResponse('This banana looks ripe with no bullets at all.');
      expect(result.visualCues).toEqual([]);
    });

    it('extracts a recommendation after the word "Recommendation"', () => {
      const result = parseLLMResponse('This banana looks ripe. Recommendation: Eat it today for best flavor.');
      expect(result.recommendation).toBe('Eat it today for best flavor.');
    });

    it('truncates an extracted recommendation to 200 characters', () => {
      const longRec = 'x'.repeat(250);
      const result = parseLLMResponse(`This banana looks ripe. Recommendation: ${longRec}`);
      expect(result.recommendation.length).toBe(200);
    });

    it('falls back to the first 150 characters of raw text when there is no "Recommendation" label', () => {
      const raw = 'y'.repeat(200);
      const result = parseLLMResponse(raw);
      expect(result.recommendation).toBe(raw.slice(0, 150));
    });
  });

  describe('doneness states', () => {
    it('parses rare', () => {
      const raw = JSON.stringify({ state: 'rare', stateLabel: 'Rare', confidencePercent: 75, visualCues: [], recommendation: '' });
      expect(parseLLMResponse(raw).state).toBe('rare');
    });

    it('parses medium', () => {
      const raw = JSON.stringify({ state: 'medium', stateLabel: 'Medium', confidencePercent: 80, visualCues: [], recommendation: '' });
      expect(parseLLMResponse(raw).state).toBe('medium');
    });
  });
});
