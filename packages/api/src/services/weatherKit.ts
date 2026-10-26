import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import type {
  WeatherAPIForecastResponse,
  WeatherAttribution,
  WeatherForecastDay,
} from '@packrat/schemas/weather';
import { safeJsonStringify } from '@packrat/utils';

const WEATHERKIT_BASE_URL = 'https://weatherkit.apple.com/api/v1/weather/en';
const PEM_HEADER_REGEX = /-----BEGIN PRIVATE KEY-----/;
const PEM_FOOTER_REGEX = /-----END PRIVATE KEY-----/;
const PEM_WHITESPACE_REGEX = /\s+/g;
const BASE64_PLUS_REGEX = /\+/g;
const BASE64_SLASH_REGEX = /\//g;
const BASE64_PADDING_REGEX = /=+$/;

/** Days a trip or the Weather tab can look ahead. */
export const WEATHERKIT_FORECAST_DAYS = 10;

// Minted tokens are reused for most of their lifetime instead of signing one
// per request; refreshed a minute before they expire.
const TOKEN_LIFETIME_S = 60 * 60;
const TOKEN_REUSE_MS = (TOKEN_LIFETIME_S - 60) * 1000;

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Apple's terms require the Apple Weather mark and a link to its legal page
 * wherever WeatherKit data is shown. Asset paths come from
 * https://weatherkit.apple.com/attribution/en-US.
 */
export const APPLE_WEATHER_ATTRIBUTION: WeatherAttribution = Object.freeze({
  serviceName: 'Apple Weather',
  legalPageUrl: 'https://developer.apple.com/weatherkit/data-source-attribution/',
  logoLightUrl:
    'https://weatherkit.apple.com/assets/branding/en/Apple_Weather_blk_en_3X_090122.png',
  logoDarkUrl: 'https://weatherkit.apple.com/assets/branding/en/Apple_Weather_wht_en_3X_090122.png',
} as const);

/** The subset of WeatherKit's `DayWeatherConditions` the forecast mapping reads. */
export type WeatherKitDay = {
  forecastStart: string;
  conditionCode: string;
  maxUvIndex: number;
  precipitationAmount: number;
  precipitationChance: number;
  precipitationType: string;
  snowfallAmount: number;
  temperatureMax: number;
  temperatureMin: number;
  sunrise?: string;
  sunset?: string;
  daytimeForecast?: {
    humidity?: number;
    windSpeed?: number;
  };
};

type WeatherKitDailyResponse = {
  forecastDaily?: { days?: WeatherKitDay[] };
};

// WeatherKit condition codes → the WeatherAPI.com code and label both apps
// already turn into an icon and a description.
const CONDITIONS: Readonly<Record<string, { code: number; text: string }>> = Object.freeze({
  Clear: { code: 1000, text: 'Clear' },
  MostlyClear: { code: 1000, text: 'Mostly clear' },
  Hot: { code: 1000, text: 'Hot' },
  Frigid: { code: 1000, text: 'Frigid' },
  PartlyCloudy: { code: 1003, text: 'Partly cloudy' },
  Breezy: { code: 1003, text: 'Breezy' },
  Windy: { code: 1003, text: 'Windy' },
  MostlyCloudy: { code: 1006, text: 'Mostly cloudy' },
  Cloudy: { code: 1009, text: 'Cloudy' },
  Haze: { code: 1030, text: 'Haze' },
  Smoky: { code: 1030, text: 'Smoky' },
  BlowingDust: { code: 1030, text: 'Blowing dust' },
  Foggy: { code: 1135, text: 'Fog' },
  Drizzle: { code: 1153, text: 'Drizzle' },
  SunShowers: { code: 1240, text: 'Showers' },
  Rain: { code: 1189, text: 'Rain' },
  HeavyRain: { code: 1195, text: 'Heavy rain' },
  FreezingDrizzle: { code: 1072, text: 'Freezing drizzle' },
  FreezingRain: { code: 1201, text: 'Freezing rain' },
  Sleet: { code: 1069, text: 'Sleet' },
  WintryMix: { code: 1069, text: 'Wintry mix' },
  Hail: { code: 1237, text: 'Hail' },
  Flurries: { code: 1066, text: 'Flurries' },
  SunFlurries: { code: 1066, text: 'Flurries' },
  Snow: { code: 1219, text: 'Snow' },
  HeavySnow: { code: 1225, text: 'Heavy snow' },
  BlowingSnow: { code: 1114, text: 'Blowing snow' },
  Blizzard: { code: 1117, text: 'Blizzard' },
  IsolatedThunderstorms: { code: 1087, text: 'Isolated thunderstorms' },
  ScatteredThunderstorms: { code: 1273, text: 'Scattered thunderstorms' },
  Thunderstorms: { code: 1276, text: 'Thunderstorms' },
  StrongStorms: { code: 1276, text: 'Strong storms' },
  TropicalStorm: { code: 1276, text: 'Tropical storm' },
  Hurricane: { code: 1276, text: 'Hurricane' },
} as const);
const UNKNOWN_CONDITION = Object.freeze({ code: 1003, text: 'Partly cloudy' } as const);

const SNOW_TYPES = new Set(['snow', 'sleet', 'mixed']);
const RAIN_TYPES = new Set(['rain', 'hail', 'mixed']);

export function isWeatherKitConfigured(env: ValidatedEnv): boolean {
  return Boolean(
    env.WEATHERKIT_KEY_ID &&
      env.WEATHERKIT_TEAM_ID &&
      env.WEATHERKIT_SERVICE_ID &&
      env.WEATHERKIT_PRIVATE_KEY,
  );
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin)
    .replace(BASE64_PLUS_REGEX, '-')
    .replace(BASE64_SLASH_REGEX, '_')
    .replace(BASE64_PADDING_REGEX, '');
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

async function importSigningKey(pkcs8Pem: string): Promise<CryptoKey> {
  const pemBody = pkcs8Pem
    .replace(PEM_HEADER_REGEX, '')
    .replace(PEM_FOOTER_REGEX, '')
    .replace(PEM_WHITESPACE_REGEX, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

/**
 * The ES256 developer token WeatherKit's REST API takes as a bearer token:
 * `kid` is the WeatherKit key, `id` is `<team>.<service id>`. Cached per
 * isolate; a cold isolate mints one more, which WeatherKit allows.
 */
async function getWeatherKitJwt(env: ValidatedEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const { WEATHERKIT_KEY_ID, WEATHERKIT_TEAM_ID, WEATHERKIT_SERVICE_ID, WEATHERKIT_PRIVATE_KEY } =
    env;
  if (
    !WEATHERKIT_KEY_ID ||
    !WEATHERKIT_TEAM_ID ||
    !WEATHERKIT_SERVICE_ID ||
    !WEATHERKIT_PRIVATE_KEY
  ) {
    throw new Error('WeatherKit is not configured (WEATHERKIT_* unset)');
  }

  const iat = Math.floor(now / 1000);
  const header = base64UrlEncodeString(
    safeJsonStringify({
      alg: 'ES256',
      kid: WEATHERKIT_KEY_ID,
      id: `${WEATHERKIT_TEAM_ID}.${WEATHERKIT_SERVICE_ID}`,
    }),
  );
  const payload = base64UrlEncodeString(
    safeJsonStringify({
      iss: WEATHERKIT_TEAM_ID,
      sub: WEATHERKIT_SERVICE_ID,
      iat,
      exp: iat + TOKEN_LIFETIME_S,
    }),
  );
  const signingInput = `${header}.${payload}`;

  const key = await importSigningKey(WEATHERKIT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedToken = { token, expiresAt: now + TOKEN_REUSE_MS };
  return token;
}

/** The 10-day daily forecast at a coordinate, days aligned to `timezone`. */
export async function fetchWeatherKitDaily({
  env,
  lat,
  lon,
  timezone,
}: {
  env: ValidatedEnv;
  lat: number;
  lon: number;
  timezone: string;
}): Promise<WeatherKitDay[]> {
  const jwt = await getWeatherKitJwt(env);
  const params = new URLSearchParams({ dataSets: 'forecastDaily', timezone });
  const response = await fetch(
    `${WEATHERKIT_BASE_URL}/${lat.toFixed(4)}/${lon.toFixed(4)}?${params.toString()}`,
    { headers: { authorization: `Bearer ${jwt}` } },
  );
  if (!response.ok) throw new Error(`WeatherKit HTTP ${response.status}`);
  const data = (await response.json()) as WeatherKitDailyResponse; // safe-cast: WeatherKit REST `Weather` response, forecastDaily dataset
  return data.forecastDaily?.days ?? [];
}

const toF = (c: number) => (c * 9) / 5 + 32;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** `YYYY-MM-DD` of `iso` in `timezone` — the key WeatherAPI days are dated by. */
function localDate({ iso, timezone }: { iso: string; timezone: string }): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** "06:42 AM" in `timezone`, the format WeatherAPI uses for sunrise and sunset. */
function localClock({ iso, timezone }: { iso: string | undefined; timezone: string }): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/**
 * One WeatherKit day in the WeatherAPI `forecastday` shape both apps already
 * read. Daily only: `hour` is empty and moon data is left out.
 */
export function toForecastDay({
  day,
  timezone,
}: {
  day: WeatherKitDay;
  timezone: string;
}): WeatherForecastDay {
  const condition = CONDITIONS[day.conditionCode] ?? UNKNOWN_CONDITION;
  const chance = Math.round(day.precipitationChance * 100);
  const type = day.precipitationType.toLowerCase();
  const windKph = day.daytimeForecast?.windSpeed ?? 0;
  const avgC = (day.temperatureMax + day.temperatureMin) / 2;
  return {
    date: localDate({ iso: day.forecastStart, timezone }),
    date_epoch: Math.floor(new Date(day.forecastStart).getTime() / 1000),
    day: {
      maxtemp_c: round1(day.temperatureMax),
      maxtemp_f: round1(toF(day.temperatureMax)),
      mintemp_c: round1(day.temperatureMin),
      mintemp_f: round1(toF(day.temperatureMin)),
      avgtemp_c: round1(avgC),
      avgtemp_f: round1(toF(avgC)),
      maxwind_kph: round1(windKph),
      maxwind_mph: round1(windKph / 1.609344),
      totalprecip_mm: round1(day.precipitationAmount),
      totalprecip_in: Math.round((day.precipitationAmount / 25.4) * 100) / 100,
      totalsnow_cm: round1(day.snowfallAmount / 10),
      avghumidity: Math.round((day.daytimeForecast?.humidity ?? 0) * 100),
      avgvis_km: 0,
      avgvis_miles: 0,
      uv: day.maxUvIndex,
      condition: { text: condition.text, icon: '', code: condition.code },
      daily_chance_of_rain: RAIN_TYPES.has(type) ? chance : 0,
      daily_chance_of_snow: SNOW_TYPES.has(type) ? chance : 0,
    },
    astro: {
      sunrise: localClock({ iso: day.sunrise, timezone }),
      sunset: localClock({ iso: day.sunset, timezone }),
      moonrise: '',
      moonset: '',
      moon_phase: '',
      moon_illumination: 0,
    },
    hour: [],
  };
}

/**
 * Fills a WeatherAPI forecast out to the full 10 days with WeatherKit days
 * past the last one WeatherAPI returned. WeatherAPI's own days keep their
 * hourly data. Unconfigured, or on any WeatherKit failure, the forecast comes
 * back unchanged — a short forecast beats a failed one.
 */
export async function extendForecastWithWeatherKit({
  env,
  forecast,
  userId,
}: {
  env: ValidatedEnv;
  forecast: WeatherAPIForecastResponse;
  userId?: string;
}): Promise<WeatherAPIForecastResponse> {
  const existing = forecast.forecast.forecastday;
  if (!isWeatherKitConfigured(env) || existing.length >= WEATHERKIT_FORECAST_DAYS) {
    return forecast;
  }

  const timezone = forecast.location.tz_id ?? 'UTC';
  const lastDate = existing.at(-1)?.date ?? '';
  try {
    const days = await fetchWeatherKitDaily({
      env,
      lat: forecast.location.lat,
      lon: forecast.location.lon,
      timezone,
    });
    const added = days
      .map((day) => toForecastDay({ day, timezone }))
      .filter((day) => day.date > lastDate)
      .slice(0, WEATHERKIT_FORECAST_DAYS - existing.length);
    if (added.length === 0) return forecast;

    return {
      ...forecast,
      forecast: { ...forecast.forecast, forecastday: [...existing, ...added] },
      attribution: APPLE_WEATHER_ATTRIBUTION,
    };
  } catch (error) {
    captureApiException({
      error,
      operation: 'weather.weatherKitDaily',
      userId,
      tags: { weather_operation: 'weatherkit_daily' },
      extra: { lat: forecast.location.lat, lon: forecast.location.lon, timezone },
    });
    return forecast;
  }
}
