import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  OpenWeatherResponseSchema,
  type WeatherAPIForecastResponse,
  type WeatherAPISearchResponse,
} from '@packrat/schemas/weather';

const COORDINATE_QUERY_REGEX = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

const stubCondition = {
  text: 'Partly cloudy',
  icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
  code: 1003,
};

const buildStubCurrent = (tempF = 72): WeatherAPIForecastResponse['current'] => ({
  last_updated: '2026-07-16 12:00',
  temp_c: Math.round(((tempF - 32) * 5) / 9),
  temp_f: tempF,
  condition: stubCondition,
  wind_mph: 7,
  wind_kph: 11,
  wind_degree: 240,
  wind_dir: 'WSW',
  pressure_mb: 1016,
  pressure_in: 30.0,
  precip_mm: 0,
  precip_in: 0,
  humidity: 32,
  cloud: 25,
  feelslike_c: Math.round(((tempF - 32) * 5) / 9),
  feelslike_f: tempF,
  vis_km: 16,
  vis_miles: 10,
  uv: 5,
  is_day: 1,
  gust_mph: 14,
  gust_kph: 22,
});

const buildStubForecastDay = (
  dayOffset: number,
): WeatherAPIForecastResponse['forecast']['forecastday'][number] => {
  const date = new Date(Date.UTC(2026, 6, 16 + dayOffset));
  const highF = 78 + (dayOffset % 3);
  const lowF = 55 + (dayOffset % 2);
  return {
    date: date.toISOString().slice(0, 10),
    date_epoch: Math.floor(date.getTime() / 1000),
    day: {
      maxtemp_c: Math.round(((highF - 32) * 5) / 9),
      maxtemp_f: highF,
      mintemp_c: Math.round(((lowF - 32) * 5) / 9),
      mintemp_f: lowF,
      avgtemp_c: Math.round((((highF + lowF) / 2 - 32) * 5) / 9),
      avgtemp_f: (highF + lowF) / 2,
      maxwind_mph: 18,
      maxwind_kph: 29,
      totalprecip_mm: dayOffset === 2 ? 1.2 : 0,
      totalprecip_in: dayOffset === 2 ? 0.05 : 0,
      totalsnow_cm: 0,
      avghumidity: 35,
      avgvis_km: 16,
      avgvis_miles: 10,
      uv: 5,
      condition: stubCondition,
      daily_chance_of_rain: dayOffset === 2 ? 30 : 5,
      daily_chance_of_snow: 0,
    },
    astro: {
      sunrise: '05:48 AM',
      sunset: '08:27 PM',
      moonrise: '10:15 PM',
      moonset: '07:12 AM',
      moon_phase: 'Waxing Crescent',
      moon_illumination: 18,
    },
    hour: [],
  };
};

type StubWeatherLocation = WeatherAPISearchResponse[number];

export const defaultStubLocation: StubWeatherLocation = {
  id: 5419384,
  name: 'Denver',
  region: 'Colorado',
  country: 'United States',
  lat: 39.74,
  lon: -104.98,
  url: 'denver-colorado-united-states-of-america',
};

const stubLocations: [StubWeatherLocation, ...StubWeatherLocation[]] = [
  defaultStubLocation,
  {
    id: 5400000,
    name: 'Yosemite Valley',
    region: 'California',
    country: 'United States',
    lat: 37.75,
    lon: -119.59,
    url: 'yosemite-valley-california-united-states-of-america',
  },
] satisfies [StubWeatherLocation, ...StubWeatherLocation[]];

export const getStubLocation = (id?: number) =>
  stubLocations.find((location) => location.id === id) ?? defaultStubLocation;

export const buildStubForecast = (id?: number): WeatherAPIForecastResponse => {
  const location = getStubLocation(id);
  return {
    location: {
      id: location.id,
      name: location.name,
      region: location.region,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
      tz_id: location.name === 'Denver' ? 'America/Denver' : 'America/Los_Angeles',
      localtime_epoch: 1784246400,
      localtime: '2026-07-16 12:00',
    },
    current: buildStubCurrent(location.name === 'Denver' ? 72 : 68),
    forecast: {
      forecastday: Array.from({ length: 10 }, (_, index) => buildStubForecastDay(index)),
    },
    alerts: { alert: [] },
  };
};

export const searchStubLocations = (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  if (COORDINATE_QUERY_REGEX.test(normalizedQuery)) return [defaultStubLocation];
  return stubLocations.filter((location) =>
    `${location.name} ${location.region} ${location.country}`
      .toLowerCase()
      .includes(normalizedQuery),
  );
};

type WeatherData = {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
};

export class WeatherService {
  private env: ReturnType<typeof getEnv>;

  constructor() {
    this.env = getEnv();
  }

  async getWeatherForLocation(location: string): Promise<WeatherData> {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location,
      )}&units=imperial&appid=${this.env.OPENWEATHER_KEY}`,
    );

    if (!response.ok) {
      let apiMessage = response.statusText;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) apiMessage = body.message;
      } catch {
        // response body not parseable — fall back to statusText
      }
      const error = new Error(
        `Weather API error ${response.status}: ${apiMessage} (location: "${location}")`,
      );
      captureApiException({
        error: error,
        operation: 'weatherService.getWeatherForLocation',
        tags: { weather_api: 'openweathermap' },
        extra: {
          location,
          apiMessage,
          httpStatus: response.status,
          errorCode: 'OPENWEATHERMAP_HTTP_ERROR',
        },
      });
      throw error;
    }

    const data = OpenWeatherResponseSchema.parse(await response.json());

    return {
      location,
      temperature: Math.round(data.main.temp),
      conditions: data.weather[0]?.main ?? '',
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
    };
  }
}
