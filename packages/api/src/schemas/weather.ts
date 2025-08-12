import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
    }),
  })
  .openapi('ErrorResponse');

export const LocationSchema = z
  .object({
    id: z.string().openapi({
      example: '42.3601_-71.0589',
      description: 'Unique identifier for the location',
    }),
    name: z.string().openapi({
      example: 'Boston',
      description: 'Location name',
    }),
    region: z.string().openapi({
      example: 'Massachusetts',
      description: 'State or region name',
    }),
    country: z.string().openapi({
      example: 'United States of America',
      description: 'Country name',
    }),
    lat: z.number().openapi({
      example: 42.3601,
      description: 'Latitude coordinate',
    }),
    lon: z.number().openapi({
      example: -71.0589,
      description: 'Longitude coordinate',
    }),
  })
  .openapi('Location');

export const WeatherSearchQuerySchema = z
  .object({
    q: z.string().optional().openapi({
      example: 'Boston',
      description: 'Location search query (city name, coordinates, etc.)',
    }),
  })
  .openapi('WeatherSearchQuery');

export const WeatherCoordinateQuerySchema = z
  .object({
    lat: z.string().optional().openapi({
      example: '42.3601',
      description: 'Latitude coordinate as string',
    }),
    lon: z.string().optional().openapi({
      example: '-71.0589',
      description: 'Longitude coordinate as string',
    }),
  })
  .openapi('WeatherCoordinateQuery');

export const WeatherConditionSchema = z
  .object({
    text: z.string().openapi({
      example: 'Partly cloudy',
      description: 'Weather condition description',
    }),
    icon: z.string().openapi({
      example: '//cdn.weatherapi.com/weather/64x64/day/116.png',
      description: 'Weather condition icon URL',
    }),
    code: z.number().openapi({
      example: 1003,
      description: 'Weather condition code',
    }),
  })
  .openapi('WeatherCondition');

export const WeatherCurrentSchema = z
  .object({
    last_updated: z.string().openapi({
      example: '2024-01-01 12:00',
      description: 'Last updated timestamp',
    }),
    temp_c: z.number().openapi({
      example: 22.5,
      description: 'Temperature in Celsius',
    }),
    temp_f: z.number().openapi({
      example: 72.5,
      description: 'Temperature in Fahrenheit',
    }),
    condition: WeatherConditionSchema,
    wind_mph: z.number().openapi({
      example: 8.5,
      description: 'Wind speed in miles per hour',
    }),
    wind_kph: z.number().openapi({
      example: 13.7,
      description: 'Wind speed in kilometers per hour',
    }),
    wind_degree: z.number().openapi({
      example: 210,
      description: 'Wind direction in degrees',
    }),
    wind_dir: z.string().openapi({
      example: 'SSW',
      description: 'Wind direction compass point',
    }),
    pressure_mb: z.number().openapi({
      example: 1013.2,
      description: 'Atmospheric pressure in millibars',
    }),
    pressure_in: z.number().openapi({
      example: 29.92,
      description: 'Atmospheric pressure in inches',
    }),
    precip_mm: z.number().openapi({
      example: 0.0,
      description: 'Precipitation in millimeters',
    }),
    precip_in: z.number().openapi({
      example: 0.0,
      description: 'Precipitation in inches',
    }),
    humidity: z.number().openapi({
      example: 65,
      description: 'Humidity percentage',
    }),
    cloud: z.number().openapi({
      example: 25,
      description: 'Cloud cover percentage',
    }),
    feelslike_c: z.number().openapi({
      example: 24.1,
      description: 'Feels like temperature in Celsius',
    }),
    feelslike_f: z.number().openapi({
      example: 75.4,
      description: 'Feels like temperature in Fahrenheit',
    }),
    vis_km: z.number().openapi({
      example: 10.0,
      description: 'Visibility in kilometers',
    }),
    vis_miles: z.number().openapi({
      example: 6.0,
      description: 'Visibility in miles',
    }),
    uv: z.number().openapi({
      example: 5,
      description: 'UV index',
    }),
  })
  .openapi('WeatherCurrent');

export const WeatherDaySchema = z
  .object({
    maxtemp_c: z.number().openapi({
      example: 25.0,
      description: 'Maximum temperature in Celsius',
    }),
    maxtemp_f: z.number().openapi({
      example: 77.0,
      description: 'Maximum temperature in Fahrenheit',
    }),
    mintemp_c: z.number().openapi({
      example: 18.0,
      description: 'Minimum temperature in Celsius',
    }),
    mintemp_f: z.number().openapi({
      example: 64.4,
      description: 'Minimum temperature in Fahrenheit',
    }),
    avgtemp_c: z.number().openapi({
      example: 21.5,
      description: 'Average temperature in Celsius',
    }),
    avgtemp_f: z.number().openapi({
      example: 70.7,
      description: 'Average temperature in Fahrenheit',
    }),
    maxwind_mph: z.number().openapi({
      example: 12.3,
      description: 'Maximum wind speed in mph',
    }),
    maxwind_kph: z.number().openapi({
      example: 19.8,
      description: 'Maximum wind speed in kph',
    }),
    totalprecip_mm: z.number().openapi({
      example: 0.5,
      description: 'Total precipitation in mm',
    }),
    totalprecip_in: z.number().openapi({
      example: 0.02,
      description: 'Total precipitation in inches',
    }),
    totalsnow_cm: z.number().openapi({
      example: 0.0,
      description: 'Total snowfall in cm',
    }),
    avghumidity: z.number().openapi({
      example: 68,
      description: 'Average humidity percentage',
    }),
    avgvis_km: z.number().openapi({
      example: 9.5,
      description: 'Average visibility in km',
    }),
    avgvis_miles: z.number().openapi({
      example: 5.9,
      description: 'Average visibility in miles',
    }),
    uv: z.number().openapi({
      example: 6,
      description: 'UV index',
    }),
    condition: WeatherConditionSchema,
  })
  .openapi('WeatherDay');

export const WeatherForecastDaySchema = z
  .object({
    date: z.string().openapi({
      example: '2024-01-01',
      description: 'Forecast date',
    }),
    date_epoch: z.number().openapi({
      example: 1704067200,
      description: 'Forecast date as Unix timestamp',
    }),
    day: WeatherDaySchema,
  })
  .openapi('WeatherForecastDay');

export const WeatherForecastSchema = z
  .object({
    location: LocationSchema.extend({
      name: z.string(),
      region: z.string(),
      country: z.string(),
      lat: z.number(),
      lon: z.number(),
      tz_id: z.string().openapi({
        example: 'America/New_York',
        description: 'Timezone identifier',
      }),
      localtime_epoch: z.number().openapi({
        example: 1704153600,
        description: 'Local time as Unix timestamp',
      }),
      localtime: z.string().openapi({
        example: '2024-01-01 12:00',
        description: 'Local time string',
      }),
    }),
    current: WeatherCurrentSchema,
    forecast: z.object({
      forecastday: z.array(WeatherForecastDaySchema),
    }),
  })
  .openapi('WeatherForecast');

export const LocationSearchResponseSchema = z
  .array(LocationSchema)
  .openapi('LocationSearchResponse');
