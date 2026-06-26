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

    it('returns unknown for unrecognized text', () => {
      const result = parseLLMResponse('I cannot determine the state of this food.');
      expect(result.state).toBe('unknown');
    });

    it('sets confidence to 50 on fallback', () => {
      const result = parseLLMResponse('This banana looks ripe.');
      expect(result.confidencePercent).toBe(50);
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
