// SmartRoute API Routes
// Offline route generation endpoints

import type {
  RouteGenerationRequest,
  RouteGenerationResponse,
  SmartRouteConfig,
} from '../types';
import { getSmartRouteService } from '../services/smartroute-service';

// Default configuration
const defaultConfig: Partial<SmartRouteConfig> = {
  dataPath: process.env.SMARTROUTE_DATA_PATH || './data',
  offlineEnabled: process.env.SMARTROUTE_OFFLINE !== 'false',
  maxRoutePoints: parseInt(process.env.SMARTROUTE_MAX_POINTS || '1000', 10),
  elevationSmoothing: process.env.SMARTROUTE_ELEVATION_SMOOTHING !== 'false',
  shadeOptimization: process.env.SMARTROUTE_SHADE !== 'false',
  waterSourceAwareness: process.env.SMARTROUTE_WATER !== 'false',
};

// Get service instance
const smartRouteService = getSmartRouteService(defaultConfig);

/**
 * Parse route generation request body
 */
function parseBody(body: string | null): RouteGenerationRequest | null {
  if (!body) return null;

  try {
    const parsed = JSON.parse(body);

    // Validate required fields
    if (!parsed.startLocation || typeof parsed.startLocation !== 'object') {
      return null;
    }
    if (
      typeof parsed.startLocation.latitude !== 'number' ||
      typeof parsed.startLocation.longitude !== 'number'
    ) {
      return null;
    }

    if (!parsed.endLocation || typeof parsed.endLocation !== 'object') {
      return null;
    }
    if (
      typeof parsed.endLocation.latitude !== 'number' ||
      typeof parsed.endLocation.longitude !== 'number'
    ) {
      return null;
    }

    return {
      startLocation: {
        latitude: parsed.startLocation.latitude,
        longitude: parsed.startLocation.longitude,
      },
      endLocation: {
        latitude: parsed.endLocation.latitude,
        longitude: parsed.endLocation.longitude,
      },
      waypoints: parsed.waypoints,
      preferences: parsed.preferences,
      includeElevation: parsed.includeElevation,
    };
  } catch {
    return null;
  }
}

/**
 * Handle route generation requests
 */
export async function routeGenerateHandler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request
  const body = await req.text();
  const request = parseBody(body);

  if (!request) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: 'Must include startLocation and endLocation with latitude/longitude',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Initialize service if needed
  await smartRouteService.initialize();

  try {
    const response = await smartRouteService.generateRoute(request);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SmartRoute] Generation failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Route generation failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle service status requests
 */
export async function routeStatusHandler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const status = smartRouteService.getStatus();

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle trail data queries
 */
export async function trailQueryHandler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const radius = url.searchParams.get('radius') || '25';

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({
        error: 'Missing required parameters',
        details: 'lat and lon query parameters are required',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  await smartRouteService.initialize();

  // For now, return status (would return nearby trails in full implementation)
  const status = smartRouteService.getStatus();

  return new Response(
    JSON.stringify({
      message: 'Trail query endpoint - use /api/routes/generate for route generation',
      location: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      },
      searchRadius: parseFloat(radius),
      availableData: {
        totalTrails: status.totalTrails,
        totalWaypoints: status.totalWaypoints,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle GPX export requests
 */
export async function routeGpxHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();
  const request = parseBody(body);

  if (!request) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: 'Must include startLocation and endLocation with latitude/longitude',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  await smartRouteService.initialize();

  try {
    const response = await smartRouteService.generateRoute(request);

    // Generate GPX XML
    const gpx = generateGpx(response.route);

    return new Response(gpx, {
      status: 200,
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': 'attachment; filename="route.gpx"',
      },
    });
  } catch (error) {
    console.error('[SmartRoute] GPX export failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'GPX export failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Generate GPX XML from route
 */
function generateGpx(route: {
  points: { latitude: number; longitude: number; elevation?: number; name?: string }[];
  distance: number;
  estimatedTime: number;
}): string {
  const points = route.points
    .map((p, i) => {
      const ele = p.elevation !== undefined ? `<ele>${p.elevation}</ele>` : '';
      const name = p.name ? `<name>${p.name}</name>` : '';
      return `    <trkpt lat="${p.latitude}" lon="${p.longitude}">${ele}${name}</trkpt>`;
    })
    .join('\n');

  const name = `SmartRoute - ${route.distance.toFixed(1)} miles, ~${Math.round(route.estimatedTime / 60)} hours`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PackRat SmartRoute">
  <metadata>
    <name>${name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Handle GeoJSON export requests
 */
export async function routeGeoJsonHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();
  const request = parseBody(body);

  if (!request) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: 'Must include startLocation and endLocation with latitude/longitude',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  await smartRouteService.initialize();

  try {
    const response = await smartRouteService.generateRoute(request);

    // Generate GeoJSON
    const geoJson = generateGeoJson(response.route);

    return new Response(JSON.stringify(geoJson), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json',
        'Content-Disposition': 'attachment; filename="route.geojson"',
      },
    });
  } catch (error) {
    console.error('[SmartRoute] GeoJSON export failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'GeoJSON export failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Generate GeoJSON from route
 */
function generateGeoJson(route: {
  points: { latitude: number; longitude: number; elevation?: number; name?: string }[];
  distance: number;
  estimatedTime: number;
  difficulty: string;
}): object {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'SmartRoute',
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          difficulty: route.difficulty,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((p) => [p.longitude, p.latitude]),
        },
      },
      ...route.points
        .filter((p) => p.name)
        .map((p) => ({
          type: 'Feature',
          properties: {
            name: p.name,
            type: 'waypoint',
          },
          geometry: {
            type: 'Point',
            coordinates: [p.longitude, p.latitude],
          },
        })),
    ],
  };
}

/**
 * Handle service shutdown
 */
export async function routeShutdownHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await smartRouteService.shutdown();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
