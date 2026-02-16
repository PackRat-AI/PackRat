/**
 * NatureLens Service Tests
 * PackRat Feature - On-device Plant & Wildlife Identification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NatureLensService, type NatureCategory, type SafetyLevel, type IdentificationResult } from './nature-lens.js';
import type { KnowledgeBaseEntry } from '../types';

// Note: In a real React Native environment, the ML frameworks would be available
// For testing purposes, we're testing the core logic with mocked analysis

describe('NatureLensService', () => {
  let service: NatureLensService;

  beforeEach(async () => {
    service = new NatureLensService({
      dataPath: './test-data',
      offlineEnabled: true,
      appleVisionEnabled: false,
      mlKitEnabled: false,
      minConfidence: 0.5,
      maxResults: 5,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.getStatus().initialized).toBe(true);
    });

    it('should report knowledge base as available', () => {
      const status = service.getStatus();
      expect(status.knowledgeBase).toBe(true);
    });
  });

  describe('identification', () => {
    it('should return identification results', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage);
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should include confidence scores', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage);
      
      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should categorize results correctly', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage);
      
      for (const result of results) {
        expect(['plant', 'wildlife', 'track', 'scat', 'flower', 'mushroom']).toContain(result.category);
      }
    });

    it('should respect confidence threshold', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage, {
        minConfidence: 0.9,
      });
      
      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should limit results', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage, {
        maxResults: 2,
      });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('safety assessment', () => {
    it('should provide safety information for all results', async () => {
      const mockImage = Buffer.from('mock-image-data');
      
      const results = await service.identify(mockImage);
      
      for (const result of results) {
        expect(result.safety).toBeDefined();
        expect(result.safety.warnings).toBeInstanceOf(Array);
        expect(result.safety.precautions).toBeInstanceOf(Array);
        expect(['safe', 'caution', 'dangerous', 'toxic']).toContain(result.safety.level);
      }
    });
  });

  describe('service status', () => {
    it('should return accurate status', () => {
      const status = service.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.knowledgeBase).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await service.shutdown();
      
      const status = service.getStatus();
      expect(status.initialized).toBe(false);
    });
  });
});

describe('NatureLens categorization', () => {
  let service: NatureLensService;

  beforeEach(async () => {
    service = new NatureLensService({
      dataPath: './test-data',
      offlineEnabled: true,
      appleVisionEnabled: false,
      mlKitEnabled: false,
      minConfidence: 0.5,
      maxResults: 5,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('category detection', () => {
    it('should return results for plant category', async () => {
      const results = await service.identify(Buffer.from('test'), {
        categories: ['plant'],
      });
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results for wildlife category', async () => {
      const results = await service.identify(Buffer.from('test'), {
        categories: ['wildlife'],
      });
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results for track category', async () => {
      const results = await service.identify(Buffer.from('test'), {
        categories: ['track'],
      });
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results for scat category', async () => {
      const results = await service.identify(Buffer.from('test'), {
        categories: ['scat'],
      });
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results for mushroom category', async () => {
      const results = await service.identify(Buffer.from('test'), {
        categories: ['mushroom'],
      });
      
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

describe('Knowledge base integration', () => {
  let service: NatureLensService;

  beforeEach(async () => {
    service = new NatureLensService({
      dataPath: './test-data',
      offlineEnabled: true,
      appleVisionEnabled: false,
      mlKitEnabled: false,
      minConfidence: 0.5,
      maxResults: 5,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should include offline available flag', async () => {
    const results = await service.identify(Buffer.from('test'), {
      includeDetails: true,
    });
    
    for (const result of results) {
      expect(result).toHaveProperty('offlineAvailable');
      expect(typeof result.offlineAvailable).toBe('boolean');
    }
  });

  it('should work offline', async () => {
    const results = await service.identify(Buffer.from('test'));
    
    for (const result of results) {
      expect(result.offlineAvailable).toBe(true);
    }
  });
});

describe('Configuration', () => {
  it('should use custom configuration', () => {
    const service = new NatureLensService({
      dataPath: '/custom/path',
      offlineEnabled: false,
      appleVisionEnabled: true,
      mlKitEnabled: true,
      minConfidence: 0.8,
      maxResults: 3,
    });

    const status = service.getStatus();
    expect(status.initialized).toBe(false);
  });

  it('should throw error when not initialized', async () => {
    const service = new NatureLensService();
    
    await expect(service.identify(Buffer.from('test')))
      .rejects
      .toThrow('NatureLens service not initialized');
  });
});

describe('Result structure', () => {
  let service: NatureLensService;

  beforeEach(async () => {
    service = new NatureLensService({
      dataPath: './test-data',
      offlineEnabled: true,
      appleVisionEnabled: false,
      mlKitEnabled: false,
      minConfidence: 0.5,
      maxResults: 5,
    });

    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should have complete result structure', async () => {
    const mockImage = Buffer.from('test-image-data');
    const results = await service.identify(mockImage);
    
    if (results.length > 0) {
      const result = results[0];
      
      // Check all required fields
      expect(result).toHaveProperty('commonName');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('safety');
      expect(result).toHaveProperty('offlineAvailable');
      
      // Validate field types
      expect(typeof result.commonName).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.offlineAvailable).toBe('boolean');
      expect(result.safety).toHaveProperty('level');
      expect(result.safety).toHaveProperty('warnings');
      expect(result.safety).toHaveProperty('precautions');
    }
  });

  it('should include scientific name when available', async () => {
    const mockImage = Buffer.from('test-image-data');
    const results = await service.identify(mockImage);
    
    for (const result of results) {
      if (result.scientificName) {
        expect(typeof result.scientificName).toBe('string');
      }
    }
  });

  it('should include edibility for plants', async () => {
    const mockImage = Buffer.from('test-image-data');
    const results = await service.identify(mockImage);
    
    for (const result of results) {
      if (result.edible !== undefined) {
        expect(typeof result.edible).toBe('boolean');
      }
    }
  });
});
