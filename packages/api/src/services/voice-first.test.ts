/**
 * VoiceFirst Service Tests
 * PackRat Feature - Hands-Free Voice Commands for Hikers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Context } from 'hono';
import {
  VoiceFirstService,
  VoiceCommand,
  CommandIntent,
  NavigationLocation,
  TrailWaypoint,
  VoiceNavigationResponse,
  VoiceAlertResponse,
  resetVoiceFirstService,
  getVoiceFirstService,
} from './voice-first';

// Mock environment
const mockEnv = {
  WEATHER_API_KEY: 'test-weather-api-key',
  AI: undefined,
};

// Mock Hono context
function createMockContext(): Context {
  const ctx = {
    env: mockEnv,
    get: vi.fn(),
  } as unknown as Context;
  return ctx;
}

describe('VoiceFirstService', () => {
  let service: VoiceFirstService;

  beforeEach(() => {
    resetVoiceFirstService();
  });

  afterEach(() => {
    resetVoiceFirstService();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      expect(service).toBeDefined();
    });

    it('should initialize with custom context', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      expect(service).toBeDefined();
    });
  });

  describe('command parsing - where_am_i', () => {
    it('should recognize "where am I"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Where am I right now?');
      expect(result.command).toBe('where_am_i');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.rawTranscript).toBe('Where am I right now?');
    });

    it('should recognize "what is my location"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is my location?');
      expect(result.command).toBe('where_am_i');
    });

    it('should recognize "where\'s my position"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand("Where's my position?");
      expect(result.command).toBe('where_am_i');
    });
  });

  describe('command parsing - navigation commands', () => {
    it('should recognize "how far to next"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('How far to the next waypoint?');
      expect(result.command).toBe('how_far_to_next');
    });

    it('should recognize "distance to next point"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is the distance to the next point?');
      // This matches next_waypoint_distance pattern first
      expect(result.command).toBe('next_waypoint_distance');
    });

    it('should recognize "total distance"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is the total distance of this trail?');
      expect(result.command).toBe('total_distance');
    });

    it('should recognize "ETA"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is my ETA to the destination?');
      expect(result.command).toBe('eta_to_destination');
    });

    it('should recognize "elevation"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is my current elevation?');
      expect(result.command).toBe('current_elevation');
    });
  });

  describe('command parsing - weather commands', () => {
    it('should recognize "weather alerts"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Are there any weather alerts?');
      expect(result.command).toBe('weather_alerts');
    });

    it('should recognize "what\'s the weather"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand("What's the weather like?");
      expect(result.command).toBe('weather_alerts');
    });

    it('should recognize "temperature"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is the temperature?');
      expect(result.command).toBe('temperature');
    });

    it('should recognize "lightning nearby"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Is there lightning nearby?');
      expect(result.command).toBe('lightning_nearby');
    });

    it('should recognize "thunder"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Any thunder in the area?');
      expect(result.command).toBe('lightning_nearby');
    });
  });

  describe('command parsing - trail conditions', () => {
    it('should recognize "trail conditions"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What are the trail conditions?');
      expect(result.command).toBe('trail_conditions');
    });

    it('should recognize "trail status"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What is the trail status?');
      expect(result.command).toBe('trail_conditions');
    });

    it('should recognize "is the trail open"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Is the trail open?');
      expect(result.command).toBe('trail_conditions');
    });

    it('should recognize "wildlife alerts"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Any wildlife alerts?');
      expect(result.command).toBe('wildlife_alerts');
    });

    it('should recognize "water sources"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Where are the water sources?');
      expect(result.command).toBe('water_sources');
    });
  });

  describe('command parsing - emergency & help', () => {
    it('should recognize "emergency"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Emergency!');
      expect(result.command).toBe('emergency_help');
    });

    it('should recognize "help"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Help me');
      expect(result.command).toBe('emergency_help');
    });

    it('should recognize "what can you do"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('What can you do?');
      expect(result.command).toBe('help');
    });

    it('should recognize "list commands"', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('List all voice commands');
      expect(result.command).toBe('help');
    });
  });

  describe('command parsing - unknown commands', () => {
    it('should return unknown for unrecognized input', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Random hiking gibberish xyz');
      expect(result.command).toBe('unknown');
    });

    it('should return unknown for empty input', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('');
      expect(result.command).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('entity extraction', () => {
    it('should extract distance entities', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('How far is 3 miles to the next point?');
      expect(result.entities.distance).toBe('3 miles');
      expect(result.entities.distanceValue).toBe('3');
      expect(result.entities.distanceUnit).toBe('miles');
    });

    it('should extract direction entities', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Go west to the shelter');
      expect(result.entities.direction).toBe('west');
    });

    it('should extract waypoint type entities', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('How far to the summit?');
      expect(result.entities.waypointType).toBe('summit');
    });

    it('should extract multiple entities', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const result = service.parseCommand('Is the campsite 2 miles north of here?');
      expect(result.entities.distance).toBeDefined();
      expect(result.entities.direction).toBe('north');
      expect(result.entities.waypointType).toBe('campsite');
    });
  });

  describe('navigation status', () => {
    it('should return navigation status', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
        elevation: 5400,
      };

      const navigation = await service.getNavigationStatus(location);

      expect(navigation).toHaveProperty('location');
      expect(navigation).toHaveProperty('nextWaypoint');
      expect(navigation).toHaveProperty('distanceToNext');
      expect(navigation).toHaveProperty('totalDistance');
      expect(navigation).toHaveProperty('eta');
      expect(navigation).toHaveProperty('bearing');
    });

    it('should calculate distance to next waypoint', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const navigation = await service.getNavigationStatus(location);

      expect(typeof navigation.distanceToNext).toBe('number');
      expect(navigation.distanceToNext).toBeGreaterThanOrEqual(0);
    });

    it('should format ETA correctly', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const navigation = await service.getNavigationStatus(location);

      // ETA should be a formatted string
      expect(typeof navigation.eta).toBe('string');
      expect(navigation.eta).toMatch(/(\d+\s*(hour|min|minute)s?)/);
    });

    it('should return bearing as number', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const navigation = await service.getNavigationStatus(location);

      expect(typeof navigation.bearing).toBe('number');
      expect(navigation.bearing).toBeGreaterThanOrEqual(0);
      expect(navigation.bearing).toBeLessThan(360);
    });
  });

  describe('hazard alerts', () => {
    it('should return hazard alerts for location', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const alerts = await service.getHazardAlerts(location);

      expect(alerts).toHaveProperty('hasAlerts');
      expect(alerts).toHaveProperty('alerts');
      expect(Array.isArray(alerts.alerts)).toBe(true);
    });

    it('should include weather data in alerts', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const alerts = await service.getHazardAlerts(location);

      if (alerts.weather) {
        expect(alerts.weather).toHaveProperty('temperature');
        expect(alerts.weather).toHaveProperty('conditions');
        expect(alerts.weather).toHaveProperty('windSpeed');
        expect(alerts.weather).toHaveProperty('humidity');
      }
    });
  });

  describe('lightning proximity check', () => {
    it('should check lightning proximity', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const result = await service.checkLightningProximity(location);

      expect(result).toHaveProperty('hasAlerts');
      expect(result).toHaveProperty('alerts');
    });

    it('should use custom threshold', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const result = await service.checkLightningProximity(location, 5);

      expect(result.hasAlerts).toBe(false);
    });
  });

  describe('text-to-speech generation', () => {
    it('should generate TTS response', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const tts = await service.generateTTS('Hello, this is a test message.');

      expect(tts).toHaveProperty('text');
      expect(tts).toHaveProperty('duration');
      expect(tts.text).toBe('Hello, this is a test message.');
      expect(typeof tts.duration).toBe('number');
    });

    it('should calculate duration based on word count', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const shortText = 'Hi';
      const longText = 'This is a much longer test message with many more words to test duration calculation.';

      const shortTTS = await service.generateTTS(shortText);
      const longTTS = await service.generateTTS(longText);

      expect(longTTS.duration).toBeGreaterThan(shortTTS.duration);
    });
  });

  describe('response formatting', () => {
    it('should format navigation response as spoken text', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const navigation = await service.getNavigationStatus(location);
      const spokenText = service.formatNavigationResponse(navigation);

      expect(typeof spokenText).toBe('string');
      expect(spokenText.length).toBeGreaterThan(0);
    });

    it('should format alert response as spoken text', async () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const location: NavigationLocation = {
        latitude: 40.015,
        longitude: -105.2705,
      };

      const alerts = await service.getHazardAlerts(location);
      const spokenText = service.formatAlertResponse(alerts);

      expect(typeof spokenText).toBe('string');
      expect(spokenText.length).toBeGreaterThan(0);
    });

    it('should format help text', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      const helpText = service.formatHelpText();

      expect(typeof helpText).toBe('string');
      expect(helpText).toContain('VoiceFirst commands');
      expect(helpText).toContain('Where am I');
      expect(helpText).toContain('Emergency');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const ctx = createMockContext();

      const { getVoiceFirstService } = require('./voice-first');
      const instance1 = getVoiceFirstService(ctx);
      const instance2 = getVoiceFirstService(ctx);

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton properly', () => {
      const ctx = createMockContext();

      const { getVoiceFirstService: get1 } = require('./voice-first');
      const instance1 = get1(ctx);
      resetVoiceFirstService();
      const { getVoiceFirstService: get2 } = require('./voice-first');
      const instance2 = get2(ctx);

      // After reset, should be a new instance
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('offline mode', () => {
    it('should report offline mode status', () => {
      const ctx = createMockContext();
      service = new VoiceFirstService(ctx);

      expect(service.isInOfflineMode()).toBe(false);
    });
  });
});

describe('VoiceCommand Types', () => {
  it('should have valid command types', () => {
    const validCommands: VoiceCommand[] = [
      'where_am_i',
      'how_far_to_next',
      'next_waypoint_distance',
      'total_distance',
      'eta_to_destination',
      'current_elevation',
      'weather_alerts',
      'lightning_nearby',
      'temperature',
      'trail_conditions',
      'wildlife_alerts',
      'water_sources',
      'rest_stop_nearby',
      'emergency_help',
      'help',
      'unknown',
    ];

    expect(validCommands.length).toBe(16);
  });
});

describe('TrailWaypoint Types', () => {
  it('should accept valid waypoint types', () => {
    const waypointTypes = [
      'start',
      'waypoint',
      'junction',
      'summit',
      'campsite',
      'water_source',
      'shelter',
      'destination',
    ];

    expect(waypointTypes).toContain('start');
    expect(waypointTypes).toContain('destination');
    expect(waypointTypes).toContain('summit');
  });

  it('should create valid waypoint object', () => {
    const waypoint: TrailWaypoint = {
      id: 'test-1',
      name: 'Test Summit',
      latitude: 40.015,
      longitude: -105.2705,
      distanceFromStart: 2.5,
      distanceToNext: 1.5,
      elevation: 7200,
      type: 'summit',
    };

    expect(waypoint.id).toBe('test-1');
    expect(waypoint.type).toBe('summit');
    expect(typeof waypoint.distanceFromStart).toBe('number');
  });
});

describe('NavigationLocation Types', () => {
  it('should accept valid coordinates', () => {
    const location: NavigationLocation = {
      latitude: 40.015,
      longitude: -105.2705,
      elevation: 5400,
      name: 'South Boulder Trail',
      trailName: 'South Boulder Peak Trail',
    };

    expect(location.latitude).toBe(40.015);
    expect(location.longitude).toBe(-105.2705);
    expect(location.elevation).toBe(5400);
  });

  it('should accept minimal coordinates', () => {
    const location: NavigationLocation = {
      latitude: 40.015,
      longitude: -105.2705,
    };

    expect(location.latitude).toBe(40.015);
    expect(location.longitude).toBe(-105.2705);
  });
});

import { getVoiceFirstService } from './voice-first';
