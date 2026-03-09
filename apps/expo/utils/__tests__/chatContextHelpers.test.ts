import { describe, expect, it } from 'vitest';
import { generatePromptWithContext, getContextualSuggestions } from '../chatContextHelpers';

describe('generatePromptWithContext', () => {
  it('returns the raw message when no context is provided', () => {
    expect(generatePromptWithContext('Hello')).toBe('Hello');
  });

  it('returns the raw message for a general context', () => {
    expect(generatePromptWithContext('Hello', { contextType: 'general' })).toBe('Hello');
  });

  it('prefixes message with item name for item context', () => {
    const result = generatePromptWithContext('Tell me more', {
      contextType: 'item',
      itemName: 'Tent',
    });
    expect(result).toBe('[About item: Tent] Tell me more');
  });

  it('returns raw message for item context without an item name', () => {
    const result = generatePromptWithContext('Tell me more', { contextType: 'item' });
    expect(result).toBe('Tell me more');
  });

  it('prefixes message for pack context', () => {
    const result = generatePromptWithContext('Analyze my pack', { contextType: 'pack' });
    expect(result).toBe('[About my pack] Analyze my pack');
  });
});

describe('getContextualSuggestions', () => {
  it('returns general suggestions when no context is provided', () => {
    const suggestions = getContextualSuggestions();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns general suggestions for a general context', () => {
    const suggestions = getContextualSuggestions({ contextType: 'general' });
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns item-specific suggestions with item name', () => {
    const suggestions = getContextualSuggestions({
      contextType: 'item',
      itemName: 'Rain Jacket',
    });
    expect(suggestions.some((s) => s.includes('Rain Jacket'))).toBe(true);
  });

  it('returns pack-specific suggestions for pack context', () => {
    const suggestions = getContextualSuggestions({ contextType: 'pack' });
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
