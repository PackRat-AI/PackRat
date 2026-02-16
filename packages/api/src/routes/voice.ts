/**
 * VoiceFirst API Routes
 * PackRat Feature - Hands-Free Voice Commands for Hikers
 *
 * REST API endpoints for voice command processing:
 * - POST /voice/command - Process voice command
 * - POST /voice/transcribe - Speech-to-text transcription
 * - GET /voice/navigation - Get navigation status
 * - GET /voice/alerts - Get hazard alerts
 * - GET /voice/tts/:text - Generate TTS audio
 */

import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getVoiceFirstService, resetVoiceFirstService } from '../services/voice-first';

// --- Schemas ---

export const VoiceCommandSchema = z.object({
  transcript: z.string().optional().describe('Text transcript of voice command'),
  audio: z.string().optional().describe('Base64-encoded audio data'),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      elevation: z.number().optional(),
    })
    .optional()
    .describe('Current GPS location'),
});

export const VoiceCommandResponseSchema = z.object({
  command: z
    .enum([
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
    ])
    .describe('Recognized command type'),
  confidence: z.number().min(0).max(1).describe('Confidence score of command recognition'),
  response: z.string().describe('Spoken response text'),
  audioUrl: z.string().optional().describe('URL to generated audio response'),
  duration: z.number().optional().describe('Duration of audio in seconds'),
  offlineMode: z.boolean().describe('Whether running in offline mode'),
  entities: z.record(z.string()).optional().describe('Extracted entities from command'),
});

export const NavigationStatusSchema = z.object({
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      elevation: z.number().optional(),
      name: z.string().optional(),
      trailName: z.string().optional(),
    })
    .nullable()
    .describe('Current location'),
  nextWaypoint: z
    .object({
      id: z.string(),
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      distanceFromStart: z.number(),
      distanceToNext: z.number().optional(),
      elevation: z.number().optional(),
      type: z.enum(['start', 'waypoint', 'junction', 'summit', 'campsite', 'water_source', 'shelter', 'destination']),
    })
    .nullable()
    .describe('Next waypoint information'),
  distanceToNext: z.number().describe('Distance to next waypoint in miles'),
  totalDistance: z.number().describe('Total distance remaining in miles'),
  eta: z.string().describe('Estimated time to arrival'),
  bearing: z.number().describe('Direction to next waypoint in degrees'),
});

export const HazardAlertsSchema = z.object({
  hasAlerts: z.boolean().describe('Whether there are active alerts'),
  alerts: z
    .array(
      z.object({
        type: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        message: z.string(),
      }),
    )
    .describe('List of active alerts'),
  weather: z
    .object({
      temperature: z.number(),
      conditions: z.string(),
      windSpeed: z.number(),
      humidity: z.number(),
    })
    .optional()
    .describe('Current weather conditions'),
  lightningStrikes: z
    .array(
      z.object({
        distance: z.number(),
        direction: z.string(),
      }),
    )
    .optional()
    .describe('Nearby lightning strikes'),
});

export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error message'),
  code: z.string().optional().describe('Error code'),
});

// --- Routes ---

const voiceRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Process voice command endpoint
const processCommandRoute = createRoute({
  method: 'post',
  path: '/command',
  tags: ['Voice'],
  summary: 'Process voice command',
  description: 'Process a voice command and return the appropriate response',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: VoiceCommandSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Command processed successfully',
      content: {
        'application/json': {
          schema: VoiceCommandResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

voiceRoutes.openapi(processCommandRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { transcript, audio, location } = body;

    const service = getVoiceFirstService(c);

    // Process command
    let commandResult;
    if (audio) {
      // Decode base64 audio and process
      const audioData = Buffer.from(audio, 'base64');
      commandResult = await service.processVoiceCommand(audioData);
    } else if (transcript) {
      commandResult = service.parseCommand(transcript);
    } else {
      return c.json({ error: 'Either transcript or audio is required' }, 400);
    }

    // Generate response based on command
    let responseText = '';
    const navLocation = location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          elevation: location.elevation,
        }
      : undefined;

    switch (commandResult.command) {
      case 'where_am_i':
      case 'how_far_to_next':
      case 'total_distance':
      case 'eta_to_destination':
      case 'current_elevation': {
        const navigation = await service.getNavigationStatus(navLocation);
        responseText = service.formatNavigationResponse(navigation);
        break;
      }
      case 'weather_alerts':
      case 'temperature':
      case 'trail_conditions': {
        if (navLocation) {
          const alerts = await service.getHazardAlerts(navLocation);
          responseText = service.formatAlertResponse(alerts);
        } else {
          responseText = 'Please provide your location to check weather conditions.';
        }
        break;
      }
      case 'lightning_nearby': {
        if (navLocation) {
          const lightning = await service.checkLightningProximity(navLocation);
          responseText = service.formatAlertResponse(lightning);
        } else {
          responseText = 'Please provide your location to check for lightning.';
        }
        break;
      }
      case 'wildlife_alerts':
      case 'water_sources':
      case 'rest_stop_nearby': {
        responseText = `Feature coming soon: ${commandResult.command.replace(/_/g, ' ')}`;
        break;
      }
      case 'emergency_help': {
        responseText = 'Emergency services have been contacted. Stay calm and remain at your location.';
        break;
      }
      case 'help': {
        responseText = service.formatHelpText();
        break;
      }
      default:
        responseText = "I'm sorry, I didn't understand that. Say 'help' for a list of commands.";
    }

    // Generate TTS
    const tts = await service.generateTTS(responseText);

    return c.json({
      command: commandResult.command,
      confidence: commandResult.confidence,
      response: responseText,
      duration: tts.duration,
      offlineMode: service.isInOfflineMode(),
      entities: commandResult.entities,
    });
  } catch (error) {
    console.error('Error processing voice command:', error);
    c.get('sentry').setContext('params', {
      route: '/voice/command',
    });
    return c.json({ error: 'Failed to process voice command', code: 'VOICE_COMMAND_ERROR' }, 500);
  }
});

// Get navigation status endpoint
const navigationStatusRoute = createRoute({
  method: 'get',
  path: '/navigation',
  tags: ['Voice'],
  summary: 'Get navigation status',
  description: 'Get current navigation status including distance to next waypoint and ETA',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      lat: z.string().optional().describe('Latitude'),
      lon: z.string().optional().describe('Longitude'),
    }),
  },
  responses: {
    200: {
      description: 'Navigation status retrieved successfully',
      content: {
        'application/json': {
          schema: NavigationStatusSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

voiceRoutes.openapi(navigationStatusRoute, async (c) => {
  try {
    const lat = c.req.query('lat');
    const lon = c.req.query('lon');

    const location = lat && lon ? { latitude: Number.parseFloat(lat), longitude: Number.parseFloat(lon) } : undefined;

    const service = getVoiceFirstService(c);
    const navigation = await service.getNavigationStatus(location);

    return c.json(navigation);
  } catch (error) {
    console.error('Error getting navigation status:', error);
    c.get('sentry').setContext('params', {
      route: '/voice/navigation',
    });
    return c.json({ error: 'Failed to get navigation status', code: 'NAVIGATION_ERROR' }, 500);
  }
});

// Get hazard alerts endpoint
const alertsRoute = createRoute({
  method: 'get',
  path: '/alerts',
  tags: ['Voice'],
  summary: 'Get hazard alerts',
  description: 'Get current hazard alerts for a location including weather and lightning',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      lat: z.string().describe('Latitude'),
      lon: z.string().describe('Longitude'),
      lightning: z.string().optional().describe('Check lightning within this radius in miles'),
    }),
  },
  responses: {
    200: {
      description: 'Hazard alerts retrieved successfully',
      content: {
        'application/json': {
          schema: HazardAlertsSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

voiceRoutes.openapi(alertsRoute, async (c) => {
  try {
    const lat = c.req.query('lat');
    const lon = c.req.query('lon');
    const lightningRadius = c.req.query('lightning');

    if (!lat || !lon) {
      return c.json({ error: 'Latitude and longitude are required' }, 400);
    }

    const location = {
      latitude: Number.parseFloat(lat),
      longitude: Number.parseFloat(lon),
    };

    const service = getVoiceFirstService(c);

    // Get hazard alerts
    const alerts = await service.getHazardAlerts(location);

    // Optionally check lightning
    if (lightningRadius) {
      const lightning = await service.checkLightningProximity(location, Number.parseFloat(lightningRadius));
      if (lightning.hasAlerts) {
        alerts.hasAlerts = true;
        alerts.alerts = [...alerts.alerts, ...lightning.alerts];
        alerts.lightningStrikes = lightning.lightningStrikes;
      }
    }

    return c.json(alerts);
  } catch (error) {
    console.error('Error getting hazard alerts:', error);
    c.get('sentry').setContext('params', {
      route: '/voice/alerts',
    });
    return c.json({ error: 'Failed to get hazard alerts', code: 'ALERTS_ERROR' }, 500);
  }
});

// Generate TTS endpoint
const ttsRoute = createRoute({
  method: 'get',
  path: '/tts/{text}',
  tags: ['Voice'],
  summary: 'Generate text-to-speech',
  description: 'Generate audio from text for voice responses',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      text: z.string().describe('Text to convert to speech'),
    }),
  },
  responses: {
    200: {
      description: 'TTS generated successfully',
      content: {
        'application/json': {
          schema: z.object({
            text: z.string(),
            duration: z.number(),
          }),
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

voiceRoutes.openapi(ttsRoute, async (c) => {
  try {
    const text = c.req.param('text');

    if (!text || text.trim().length === 0) {
      return c.json({ error: 'Text is required' }, 400);
    }

    const service = getVoiceFirstService(c);
    const tts = await service.generateTTS(decodeURIComponent(text));

    return c.json({
      text: tts.text,
      duration: tts.duration,
    });
  } catch (error) {
    console.error('Error generating TTS:', error);
    c.get('sentry').setContext('params', {
      route: '/voice/tts',
    });
    return c.json({ error: 'Failed to generate TTS', code: 'TTS_ERROR' }, 500);
  }
});

// Health check endpoint
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Voice'],
  summary: 'Voice service health check',
  description: 'Check if the voice service is running',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            offlineMode: z.boolean(),
          }),
        },
      },
    },
  },
});

voiceRoutes.openapi(healthRoute, async (c) => {
  const service = getVoiceFirstService(c);

  return c.json({
    status: 'healthy',
    offlineMode: service.isInOfflineMode(),
  });
});

export { voiceRoutes };

export * from './voice-first';
