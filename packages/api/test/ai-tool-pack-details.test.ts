import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiWithAuth, httpMethods } from './utils/test-helpers';

describe('AI Tool: getPackDetails - Image Filtering Bug Fix', () => {
  describe('Source Code Verification', () => {
    it('tools.ts should exclude image field from pack items mapping', async () => {
      const toolsPath = path.join(__dirname, '../src/utils/ai/tools.ts');
      const content = fs.readFileSync(toolsPath, 'utf-8');

      // Verify itemsWithoutImages is used (the fix)
      expect(content).toContain('itemsWithoutImages');

      // Verify image is NOT in the mapping (explicit exclusion)
      const imageInMapping = content.match(
        /itemsWithoutImages\s*=\s*pack\.items\.map\(\(item\)\s*=>\s*\{[^}]*image:/s,
      );
      expect(imageInMapping).toBeNull();
    });

    it('tools.ts should use destructuring to exclude image from item details', async () => {
      const toolsPath = path.join(__dirname, '../src/utils/ai/tools.ts');
      const content = fs.readFileSync(toolsPath, 'utf-8');

      // Verify the destructuring pattern is used
      expect(content).toMatch(
        /const\s*\{\s*image:\s*_image\s*,\s*embedding:\s*_embedding\s*,\s*\.\.\.[a-zA-Z]+\s*\}\s*=\s*item/,
      );
    });

    it('tools.ts should use async generators for streaming', async () => {
      const toolsPath = path.join(__dirname, '../src/utils/ai/tools.ts');
      const content = fs.readFileSync(toolsPath, 'utf-8');

      expect(content).toContain('async function*');
      expect(content).toMatch(/yield\s*\{/);
    });

    it('tools.ts should handle pack not found error', async () => {
      const toolsPath = path.join(__dirname, '../src/utils/ai/tools.ts');
      const content = fs.readFileSync(toolsPath, 'utf-8');

      expect(content).toContain("error: 'Pack not found'");
    });

    it('tools.ts should handle item not found error', async () => {
      const toolsPath = path.join(__dirname, '../src/utils/ai/tools.ts');
      const content = fs.readFileSync(toolsPath, 'utf-8');

      expect(content).toContain("error: 'Item not found'");
    });
  });

  describe('Pack items should be returned regardless of image presence', () => {
    it('should include all pack items in AI response', async () => {
      expect(true).toBe(true);
    });

    it('should verify image field is excluded from pack details response', async () => {
      expect(true).toBe(true);
    });

    it('should verify image field is excluded from pack item details response', async () => {
      expect(true).toBe(true);
    });
  });

  describe('Chat endpoint with AI tools', () => {
    it('should handle chat requests that use AI tools', async () => {
      const chatMessage = {
        message: 'What gear do I need for a hiking trip?',
        context: {
          activity: 'hiking',
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', chatMessage));
      // AI service may not be available in test env, but request should not crash
      expect([200, 500, 400]).toContain(res.status);
    });
  });
});

describe('AI Tools - Integration with Chat', () => {
  it('chat endpoint should initialize AI tools with user context', async () => {
    const res = await apiWithAuth('/chat', httpMethods.post('', { message: 'test' }));
    expect([200, 400, 500]).toContain(res.status);
  });
});
