// Tests for apps/expo/utils/format-ai-response.ts
// See also: packages/api/src/utils/__tests__/format-ai-response.test.ts for the API variant
import { describe, expect, it } from 'vitest';
import { formatAIResponse } from '../format-ai-response';

describe('formatAIResponse', () => {
  it('returns empty string for an empty input', () => {
    expect(formatAIResponse('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(formatAIResponse('Hello world')).toBe('Hello world');
  });

  it('converts markdown bullet lists (- prefix) to • bullets', () => {
    const input = '- First item\n- Second item';
    const result = formatAIResponse(input);
    expect(result).toContain('• First item');
    expect(result).toContain('• Second item');
    expect(result).not.toContain('- First');
  });

  it('converts markdown bullet lists (* prefix) to • bullets', () => {
    const input = '* First item\n* Second item';
    const result = formatAIResponse(input);
    expect(result).toContain('• First item');
    expect(result).toContain('• Second item');
  });

  it('adds line breaks after sentence-ending punctuation followed by a capital letter', () => {
    const result = formatAIResponse('First sentence. Second sentence.');
    expect(result).toContain('\n\n');
  });

  it('strips bold markdown (**text**)', () => {
    const result = formatAIResponse('This is **bold** text.');
    expect(result).not.toContain('**');
    expect(result).toContain('bold');
  });

  it('strips italic markdown (*text*)', () => {
    const result = formatAIResponse('This is *italic* text.');
    expect(result).not.toContain('*italic*');
    expect(result).toContain('italic');
  });

  it('strips markdown headers (# Header)', () => {
    const result = formatAIResponse('# Main Title\n## Sub Title');
    expect(result).not.toContain('#');
    expect(result).toContain('Main Title');
    expect(result).toContain('Sub Title');
  });

  it('trims leading and trailing whitespace', () => {
    const result = formatAIResponse('  Hello world  ');
    expect(result).toBe('Hello world');
  });

  it('handles a complex mixed-format response', () => {
    const input = [
      '# Gear Recommendations',
      '',
      'Here are your top picks.',
      '',
      '- **Tent**: A lightweight option',
      '- *Sleeping bag*: Rated to 20°F',
    ].join('\n');

    const result = formatAIResponse(input);
    expect(result).not.toContain('#');
    expect(result).not.toContain('**');
    expect(result).toContain('Gear Recommendations');
    expect(result).toContain('• Tent');
    expect(result).toContain('• Sleeping bag');
  });
});
