# SmartRoute AI - Offline Route Generation

PackRat's second offline AI feature. AI-powered route generation that works entirely offline.

## Features

- **AI-powered route creation and modification** - Generate optimized routes based on preferences
- **Offline route generation** - Works in zero signal environments
- **Customization options** - Filter by difficulty, distance, elevation, scenic value
- **Water source awareness** - Optimize routes based on water availability
- **Shade coverage optimization** - Prioritize shaded routes for hot weather
- **Export formats** - GPX and GeoJSON for use with other apps and devices

## API Endpoints

### POST /api/routes/generate

Generate a new route between two points.

**Request Body:**
```json
{
  "startLocation": { "latitude": 39.7392, "longitude": -104.9903 },
  "endLocation": { "latitude": 39.7500, "longitude": -105.0000 },
  "waypoints": [
    { "latitude": 39.7450, "longitude": -104.9950 }
  ],
  "preferences": {
    "difficulty": "moderate",
    "maxDistance": 10,
    "maxElevationGain": 2000,
    "scenicValue": "high",
    "waterSources": true,
    "shadeCoverage": true
  },
  "includeElevation": true
}
```

**Response:**
```json
{
  "route": {
    "points": [
      { "latitude": 39.7392, "longitude": -104.9903, "elevation": 5280, "type": "trailhead" },
      { "latitude": 39.7420, "longitude": -104.9920, "elevation": 5500 },
      { "latitude": 39.7500, "longitude": -105.0000, "elevation": 6400, "type": "summit" }
    ],
    "distance": 5.2,
    "elevationGain": 1200,
    "elevationLoss": 800,
    "estimatedTime": 180,
    "difficulty": "moderate",
    "waypoints": ["Trailhead", "Summit"],
    "hazards": ["loose rocks"],
    "waterSources": ["Demo Creek"]
  },
  "elevationProfile": {
    "points": [
      { "distance": 0, "elevation": 5280 },
      { "distance": 2.6, "elevation": 6400 },
      { "distance": 5.2, "elevation": 5600 }
    ],
    "totalGain": 1200,
    "totalLoss": 800,
    "maxElevation": 6400,
    "minElevation": 5280,
    "avgGrade": 8.5,
    "maxGrade": 15.2
  },
  "scenicScore": 72,
  "waterProximity": 0.5,
  "shadeCoverage": 35,
  "metadata": {
    "generatedAt": "2026-02-16T07:00:00Z",
    "offlineMode": true,
    "dataVersion": "1.0.0",
    "optimizationIterations": 47
  },
  "processingTimeMs": 234
}
```

### GET /api/routes/status

Get service status and available trail data.

**Response:**
```json
{
  "initialized": true,
  "trailDataVersion": "1.0.0",
  "totalTrails": 156,
  "totalWaypoints": 423,
  "offlineEnabled": true
}
```

### POST /api/routes/export/gpx

Export generated route as GPX format.

**Request:** Same as `/api/routes/generate`

**Response:** GPX XML file with `Content-Type: application/gpx+xml`

### POST /api/routes/export/geojson

Export generated route as GeoJSON format.

**Request:** Same as `/api/routes/generate`

**Response:** GeoJSON object with `Content-Type: application/geo+json`

## Service Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SMARTROUTE_DATA_PATH` | `./data` | Path to offline trail data |
| `SMARTROUTE_OFFLINE` | `true` | Enable offline mode |
| `SMARTROUTE_MAX_POINTS` | `1000` | Maximum route points |
| `SMARTROUTE_ELEVATION_SMOOTHING` | `true` | Smooth elevation data |
| `SMARTROUTE_SHADE` | `true` | Enable shade optimization |
| `SMARTROUTE_WATER` | `true` | Enable water source awareness |

## Offline Trail Data

The SmartRoute service uses offline trail data stored in the configured data path. Data structure:

```typescript
interface OfflineTrailData {
  version: string;
  trails: TrailSegment[];
  waypoints: RoutePoint[];
  waterSources: WaterSource[];
  shadeAreas: ShadeArea[];
  lastUpdated: string;
}

interface TrailSegment {
  id: string;
  name: string;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'expert';
  distance: number; // miles
  elevationGain: number; // feet
  elevationLoss: number; // feet
  surface: 'paved' | 'gravel' | 'dirt' | 'natural' | 'rock' | 'sand' | 'snow' | 'ice';
  usage: 'low' | 'moderate' | 'high';
  seasonal?: ('spring' | 'summer' | 'fall' | 'winter')[];
  hazards?: string[];
  waterSources?: string[];
}
```

## Trail Difficulty Classification

Trails are classified based on multiple factors:

- **Grade** - Maximum and average incline
- **Surface quality** - Trail surface conditions
- **Exposure** - Exposure to elements/drop-offs
- **Technical difficulty** - Required skills/equipment
- **Elevation gain per mile** - Overall effort required

### Difficulty Levels

| Level | Description | Typical Characteristics |
|-------|-------------|------------------------|
| `easy` | Suitable for all | < 500ft gain/mile, smooth surface |
| `moderate` | Some fitness required | 500-1000ft gain/mile, uneven terrain |
| `difficult` | Good fitness required | 1000-2000ft gain/mile, potential hazards |
| `expert` | High experience needed | > 2000ft gain/mile, technical terrain |

## Running Locally

```bash
# Install dependencies
bun install

# Run the PackRat server
cd apps/packrat
bun run src/server.ts
```

The server will start at `http://localhost:3001`.

## Testing

```bash
cd apps/packrat
bun test
```

## Supported Use Cases

1. **Day Hike Planning** - Generate moderate difficulty routes within distance/elevation limits
2. **Thru-Hike Route Finding** - Find paths connecting trail segments between waypoints
3. **Scenic Route Discovery** - Prioritize high scenic value routes
4. **Safety-First Planning** - Filter by difficulty, avoid hazards, ensure water access
5. **Export for GPS Devices** - Generate GPX files for Garmin, Gaia GPS, etc.
