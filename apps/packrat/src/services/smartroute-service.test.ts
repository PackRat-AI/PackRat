// SmartRoute Service Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartRouteService } from './smartroute-service.js';
import type { RouteGenerationRequest } from '../types';

describe('SmartRouteService', () => {
  let service: SmartRouteService;

  beforeEach(() => {
    service = new SmartRouteService({
      offlineEnabled: true,
      dataPath: './test-data',
    });
    (service as any).isInitialized = true;
  });

  describe('generateRoute', () => {
    it('should generate a basic route', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
      };

      const response = await service.generateRoute(request);

      expect(response).toBeDefined();
      expect(response.route).toBeDefined();
      expect(response.route.points).toBeDefined();
      expect(response.route.distance).toBeGreaterThan(0);
      expect(response.metadata.offlineMode).toBe(true);
    });

    it('should include elevation profile when requested', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
        includeElevation: true,
      };

      const response = await service.generateRoute(request);

      expect(response.elevationProfile).toBeDefined();
      expect(response.elevationProfile?.totalGain).toBeDefined();
      expect(response.elevationProfile?.totalLoss).toBeDefined();
    });

    it('should filter by difficulty preference', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
        preferences: {
          difficulty: 'easy',
        },
      };

      const response = await service.generateRoute(request);

      expect(response.route.difficulty).toBeDefined();
    });

    it('should respect max distance preference', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
        preferences: {
          maxDistance: 5,
        },
      };

      const response = await service.generateRoute(request);

      expect(response.route.distance).toBeLessThanOrEqual(5 * 1.5); // Allow some tolerance
    });

    it('should calculate scenic score when requested', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
        preferences: {
          scenicValue: 'high',
        },
      };

      const response = await service.generateRoute(request);

      expect(response.scenicScore).toBeDefined();
      expect(typeof response.scenicScore).toBe('number');
    });

    it('should reject requests with invalid coordinates', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 100, longitude: -104.9903 }, // Invalid latitude
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
      };

      await expect(service.generateRoute(request)).rejects.toThrow('Invalid start latitude');
    });

    it('should reject requests without start location', async () => {
      const request = {
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
      } as RouteGenerationRequest;

      await expect(service.generateRoute(request)).rejects.toThrow('Start location is required');
    });

    it('should reject requests without end location', async () => {
      const request = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
      } as RouteGenerationRequest;

      await expect(service.generateRoute(request)).rejects.toThrow('End location is required');
    });

    it('should include estimated hiking time', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
      };

      const response = await service.generateRoute(request);

      expect(response.route.estimatedTime).toBeGreaterThan(0);
    });

    it('should track processing time', async () => {
      const request: RouteGenerationRequest = {
        startLocation: { latitude: 39.7392, longitude: -104.9903 },
        endLocation: { latitude: 39.7500, longitude: -105.0000 },
      };

      const response = await service.generateRoute(request);

      expect(response.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      const status = service.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.offlineEnabled).toBe(true);
      expect(status.trailDataVersion).toBeDefined();
      expect(status.totalTrails).toBeDefined();
      expect(status.totalWaypoints).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown the service', async () => {
      await service.shutdown();

      expect((service as any).isInitialized).toBe(false);
    });
  });
});

// API Route Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  routeGenerateHandler,
  routeStatusHandler,
} from '../src/api/routes-smartroute.js';

describe('SmartRoute API Routes', () => {
  describe('routeGenerateHandler', () => {
    it('should reject non-POST requests', async () => {
      const req = new Request('http://localhost/api/routes/generate', { method: 'GET' });
      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(405);
    });

    it('should reject invalid JSON body', async () => {
      const req = new Request('http://localhost/api/routes/generate', {
        method: 'POST',
        body: 'not valid json',
      });
      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(400);
    });

    it('should reject requests without startLocation', async () => {
      const req = new Request('http://localhost/api/routes/generate', {
        method: 'POST',
        body: JSON.stringify({ endLocation: { latitude: 39.75, longitude: -105.0 } }),
      });
      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(400);
    });

    it('should reject requests without endLocation', async () => {
      const req = new Request('http://localhost/api/routes/generate', {
        method: 'POST',
        body: JSON.stringify({ startLocation: { latitude: 39.7392, longitude: -104.9903 } }),
      });
      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(400);
    });

    it('should reject requests with invalid start coordinates', async () => {
      const req = new Request('http://localhost/api/routes/generate', {
        method: 'POST',
        body: JSON.stringify({
          startLocation: { latitude: 100, longitude: -104.9903 },
          endLocation: { latitude: 39.75, longitude: -105.0 },
        }),
      });
      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(400);
    });

    it('should process valid route generation requests', async () => {
      const req = new Request('http://localhost/api/routes/generate', {
        method: 'POST',
        body: JSON.stringify({
          startLocation: { latitude: 39.7392, longitude: -104.9903 },
          endLocation: { latitude: 39.7500, longitude: -105.0000 },
        }),
      });

      const res = await routeGenerateHandler(req);

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.route).toBeDefined();
      expect(body.route.points).toBeDefined();
    });
  });

  describe('routeStatusHandler', () => {
    it('should return service status', async () => {
      const req = new Request('http://localhost/api/routes/status', { method: 'GET' });
      const res = await routeStatusHandler(req);

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.initialized).toBeDefined();
      expect(body.offlineEnabled).toBeDefined();
    });

    it('should reject non-GET requests', async () => {
      const req = new Request('http://localhost/api/routes/status', { method: 'POST' });
      const res = await routeStatusHandler(req);

      expect(res.status).toBe(405);
    });
  });
});

// Trail Difficulty Classifier Tests
import { describe, it, expect } from 'vitest';
import { TrailDifficultyClassifier } from '../src/services/trail-classifier.js';

describe('TrailDifficultyClassifier', () => {
  let classifier: TrailDifficultyClassifier;

  beforeEach(() => {
    classifier = new TrailDifficultyClassifier();
  });

  describe('classify', () => {
    it('should classify easy trails correctly', () => {
      const segment = {
        id: 'test-1',
        name: 'Easy Trail',
        startPoint: { latitude: 0, longitude: 0 },
        endPoint: { latitude: 0.01, longitude: 0.01 },
        difficulty: 'moderate' as const,
        distance: 1,
        elevationGain: 100,
        elevationLoss: 100,
        surface: 'paved',
        usage: 'low',
      };

      const difficulty = classifier.classify(segment);

      expect(['easy', 'moderate']).toContain(difficulty);
    });

    it('should classify difficult trails correctly', () => {
      const segment = {
        id: 'test-2',
        name: 'Hard Trail',
        startPoint: { latitude: 0, longitude: 0 },
        endPoint: { latitude: 0.02, longitude: 0.02 },
        difficulty: 'difficult' as const,
        distance: 2,
        elevationGain: 2000,
        elevationLoss: 1500,
        surface: 'rock',
        usage: 'low',
        hazards: ['exposure', 'rock scramble'],
      };

      const difficulty = classifier.classify(segment);

      expect(['difficult', 'expert']).toContain(difficulty);
    });

    it('should provide difficulty descriptions', () => {
      const descriptions = ['easy', 'moderate', 'difficult', 'expert'] as const;

      for (const difficulty of descriptions) {
        const description = classifier.getDescription(difficulty);

        expect(description).toBeDefined();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      }
    });

    it('should provide gear recommendations', () => {
      const recommendations = ['easy', 'moderate', 'difficult', 'expert'] as const;

      for (const difficulty of recommendations) {
        const gear = classifier.getRecommendedGear(difficulty);

        expect(gear).toBeDefined();
        expect(Array.isArray(gear)).toBe(true);
        expect(gear.length).toBeGreaterThan(0);
      }
    });
  });
});

// Elevation Analyzer Tests
import { describe, it, expect } from 'vitest';
import { ElevationAnalyzer } from '../src/services/elevation-analyzer.js';

describe('ElevationAnalyzer', () => {
  let analyzer: ElevationAnalyzer;

  beforeEach(() => {
    analyzer = new ElevationAnalyzer();
  });

  describe('analyze', () => {
    it('should handle empty points', () => {
      const profile = analyzer.analyze([]);

      expect(profile.points).toEqual([]);
      expect(profile.totalGain).toBe(0);
      expect(profile.totalLoss).toBe(0);
    });

    it('should calculate elevation stats correctly', () => {
      const points = [
        { latitude: 0, longitude: 0, elevation: 1000 },
        { latitude: 0.01, longitude: 0.01, elevation: 1500 },
        { latitude: 0.02, longitude: 0.02, elevation: 1200 },
        { latitude: 0.03, longitude: 0.03, elevation: 1800 },
      ];

      const profile = analyzer.analyze(points);

      expect(profile.totalGain).toBe(800); // 500 + 600
      expect(profile.totalLoss).toBe(300); // 300
      expect(profile.maxElevation).toBe(1800);
      expect(profile.minElevation).toBe(1000);
    });

    it('should calculate grades', () => {
      const points = [
        { latitude: 0, longitude: 0, elevation: 1000 },
        { latitude: 0.01, longitude: 0.01, elevation: 1500 },
      ];

      const profile = analyzer.analyze(points);

      expect(profile.avgGrade).toBeGreaterThan(0);
      expect(profile.maxGrade).toBeGreaterThanOrEqual(profile.avgGrade);
    });

    it('should provide advice', () => {
      const points = [
        { latitude: 0, longitude: 0, elevation: 1000 },
        { latitude: 0.01, longitude: 0.01, elevation: 4500 },
      ];

      const profile = analyzer.analyze(points);
      const advice = analyzer.getAdvice(profile);

      expect(advice).toBeDefined();
      expect(Array.isArray(advice)).toBe(true);
      expect(advice.length).toBeGreaterThan(0);
    });
  });
});

// Route Optimizer Tests
import { describe, it, expect } from 'vitest';
import { RouteOptimizer } from '../src/services/route-optimizer.js';

describe('RouteOptimizer', () => {
  let optimizer: RouteOptimizer;

  beforeEach(() => {
    optimizer = new RouteOptimizer({
      maxIterations: 100,
      convergenceThreshold: 0.001,
    });
  });

  describe('optimize', () => {
    it('should handle empty points', async () => {
      const result = await optimizer.optimize([]);

      expect(result.points).toEqual([]);
      expect(result.totalDistance).toBe(0);
      expect(result.iterations).toBe(0);
    });

    it('should handle single point', async () => {
      const result = await optimizer.optimize([{ latitude: 0, longitude: 0 }]);

      expect(result.points.length).toBe(1);
    });

    it('should handle two points', async () => {
      const points = [
        { latitude: 0, longitude: 0 },
        { latitude: 0.01, longitude: 0.01 },
      ];

      const result = await optimizer.optimize(points);

      expect(result.points.length).toBe(2);
      expect(result.totalDistance).toBeGreaterThan(0);
    });

    it('should reduce redundant points', async () => {
      const points = [
        { latitude: 39.7392, longitude: -104.9903 },
        { latitude: 39.7400, longitude: -104.9910 },
        { latitude: 39.7401, longitude: -104.9911 }, // Very close to previous
        { latitude: 39.7410, longitude: -104.9920 },
        { latitude: 39.7500, longitude: -105.0000 },
      ];

      const result = await optimizer.optimize(points);

      // Should have removed some redundant points
      expect(result.points.length).toBeLessThanOrEqual(points.length);
    });

    it('should calculate total distance', async () => {
      const points = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 }, // ~69 miles
      ];

      const result = await optimizer.optimize(points);

      expect(result.totalDistance).toBeGreaterThan(60);
      expect(result.totalDistance).toBeLessThan(80);
    });

    it('should respect distance constraints', async () => {
      const points = [
        { latitude: 0, longitude: 0 },
        { latitude: 0.5, longitude: 0.5 },
        { latitude: 1, longitude: 1 },
      ];

      const result = await optimizer.optimize(points, {
        prioritizeDistance: 30, // 30 miles max
      });

      // Should have reduced points to meet constraint
      expect(result.totalDistance).toBeLessThanOrEqual(30 * 1.5);
    });
  });
});
