/**
 * VoiceFirst Service
 * PackRat Feature - Hands-Free Voice Commands for Hikers
 *
 * Provides voice interface for hands-free trail commands:
 * - Voice command recognition
 * - Trail navigation commands ("where am I?", "how far to next point?")
 * - Hazard alerts via voice ("any weather alerts?", "is lightning near?")
 * - Text-to-speech for responses
 * - Offline voice recognition support
 */

import type { Context } from 'hono';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';

// --- Types ---

export type VoiceCommand =
  | 'where_am_i'
  | 'how_far_to_next'
  | 'next_waypoint_distance'
  | 'total_distance'
  | 'eta_to_destination'
  | 'current_elevation'
  | 'weather_alerts'
  | 'lightning_nearby'
  | 'temperature'
  | 'trail_conditions'
  | 'wildlife_alerts'
  | 'water_sources'
  | 'rest_stop_nearby'
  | 'emergency_help'
  | 'help'
  | 'unknown';

export type CommandIntent = {
  command: VoiceCommand;
  confidence: number;
  entities: Record<string, string>;
  rawTranscript: string;
};

export type NavigationLocation = {
  latitude: number;
  longitude: number;
  elevation?: number;
  name?: string;
  trailName?: string;
};

export type TrailWaypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceFromStart: number; // miles
  distanceToNext?: number; // miles
  elevation?: number;
  type: 'start' | 'waypoint' | 'junction' | 'summit' | 'campsite' | 'water_source' | 'shelter' | 'destination';
};

export type VoiceNavigationResponse = {
  location: NavigationLocation | null;
  nextWaypoint: TrailWaypoint | null;
  distanceToNext: number; // miles
  totalDistance: number; // miles
  eta: string; // formatted time
  bearing: number; // degrees
};

export type VoiceAlertResponse = {
  hasAlerts: boolean;
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
  weather?: {
    temperature: number;
    conditions: string;
    windSpeed: number;
    humidity: number;
  };
  lightningStrikes?: Array<{
    distance: number; // miles
    direction: string;
  }>;
};

export type TTSResponse = {
  text: string;
  audioUrl?: string;
  duration: number; // seconds
};

// --- Voice Recognition Patterns ---

const COMMAND_PATTERNS: Record<VoiceCommand, RegExp[]> = {
  where_am_i: [
    /where\s*(?:am\s*I|['’]s my|location|position)/i,
    /position/i,
    /location/i,
  ],
  how_far_to_next: [
    /how\s*(?:far|much).*next/i,
    /distance.*next/i,
    /next.*waypoint/i,
  ],
  next_waypoint_distance: [/next.*waypoint.*distance/i, /distance.*next.*point/i],
  total_distance: [
    /total\s*(?:distance|length)/i,
    /how\s*(?:far|long).*total/i,
    /distance.*so\s*far/i,
  ],
  eta_to_destination: [
    /eta/i,
    /time.*(?:remaining|left)/i,
    /when.*(?:arrive|destination)/i,
  ],
  current_elevation: [
    /elevation/i,
    /altitude/i,
    /how\s*high/i,
  ],
  weather_alerts: [
    /weather.*(?:alerts?|conditions)/i,
    /any.*weather/i,
    /forecast/i,
    /what.*(?:['’]s|is).*weather/i,
  ],
  lightning_nearby: [
    /lightning/i,
    /thunder/i,
    /storm/i,
  ],
  temperature: [
    /temperature/i,
    /how\s*(?:cold|hot|warm)/i,
    /what.*temp/i,
  ],
  trail_conditions: [
    /trail\s*conditions/i,
    /trail\s*status/i,
    /is.*trail.*open/i,
    /trail.*(?:good|bad|clear|blocked)/i,
  ],
  wildlife_alerts: [
    /wildlife/i,
    /animals?/i,
    /bear|coyote|mountain\s*lion/i,
    /animal.*sighting/i,
  ],
  water_sources: [
    /water.*(?:source|spring|creek|stream)/i,
    /where.*water/i,
    /hydration/i,
  ],
  rest_stop_nearby: [
    /rest\s*stop/i,
    /break/i,
    /rest.*area/i,
    /shelter/i,
  ],
  emergency_help: [
    /emergency/i,
    /help/i,
    /sos/i,
    /911/i,
    /rescue/i,
  ],
  help: [
    /what.*can.*do/i,
    /help.*commands/i,
    /list.*commands/i,
    /voice.*help/i,
  ],
  unknown: [],
};

// --- VoiceFirst Service ---

export class VoiceFirstService {
  private env: Env;
  private context: Context;
  private isOfflineMode: boolean = false;

  constructor(c: Context) {
    this.context = c;
    this.env = getEnv(c);
  }

  /**
   * Process voice input and return command intent
   * Supports both online and offline recognition modes
   */
  async processVoiceCommand(audioData?: ArrayBuffer): Promise<CommandIntent> {
    // If audio data is provided, use speech-to-text
    if (audioData) {
      return this.processSpeechInput(audioData);
    }

    // Return a mock command for testing
    return {
      command: 'unknown',
      confidence: 0,
      entities: {},
      rawTranscript: '',
    };
  }

  /**
   * Process speech audio input
   * Uses Cloudflare Workers AI for speech-to-text when available
   */
  private async processSpeechInput(audioData: ArrayBuffer): Promise<CommandIntent> {
    try {
      // Use Cloudflare Workers AI for speech-to-text if available
      if (this.env.AI) {
        const response = await this.env.AI.run('@cf/openai/whisper', {
          audio: Array.from(new Uint8Array(audioData)),
        });

        if (response && typeof response === 'object' && 'text' in response) {
          return this.parseCommand((response as { text: string }).text);
        }
      }

      // Fallback: offline pattern matching with mock data
      this.isOfflineMode = true;
      return this.parseCommand('');
    } catch (error) {
      console.error('Speech processing error:', error);
      this.isOfflineMode = true;

      return {
        command: 'unknown',
        confidence: 0,
        entities: {},
        rawTranscript: '',
      };
    }
  }

  /**
   * Parse text transcript and extract command intent
   */
  parseCommand(transcript: string): CommandIntent {
    const normalizedTranscript = transcript.trim().toLowerCase();

    if (!normalizedTranscript) {
      return {
        command: 'unknown',
        confidence: 0,
        entities: {},
        rawTranscript: '',
      };
    }

    // Match transcript against command patterns
    let bestMatch: VoiceCommand = 'unknown';
    let bestConfidence = 0;

    for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
      if (command === 'unknown') continue;

      for (const pattern of patterns) {
        if (pattern.test(normalizedTranscript)) {
          const confidence = this.calculateConfidence(pattern, normalizedTranscript);
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = command as VoiceCommand;
          }
          break;
        }
      }
    }

    // Extract entities from transcript
    const entities = this.extractEntities(normalizedTranscript);

    return {
      command: bestMatch,
      confidence: bestConfidence,
      entities,
      rawTranscript: transcript,
    };
  }

  /**
   * Calculate confidence score based on pattern match quality
   */
  private calculateConfidence(pattern: RegExp, transcript: string): number {
    const match = transcript.match(pattern);
    if (!match) return 0;

    // Calculate coverage of pattern in transcript
    const matchedLength = match[0].length;
    const transcriptLength = transcript.length;

    // Base confidence on how much of the transcript is covered
    let confidence = matchedLength / transcriptLength;

    // Bonus for exact matches or close matches
    if (matchedLength === transcriptLength) {
      confidence = 1.0;
    } else if (transcriptLength - matchedLength <= 5) {
      confidence = 0.9;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract named entities from transcript
   */
  private extractEntities(transcript: string): Record<string, string> {
    const entities: Record<string, string> = {};

    // Extract distance numbers
    const distanceMatch = transcript.match(/(\d+(?:\.\d+)?)\s*(miles?|km|kilometers?|feet?|meters?)/i);
    if (distanceMatch) {
      entities.distance = distanceMatch[0];
      entities.distanceValue = distanceMatch[1];
      entities.distanceUnit = distanceMatch[2];
    }

    // Extract direction references
    const directionMatch = transcript.match(/(north|south|east|west|northeast|northwest|southeast|southwest|left|right|ahead)/i);
    if (directionMatch) {
      entities.direction = directionMatch[1].toLowerCase();
    }

    // Extract waypoint names (common trail features)
    const waypointMatch = transcript.match(/(summit|campsite|shelter|trailhead|junction|viewpoint|peak|pass|ridge|valley)/i);
    if (waypointMatch) {
      entities.waypointType = waypointMatch[1].toLowerCase();
    }

    return entities;
  }

  /**
   * Get current navigation status
   */
  async getNavigationStatus(location?: NavigationLocation): Promise<VoiceNavigationResponse> {
    // Use provided location or get from context
    const currentLocation = location || await this.getCurrentLocation();

    // Mock trail data for demonstration
    const mockWaypoints: TrailWaypoint[] = [
      {
        id: 'start',
        name: 'Trailhead',
        latitude: 40.015,
        longitude: -105.2705,
        distanceFromStart: 0,
        type: 'start',
      },
      {
        id: 'waypoint-1',
        name: 'First Junction',
        latitude: 40.020,
        longitude: -105.275,
        distanceFromStart: 0.8,
        distanceToNext: 1.2,
        type: 'junction',
      },
      {
        id: 'summit',
        name: 'South Boulder Peak',
        latitude: 40.035,
        longitude: -105.290,
        distanceFromStart: 2.5,
        distanceToNext: 2.1,
        elevation: 7200,
        type: 'summit',
      },
      {
        id: 'destination',
        name: 'Shanahan Ridge',
        latitude: 40.050,
        longitude: -105.300,
        distanceFromStart: 5.6,
        type: 'destination',
      },
    ];

    // Find next waypoint based on current location
    const nextWaypoint = this.findNextWaypoint(currentLocation, mockWaypoints);

    // Calculate distances
    const distanceToNext = this.calculateDistance(
      currentLocation,
      nextWaypoint ? { latitude: nextWaypoint.latitude, longitude: nextWaypoint.longitude } : null,
    );

    const totalDistance = currentLocation
      ? mockWaypoints[mockWaypoints.length - 1].distanceFromStart - this.calculateDistanceFromStart(currentLocation, mockWaypoints)
      : mockWaypoints[mockWaypoints.length - 1].distanceFromStart;

    // Calculate ETA (assuming 2 mph hiking speed)
    const averageSpeed = 2.0; // mph
    const etaHours = distanceToNext / averageSpeed;
    const eta = this.formatDuration(etaHours * 60);

    // Calculate bearing
    const bearing = nextWaypoint
      ? this.calculateBearing(currentLocation, { latitude: nextWaypoint.latitude, longitude: nextWaypoint.longitude })
      : 0;

    return {
      location: currentLocation,
      nextWaypoint,
      distanceToNext: Math.round(distanceToNext * 10) / 10,
      totalDistance: Math.round(totalDistance * 10) / 10,
      eta,
      bearing: Math.round(bearing),
    };
  }

  /**
   * Get hazard alerts for current location
   */
  async getHazardAlerts(location: NavigationLocation): Promise<VoiceAlertResponse> {
    // Mock hazard data for demonstration
    const mockAlerts: VoiceAlertResponse = {
      hasAlerts: false,
      alerts: [],
      weather: {
        temperature: 72,
        conditions: 'Partly Cloudy',
        windSpeed: 8,
        humidity: 45,
      },
    };

    // Check for weather alerts
    if (mockAlerts.weather) {
      if (mockAlerts.weather.temperature > 95 || mockAlerts.weather.temperature < 32) {
        mockAlerts.hasAlerts = true;
        mockAlerts.alerts.push({
          type: 'temperature_extreme',
          severity: mockAlerts.weather.temperature > 100 || mockAlerts.weather.temperature < 20 ? 'high' : 'medium',
          message: mockAlerts.weather.temperature > 95 ? 'Extreme heat warning' : 'Cold temperature warning',
        });
      }

      if (mockAlerts.weather.windSpeed > 30) {
        mockAlerts.hasAlerts = true;
        mockAlerts.alerts.push({
          type: 'high_wind',
          severity: mockAlerts.weather.windSpeed > 50 ? 'high' : 'medium',
          message: 'High wind advisory',
        });
      }
    }

    return mockAlerts;
  }

  /**
   * Check for nearby lightning strikes
   */
  async checkLightningProximity(location: NavigationLocation, thresholdMiles: number = 10): Promise<VoiceAlertResponse> {
    // Mock lightning data
    const mockLightningStrikes = [
      { distance: 5.2, direction: 'west' },
      { distance: 8.7, direction: 'northwest' },
    ];

    const nearbyStrikes = mockLightningStrikes.filter(s => s.distance <= thresholdMiles);

    return {
      hasAlerts: nearbyStrikes.length > 0,
      alerts: nearbyStrikes.map(s => ({
        type: 'lightning',
        severity: s.distance < 5 ? 'critical' : 'high',
        message: `Lightning strike detected ${s.distance} miles ${s.direction}`,
      })),
      lightningStrikes: nearbyStrikes,
    };
  }

  /**
   * Generate text-to-speech response
   */
  async generateTTS(text: string): Promise<TTSResponse> {
    // Calculate estimated duration (average speaking rate ~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const duration = Math.ceil((wordCount / 150) * 60);

    return {
      text,
      duration,
    };
  }

  /**
   * Format navigation response as spoken text
   */
  formatNavigationResponse(navigation: VoiceNavigationResponse): string {
    if (!navigation.location) {
      return 'Unable to determine your current location. Please check your GPS signal.';
    }

    const parts: string[] = [];

    if (navigation.nextWaypoint) {
      parts.push(`Your next waypoint is ${navigation.nextWaypoint.name}.`);
      parts.push(`It's ${navigation.distanceToNext} miles away.`);
      parts.push(`Estimated time to arrival: ${navigation.eta}.`);

      if (navigation.bearing > 0) {
        const direction = this.getCardinalDirection(navigation.bearing);
        parts.push(`Head ${direction} to reach it.`);
      }
    } else {
      parts.push('You are approaching your destination.');
      parts.push(`Total distance remaining: ${navigation.totalDistance} miles.`);
    }

    return parts.join(' ');
  }

  /**
   * Format alert response as spoken text
   */
  formatAlertResponse(alerts: VoiceAlertResponse): string {
    if (!alerts.hasAlerts) {
      let response = 'No active alerts in your area.';
      if (alerts.weather) {
        response += ` Current conditions: ${alerts.weather.temperature} degrees Fahrenheit, ${alerts.weather.conditions}.`;
      }
      return response;
    }

    const parts: string[] = [];
    parts.push(`Attention: ${alerts.alerts.length} alert${alerts.alerts.length > 1 ? 's' : ''} in your area.`);

    for (const alert of alerts.alerts) {
      parts.push(`${alert.severity.toUpperCase()}: ${alert.message}.`);
    }

    if (alerts.weather) {
      parts.push(`Current weather: ${alerts.weather.temperature} degrees, ${alerts.weather.conditions}, wind ${alerts.weather.windSpeed} miles per hour.`);
    }

    return parts.join(' ');
  }

  /**
   * Format help text with available commands
   */
  formatHelpText(): string {
    return `VoiceFirst commands:
    - "Where am I?" - Get your current location
    - "How far to next waypoint?" - Distance to next point
    - "What's the weather?" - Weather conditions and alerts
    - "Any lightning nearby?" - Lightning proximity check
    - "What's my elevation?" - Current altitude
    - "Trail conditions?" - Trail status
    - "Emergency" - Call for help
    - "Help" - List all commands`;
  }

  // --- Private Helper Methods ---

  /**
   * Get current location (mock implementation)
   */
  private async getCurrentLocation(): Promise<NavigationLocation> {
    // In production, this would use device GPS or geolocation API
    return {
      latitude: 40.015,
      longitude: -105.2705,
      elevation: 5400,
      name: 'South Boulder Trail',
      trailName: 'South Boulder Peak Trail',
    };
  }

  /**
   * Find next waypoint based on current location
   */
  private findNextWaypoint(
    location: NavigationLocation,
    waypoints: TrailWaypoint[],
  ): TrailWaypoint | null {
    if (!waypoints || waypoints.length === 0) return null;

    // Find waypoint with minimum distance from current location
    let nearestNext: TrailWaypoint | null = null;
    let minDistance = Infinity;

    for (const waypoint of waypoints) {
      if (waypoint.type === 'start') continue;

      const distance = this.calculateDistance(location, {
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
      });

      // Skip waypoints we've likely passed
      if (distance < 0.5 && minDistance < 0.5) continue;

      if (distance < minDistance && waypoint.type !== 'start') {
        minDistance = distance;
        nearestNext = waypoint;
      }
    }

    return nearestNext;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    from: NavigationLocation | null,
    to: { latitude: number; longitude: number } | null,
  ): number {
    if (!from || !to) return 0;

    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(to.latitude - from.latitude);
    const dLon = this.toRad(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(from.latitude)) *
        Math.cos(this.toRad(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate distance from start of trail
   */
  private calculateDistanceFromStart(location: NavigationLocation, waypoints: TrailWaypoint[]): number {
    const start = waypoints.find(w => w.type === 'start');
    if (!start) return 0;

    const distanceToStart = this.calculateDistance(location, {
      latitude: start.latitude,
      longitude: start.longitude,
    });

    // Estimate position based on distance
    return Math.max(0, distanceToStart);
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(
    from: NavigationLocation,
    to: { latitude: number; longitude: number },
  ): number {
    const dLon = this.toRad(to.longitude - from.longitude);
    const lat1 = this.toRad(from.latitude);
    const lat2 = this.toRad(to.latitude);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = this.toDeg(Math.atan2(y, x));
    bearing = ((bearing + 360) % 360);

    return bearing;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private toDeg(rad: number): number {
    return rad * (180 / Math.PI);
  }

  /**
   * Format duration in hours/minutes
   */
  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
    }
    return `${mins} minutes`;
  }

  /**
   * Convert bearing to cardinal direction
   */
  private getCardinalDirection(bearing: number): string {
    const directions = [
      { name: 'north', range: [337.5, 22.5] },
      { name: 'northeast', range: [22.5, 67.5] },
      { name: 'east', range: [67.5, 112.5] },
      { name: 'southeast', range: [112.5, 157.5] },
      { name: 'south', range: [157.5, 202.5] },
      { name: 'southwest', range: [202.5, 247.5] },
      { name: 'west', range: [247.5, 292.5] },
      { name: 'northwest', range: [292.5, 337.5] },
    ];

    for (const dir of directions) {
      if (bearing >= dir.range[0] || bearing < dir.range[1]) {
        return dir.name;
      }
    }

    return 'north';
  }

  /**
   * Check if running in offline mode
   */
  isInOfflineMode(): boolean {
    return this.isOfflineMode;
  }
}

// --- Singleton Instance Management ---

let voiceFirstInstance: VoiceFirstService | null = null;

export function getVoiceFirstService(c: Context): VoiceFirstService {
  if (!voiceFirstInstance) {
    voiceFirstInstance = new VoiceFirstService(c);
  }
  return voiceFirstInstance;
}

export function resetVoiceFirstService(): void {
  voiceFirstInstance = null;
}
