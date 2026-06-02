import { describe, expect, it } from 'vitest';
import {
  generatePromptWithContext,
  getContextualGreeting,
  getContextualSuggestions,
} from '../chatContextHelpers';

describe('generatePromptWithContext', () => {
  it('returns the raw message when no context is provided', () => {
    expect(generatePromptWithContext({ userMessage: 'Hello' })).toBe('Hello');
  });

  it('returns the raw message for a general context', () => {
    expect(
      generatePromptWithContext({ userMessage: 'Hello', context: { contextType: 'general' } }),
    ).toBe('Hello');
  });

  it('prefixes message with item name for item context', () => {
    const result = generatePromptWithContext({
      userMessage: 'Tell me more',
      context: {
        contextType: 'item',
        itemName: 'Tent',
      },
    });
    expect(result).toBe('[About item: Tent] Tell me more');
  });

  it('returns raw message for item context without an item name', () => {
    const result = generatePromptWithContext({
      userMessage: 'Tell me more',
      context: { contextType: 'item' },
    });
    expect(result).toBe('Tell me more');
  });

  it('prefixes message for pack context', () => {
    const result = generatePromptWithContext({
      userMessage: 'Analyze my pack',
      context: { contextType: 'pack' },
    });
    expect(result).toBe('[About my pack] Analyze my pack');
  });
});

describe('getContextualSuggestions', () => {
  it('returns unauthenticated suggestions when no args provided', () => {
    const suggestions = getContextualSuggestions();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    // unauthenticated suggestions do not include tool-dependent prompts like weather lookups
    expect(suggestions.some((s) => s.toLowerCase().includes('london'))).toBe(false);
  });

  it('returns unauthenticated suggestions when isAuthenticated is false', () => {
    const suggestions = getContextualSuggestions({ isAuthenticated: false });
    expect(suggestions.some((s) => s.toLowerCase().includes('ultralight'))).toBe(true);
  });

  it('returns authenticated general suggestions when isAuthenticated is true', () => {
    const suggestions = getContextualSuggestions({ isAuthenticated: true });
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    // authenticated suggestions include tool-driven prompts like weather
    expect(suggestions.some((s) => s.toLowerCase().includes('weather'))).toBe(true);
  });

  it('returns authenticated suggestions for a general context', () => {
    const suggestions = getContextualSuggestions({
      context: { contextType: 'general' },
      isAuthenticated: true,
    });
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns unauthenticated suggestions for a general context', () => {
    const suggestions = getContextualSuggestions({ context: { contextType: 'general' } });
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns item-specific suggestions with item name', () => {
    const suggestions = getContextualSuggestions({
      context: {
        contextType: 'item',
        itemName: 'Rain Jacket',
      },
    });
    expect(suggestions.some((s) => s.includes('Rain Jacket'))).toBe(true);
  });

  it('returns pack-specific suggestions for pack context', () => {
    const suggestions = getContextualSuggestions({ context: { contextType: 'pack' } });
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('getContextualGreeting', () => {
  it('returns a general greeting when no context is provided', () => {
    const greeting = getContextualGreeting();
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  });

  it('returns a general greeting for general context', () => {
    const greeting = getContextualGreeting({ contextType: 'general' });
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  });

  it('includes the item name in the greeting for item context', () => {
    const greeting = getContextualGreeting({ contextType: 'item', itemName: 'Tent' });
    expect(greeting).toContain('Tent');
  });

  it('returns a pack greeting when pack name is provided', () => {
    const greeting = getContextualGreeting({ contextType: 'pack', packName: 'Weekend Pack' });
    expect(greeting).toContain('Weekend Pack');
  });

  it('returns a fallback greeting for pack context without a pack name', () => {
    const greeting = getContextualGreeting({ contextType: 'pack' });
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  });
});
