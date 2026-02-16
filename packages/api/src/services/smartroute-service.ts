// SmartRoute AI Service
// Offline route generation and optimization

import type {
  RouteGenerationRequest,
  RouteGenerationResponse,
  TrailSegment,
  TrailDifficulty,
  RoutePoint,
  OfflineTrailData,
  SmartRouteConfig,
} from '../types';
import { TrailDifficultyClassifier } from './trail-classifier.js';
import { ElevationAnalyzer } from './elevation-analyzer.js';
import { RouteOptimizer } from './route-optimizer.js';

/**
 * SmartRoute AI Service
 * Handles offline route generation, optimization, and trail analysis
 */
export class SmartRouteService {
  private trailData: OfflineTrailData;
  private classifier: TrailDifficultyClassifier;
  private elevationAnalyzer: ElevationAnalyzer;
  private optimizer: RouteOptimizer;
  private config: SmartRouteConfig;
  private isInitialized = false;

  constructor(config?: Partial<SmartRouteConfig>) {
    this.config = {
      dataPath: config?.dataPath || './data',
      offlineEnabled: config?.offlineEnabled ?? true,
      maxRoutePoints: config?.maxRoutePoints || 1000,
      elevationSmoothing: config?.elevationSmoothing || true,
      shadeOptimization: config?.shadeOptimization ?? true,
      waterSourceAwareness: config?.waterSourceAwareness ?? true,
    };

    this.trailData = {
      version: '1.0.0',
      trails: [],
      waypoints: [],
      waterSources: [],
      shadeAreas: [],
      lastUpdated: new Date().toISOString(),
    };

    this.classifier = new TrailDifficultyClassifier();
    this.elevationAnalyzer = new ElevationAnalyzer();
    this.optimizer = new RouteOptimizer({
      maxIterations: config?.maxIterations || 1000,
      convergenceThreshold: config?.convergenceThreshold || 0.001,
    });
  }

  /**
   * Initialize the SmartRoute service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[SmartRoute] Initializing service...');

    // Load offline trail data
    await this.loadTrailData();

    this.isInitialized = true;
    console.log('[SmartRoute] Service ready');
  }

  /**
   * Load offline trail data
   */
  private async loadTrailData(): Promise<void> {
    try {
      // In a real implementation, this would load from local storage
      // For now, we initialize with empty data
      console.log('[SmartRoute] Loading offline trail data...');
      this.trailData = this.getDefaultTrailData();
    } catch (error) {
      console.error('[SmartRoute] Failed to load trail data:', error);
      throw error;
    }
  }

  /**
   * Generate a route based on request parameters
   */
  async generateRoute(request: RouteGenerationRequest): Promise<RouteGenerationResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Validate input
      this.validateRequest(request);

      // Find starting point
      const startPoint = this.findNearestWaypoint(
        request.startLocation.latitude,
        request.startLocation.longitude
      );

      // Find destination point
      const endPoint = this.findNearestWaypoint(
        request.endLocation.latitude,
        request.endLocation.longitude
      );

      // Get available trail segments between points
      const segments = this.findPathSegments(startPoint, endPoint);

      // Filter by difficulty preference
      const filteredSegments = this.filterByDifficulty(segments, request.preferences.difficulty);

      // Optimize route based on preferences
      const optimizedRoute = await this.optimizeRoute(
        filteredSegments,
        request.preferences
      );

      // Analyze elevation profile
      const elevationProfile = this.elevationAnalyzer.analyze(optimizedRoute.points);

      // Calculate scenic value if requested
      let scenicScore: number | undefined;
      if (request.preferences.scenicValue) {
        scenicScore = this.calculateScenicScore(optimizedRoute, request.preferences.scenicValue);
      }

      // Calculate water source proximity if requested
      let waterProximity: number | undefined;
      if (this.config.waterSourceAwareness && request.preferences.waterSources) {
        waterProximity = this.calculateWaterProximity(optimizedRoute);
      }

      // Calculate shade coverage if requested
      let shadeCoverage: number | undefined;
      if (this.config.shadeOptimization && request.preferences.shadeCoverage) {
        shadeCoverage = this.calculateShadeCoverage(optimizedRoute);
      }

      return {
        route: {
          points: optimizedRoute.points,
          distance: optimizedRoute.totalDistance,
          elevationGain: elevationProfile.totalGain,
          elevationLoss: elevationProfile.totalLoss,
          estimatedTime: this.estimateHikingTime(optimizedRoute, request.preferences),
          difficulty: this.classifyOverallDifficulty(optimizedRoute, request.preferences),
          waypoints: optimizedRoute.waypoints,
          hazards: optimizedRoute.hazards,
          waterSources: optimizedRoute.waterSources,
        },
        elevationProfile: {
          points: elevationProfile.points,
          totalGain: elevationProfile.totalGain,
          totalLoss: elevationProfile.totalLoss,
          maxElevation: elevationProfile.maxElevation,
          minElevation: elevationProfile.minElevation,
          avgGrade: elevationProfile.avgGrade,
          maxGrade: elevationProfile.maxGrade,
        },
        scenicScore,
        waterProximity,
        shadeCoverage,
        metadata: {
          generatedAt: new Date().toISOString(),
          offlineMode: true,
          dataVersion: this.trailData.version,
          optimizationIterations: optimizedRoute.iterations,
        },
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[SmartRoute] Route generation failed:', error);
      throw error;
    }
  }

  /**
   * Validate route generation request
   */
  private validateRequest(request: RouteGenerationRequest): void {
    if (!request.startLocation) {
      throw new Error('Start location is required');
    }
    if (!request.endLocation) {
      throw new Error('End location is required');
    }

    const { latitude: startLat, longitude: startLon } = request.startLocation;
    const { latitude: endLat, longitude: endLon } = request.endLocation;

    if (startLat < -90 || startLat > 90) {
      throw new Error('Invalid start latitude');
    }
    if (startLon < -180 || startLon > 180) {
      throw new Error('Invalid start longitude');
    }
    if (endLat < -90 || endLat > 90) {
      throw new Error('Invalid end latitude');
    }
    if (endLon < -180 || endLon > 180) {
      throw new Error('Invalid end longitude');
    }

    // Validate preferences
    if (request.preferences) {
      if (request.preferences.maxDistance && request.preferences.maxDistance < 0) {
        throw new Error('Max distance must be positive');
      }
      if (request.preferences.maxElevationGain && request.preferences.maxElevationGain < 0) {
        throw new Error('Max elevation gain must be positive');
      }
    }
  }

  /**
   * Find nearest waypoint to coordinates
   */
  private findNearestWaypoint(lat: number, lon: number): RoutePoint {
    const point: RoutePoint = {
      latitude: lat,
      longitude: lon,
      elevation: 0,
      type: 'waypoint',
    };

    // Find actual trail waypoint if available
    let nearest = point;
    let minDistance = Infinity;

    for (const waypoint of this.trailData.waypoints) {
      const distance = this.calculateDistance(lat, lon, waypoint.latitude, waypoint.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = waypoint;
      }
    }

    return nearest;
  }

  /**
   * Find trail segments between two points
   */
  private findPathSegments(start: RoutePoint, end: RoutePoint): TrailSegment[] {
    // Simple implementation - in real app would use graph traversal
    const segments: TrailSegment[] = [];

    // Find trails near start and end points
    for (const trail of this.trailData.trails) {
      const startDist = this.calculateDistance(
        start.latitude, start.longitude,
        trail.startLat, trail.startLon
      );
      const endDist = this.calculateDistance(
        end.latitude, end.longitude,
        trail.endLat, trail.endLon
      );

      // If trail connects near start or end, include it
      if (startDist < 10 || endDist < 10) {
        segments.push({
          id: trail.id,
          name: trail.name,
          startPoint: { latitude: trail.startLat, longitude: trail.startLon },
          endPoint: { latitude: trail.endLat, longitude: trail.endLon },
          difficulty: trail.difficulty,
          distance: trail.distance,
          elevationGain: trail.elevationGain,
          elevationLoss: trail.elevationLoss,
          surface: trail.surface,
          usage: trail.usage,
          seasonal: trail.seasonal,
          hazards: trail.hazards || [],
          waterSources: trail.waterSources || [],
        });
      }
    }

    // Add direct segment if no trails found
    if (segments.length === 0) {
      segments.push({
        id: 'direct',
        name: 'Direct Route',
        startPoint: start,
        endPoint: end,
        difficulty: 'moderate',
        distance: this.calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude),
        elevationGain: Math.abs((end.elevation || 0) - (start.elevation || 0)),
        elevationLoss: 0,
        surface: 'trail',
        usage: 'moderate',
        hazards: [],
        waterSources: [],
      });
    }

    return segments;
  }

  /**
   * Filter segments by difficulty preference
   */
  private filterByDifficulty(
    segments: TrailSegment[],
    difficulty?: TrailDifficulty
  ): TrailSegment[] {
    if (!difficulty) return segments;

    const difficultyOrder: TrailDifficulty[] = ['easy', 'moderate', 'difficult', 'expert'];
    const maxIndex = difficultyOrder.indexOf(difficulty);

    return segments.filter(seg => {
      const segIndex = difficultyOrder.indexOf(seg.difficulty);
      return segIndex <= maxIndex;
    });
  }

  /**
   * Optimize route based on preferences
   */
  private async optimizeRoute(
    segments: TrailSegment[],
    preferences: RouteGenerationRequest['preferences']
  ): Promise<{
    points: RoutePoint[];
    totalDistance: number;
    waypoints: string[];
    hazards: string[];
    waterSources: string[];
    iterations: number;
  }> {
    // Collect all points from segments
    const allPoints: RoutePoint[] = [];

    for (const segment of segments) {
      allPoints.push(segment.startPoint);
      allPoints.push(segment.endPoint);
    }

    // Add waypoints from trail data
    const waypointNames: string[] = [];
    for (const waypoint of this.trailData.waypoints) {
      allPoints.push(waypoint);
      if (waypoint.name) {
        waypointNames.push(waypoint.name);
      }
    }

    // Optimize using route optimizer
    const optimized = await this.optimizer.optimize(allPoints, {
      prioritizeDistance: preferences.maxDistance,
      prioritizeElevation: preferences.maxElevationGain,
      scenicValue: preferences.scenicValue,
    });

    // Collect hazards and water sources
    const hazards: string[] = [];
    const waterSourceNames: string[] = [];

    for (const segment of segments) {
      for (const hazard of segment.hazards) {
        if (!hazards.includes(hazard)) {
          hazards.push(hazard);
        }
      }
      for (const water of segment.waterSources) {
        if (!waterSourceNames.includes(water)) {
          waterSourceNames.push(water);
        }
      }
    }

    return {
      points: optimized.points.slice(0, this.config.maxRoutePoints),
      totalDistance: optimized.totalDistance,
      waypoints: waypointNames,
      hazards,
      waterSources: waterSourceNames,
      iterations: optimized.iterations,
    };
  }

  /**
   * Calculate scenic score for route
   */
  private calculateScenicScore(
    route: { points: RoutePoint[] },
    targetLevel: 'low' | 'medium' | 'high'
  ): number {
    // Simplified scenic scoring based on point variety
    const latVariance = this.calculateVariance(route.points.map(p => p.latitude));
    const lonVariance = this.calculateVariance(route.points.map(p => p.longitude));

    const score = Math.sqrt(latVariance + lonVariance) * 1000;

    const targetScores = { low: 30, medium: 50, high: 70 };
    const target = targetScores[targetLevel];

    // Normalize to 0-100
    return Math.min(100, Math.max(0, (score / target) * 50));
  }

  /**
   * Calculate water source proximity
   */
  private calculateWaterProximity(route: { points: RoutePoint[] }): number {
    let totalDistance = 0;
    let pointCount = 0;

    for (const point of route.points) {
      let minDist = Infinity;

      for (const water of this.trailData.waterSources) {
        const dist = this.calculateDistance(
          point.latitude, point.longitude,
          water.latitude, water.longitude
        );
        minDist = Math.min(minDist, dist);
      }

      totalDistance += minDist;
      pointCount++;
    }

    // Average distance to nearest water source (in miles)
    return totalDistance / pointCount;
  }

  /**
   * Calculate shade coverage
   */
  private calculateShadeCoverage(route: { points: RoutePoint[] }): number {
    let shadedPoints = 0;

    for (const point of route.points) {
      for (const shade of this.trailData.shadeAreas) {
        const dist = this.calculateDistance(
          point.latitude, point.longitude,
          shade.latitude, shade.longitude
        );
        if (dist < shade.radius) {
          shadedPoints++;
          break;
        }
      }
    }

    return (shadedPoints / route.points.length) * 100;
  }

  /**
   * Estimate hiking time for route
   */
  private estimateHikingTime(
    route: { totalDistance: number; elevationGain: number },
    preferences: RouteGenerationRequest['preferences']
  ): number {
    // Naismith's rule: 1 hour per 3 miles + 1 hour per 2000 ft elevation gain
    const baseHours = route.totalDistance / 3;
    const elevationHours = route.elevationGain / 2000;

    // Adjust for difficulty
    const difficultyMultipliers: Record<TrailDifficulty, number> = {
      easy: 0.8,
      moderate: 1.0,
      difficult: 1.3,
      expert: 1.6,
    };

    const multiplier = difficultyMultipliers[this.classifyOverallDifficulty(route as any, preferences)] || 1.0;

    return Math.round((baseHours + elevationHours) * multiplier * 60); // Return minutes
  }

  /**
   * Classify overall route difficulty
   */
  private classifyOverallDifficulty(
    route: { elevationGain: number; totalDistance: number },
    preferences: RouteGenerationRequest['preferences']
  ): TrailDifficulty {
    const score = (route.elevationGain / 1000) + (route.totalDistance / 10);

    if (score < 2) return 'easy';
    if (score < 5) return 'moderate';
    if (score < 10) return 'difficult';
    return 'expert';
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Get default trail data for demo purposes
   */
  private getDefaultTrailData(): OfflineTrailData {
    return {
      version: '1.0.0',
      trails: [
        {
          id: 'demo-trail-1',
          name: 'Demo Trail',
          startLat: 39.7392,
          startLon: -104.9903,
          endLat: 39.7500,
          endLon: -105.0000,
          difficulty: 'moderate',
          distance: 5.2,
          elevationGain: 1200,
          elevationLoss: 800,
          surface: 'dirt',
          usage: 'moderate',
          seasonal: ['spring', 'summer', 'fall'],
          hazards: ['loose rocks'],
          waterSources: ['Demo Creek'],
        },
      ],
      waypoints: [
        { latitude: 39.7392, longitude: -104.9903, name: 'Trailhead', type: 'trailhead' },
        { latitude: 39.7450, longitude: -104.9950, name: 'Overlook', type: 'viewpoint' },
        { latitude: 39.7500, longitude: -105.0000, name: 'Summit', type: 'summit' },
      ],
      waterSources: [
        { latitude: 39.7420, longitude: -104.9920, name: 'Demo Creek', type: 'stream', seasonal: true },
      ],
      shadeAreas: [
        { latitude: 39.7440, longitude: -104.9940, radius: 0.1 },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get current service status
   */
  getStatus(): {
    initialized: boolean;
    trailDataVersion: string;
    totalTrails: number;
    totalWaypoints: number;
    offlineEnabled: boolean;
  } {
    return {
      initialized: this.isInitialized,
      trailDataVersion: this.trailData.version,
      totalTrails: this.trailData.trails.length,
      totalWaypoints: this.trailData.waypoints.length,
      offlineEnabled: this.config.offlineEnabled,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    console.log('[SmartRoute] Service shutdown');
  }
}

// Singleton instance
let serviceInstance: SmartRouteService | null = null;

export function getSmartRouteService(config?: Partial<SmartRouteConfig>): SmartRouteService {
  if (!serviceInstance) {
    serviceInstance = new SmartRouteService(config);
  }
  return serviceInstance;
}
