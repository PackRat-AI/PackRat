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

// Extended location schema for API responses
export const WeatherAPILocationSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    region: z.string(),
    country: z.string(),
    lat: z.union([z.string(), z.number()]),
    lon: z.union([z.string(), z.number()]),
    tz_id: z.string().optional(),
    localtime_epoch: z.number().optional(),
    localtime: z.string().optional(),
  })
  .openapi('WeatherAPILocation');

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

// Air quality schema based on actual API response
export const AirQualitySchema = z
  .object({
    co: z.number().openapi({
      example: 397.75,
      description: 'Carbon monoxide concentration',
    }),
    no2: z.number().openapi({
      example: 17.205,
      description: 'Nitrogen dioxide concentration',
    }),
    o3: z.number().openapi({
      example: 117,
      description: 'Ozone concentration',
    }),
    so2: z.number().openapi({
      example: 2.96,
      description: 'Sulfur dioxide concentration',
    }),
    pm2_5: z.number().openapi({
      example: 27.75,
      description: 'PM2.5 particulate matter concentration',
    }),
    pm10: z.number().openapi({
      example: 28.49,
      description: 'PM10 particulate matter concentration',
    }),
    'us-epa-index': z.number().openapi({
      example: 2,
      description: 'US EPA air quality index',
    }),
    'gb-defra-index': z.number().openapi({
      example: 3,
      description: 'GB DEFRA air quality index',
    }),
  })
  .openapi('AirQuality');

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
    gust_mph: z.number().optional().openapi({
      example: 12.5,
      description: 'Wind gust speed in miles per hour',
    }),
    gust_kph: z.number().optional().openapi({
      example: 20.1,
      description: 'Wind gust speed in kilometers per hour',
    }),
    // Additional fields from actual API response
    is_day: z.number().optional().openapi({
      example: 1,
      description: 'Whether it is day (1) or night (0)',
    }),
    windchill_c: z.number().optional().openapi({
      example: 22.5,
      description: 'Wind chill temperature in Celsius',
    }),
    windchill_f: z.number().optional().openapi({
      example: 72.5,
      description: 'Wind chill temperature in Fahrenheit',
    }),
    heatindex_c: z.number().optional().openapi({
      example: 24.1,
      description: 'Heat index temperature in Celsius',
    }),
    heatindex_f: z.number().optional().openapi({
      example: 75.4,
      description: 'Heat index temperature in Fahrenheit',
    }),
    dewpoint_c: z.number().optional().openapi({
      example: 18.0,
      description: 'Dew point temperature in Celsius',
    }),
    dewpoint_f: z.number().optional().openapi({
      example: 64.4,
      description: 'Dew point temperature in Fahrenheit',
    }),
    will_it_rain: z.number().optional().openapi({
      example: 0,
      description: 'Will it rain (1) or not (0)',
    }),
    chance_of_rain: z.number().optional().openapi({
      example: 45,
      description: 'Chance of rain percentage',
    }),
    will_it_snow: z.number().optional().openapi({
      example: 0,
      description: 'Will it snow (1) or not (0)',
    }),
    chance_of_snow: z.number().optional().openapi({
      example: 10,
      description: 'Chance of snow percentage',
    }),
    snow_cm: z.number().optional().openapi({
      example: 0.0,
      description: 'Snowfall in centimeters',
    }),
    air_quality: AirQualitySchema.optional(),
    short_rad: z.number().optional().openapi({
      example: 7.33,
      description: 'Short wave radiation',
    }),
    diff_rad: z.number().optional().openapi({
      example: 3.78,
      description: 'Diffuse radiation',
    }),
    dni: z.number().optional().openapi({
      example: 4.42,
      description: 'Direct normal irradiance',
    }),
    gti: z.number().optional().openapi({
      example: 4.91,
      description: 'Global tilted irradiance',
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
    daily_chance_of_rain: z.number().optional().openapi({
      example: 45,
      description: 'Daily chance of rain percentage',
    }),
    daily_chance_of_snow: z.number().optional().openapi({
      example: 10,
      description: 'Daily chance of snow percentage',
    }),
  })
  .openapi('WeatherDay');

export const WeatherHourSchema = z
  .object({
    time_epoch: z.number().openapi({
      example: 1704153600,
      description: 'Hour timestamp as Unix epoch',
    }),
    time: z.string().openapi({
      example: '2024-01-01 12:00',
      description: 'Hour time string',
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
    gust_mph: z.number().optional().openapi({
      example: 12.5,
      description: 'Wind gust speed in miles per hour',
    }),
    gust_kph: z.number().optional().openapi({
      example: 20.1,
      description: 'Wind gust speed in kilometers per hour',
    }),
    chance_of_rain: z.number().optional().openapi({
      example: 45,
      description: 'Chance of rain percentage',
    }),
    chance_of_snow: z.number().optional().openapi({
      example: 10,
      description: 'Chance of snow percentage',
    }),
    // Additional fields from actual API response
    is_day: z.number().optional().openapi({
      example: 1,
      description: 'Whether it is day (1) or night (0)',
    }),
    windchill_c: z.number().optional().openapi({
      example: 22.5,
      description: 'Wind chill temperature in Celsius',
    }),
    windchill_f: z.number().optional().openapi({
      example: 72.5,
      description: 'Wind chill temperature in Fahrenheit',
    }),
    heatindex_c: z.number().optional().openapi({
      example: 24.1,
      description: 'Heat index temperature in Celsius',
    }),
    heatindex_f: z.number().optional().openapi({
      example: 75.4,
      description: 'Heat index temperature in Fahrenheit',
    }),
    dewpoint_c: z.number().optional().openapi({
      example: 18.0,
      description: 'Dew point temperature in Celsius',
    }),
    dewpoint_f: z.number().optional().openapi({
      example: 64.4,
      description: 'Dew point temperature in Fahrenheit',
    }),
    will_it_rain: z.number().optional().openapi({
      example: 0,
      description: 'Will it rain (1) or not (0)',
    }),
    will_it_snow: z.number().optional().openapi({
      example: 0,
      description: 'Will it snow (1) or not (0)',
    }),
    snow_cm: z.number().optional().openapi({
      example: 0.0,
      description: 'Snowfall in centimeters',
    }),
    air_quality: AirQualitySchema.optional(),
    short_rad: z.number().optional().openapi({
      example: 7.33,
      description: 'Short wave radiation',
    }),
    diff_rad: z.number().optional().openapi({
      example: 3.78,
      description: 'Diffuse radiation',
    }),
    dni: z.number().optional().openapi({
      example: 4.42,
      description: 'Direct normal irradiance',
    }),
    gti: z.number().optional().openapi({
      example: 4.91,
      description: 'Global tilted irradiance',
    }),
  })
  .openapi('WeatherHour');

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
    astro: z
      .object({
        sunrise: z.string().openapi({
          example: '07:00 AM',
          description: 'Sunrise time',
        }),
        sunset: z.string().openapi({
          example: '05:30 PM',
          description: 'Sunset time',
        }),
        moonrise: z.string().openapi({
          example: '08:00 PM',
          description: 'Moonrise time',
        }),
        moonset: z.string().openapi({
          example: '06:00 AM',
          description: 'Moonset time',
        }),
        moon_phase: z.string().openapi({
          example: 'Waning Gibbous',
          description: 'Moon phase',
        }),
        moon_illumination: z.number().openapi({
          example: 85,
          description: 'Moon illumination percentage',
        }),
      })
      .optional()
      .openapi('WeatherAstro'),
    hour: z.array(WeatherHourSchema).optional().openapi({
      description: 'Hourly forecast data',
    }),
  })
  .openapi('WeatherForecastDay');

export const WeatherAlertSchema = z
  .object({
    alert: z
      .array(
        z.object({
          headline: z.string().openapi({
            example: 'Severe Weather Warning',
            description: 'Alert headline',
          }),
          msgtype: z.string().openapi({
            example: 'Warning',
            description: 'Alert message type',
          }),
          severity: z.string().openapi({
            example: 'Moderate',
            description: 'Alert severity level',
          }),
          urgency: z.string().openapi({
            example: 'Expected',
            description: 'Alert urgency',
          }),
          areas: z.string().openapi({
            example: 'Boston, MA',
            description: 'Affected areas',
          }),
          category: z.string().openapi({
            example: 'Met',
            description: 'Alert category',
          }),
          certainty: z.string().openapi({
            example: 'Likely',
            description: 'Alert certainty',
          }),
          event: z.string().openapi({
            example: 'Severe Thunderstorm',
            description: 'Weather event type',
          }),
          note: z.string().optional().openapi({
            example: 'Take shelter immediately',
            description: 'Additional alert notes',
          }),
          effective: z.string().openapi({
            example: '2024-01-01 12:00',
            description: 'Alert effective time',
          }),
          expires: z.string().openapi({
            example: '2024-01-01 18:00',
            description: 'Alert expiration time',
          }),
          desc: z.string().openapi({
            example: 'Severe thunderstorm warning in effect',
            description: 'Alert description',
          }),
          instruction: z.string().optional().openapi({
            example: 'Move to interior room',
            description: 'Safety instructions',
          }),
        }),
      )
      .optional()
      .openapi('WeatherAlert'),
  })
  .optional()
  .openapi('WeatherAlerts');

export const WeatherForecastSchema = z
  .object({
    location: WeatherAPILocationSchema,
    current: WeatherCurrentSchema,
    forecast: z.object({
      forecastday: z.array(WeatherForecastDaySchema),
    }),
  })
  .openapi('WeatherForecast');

// Raw WeatherAPI.com response schemas for internal use
export const WeatherAPISearchResponseSchema = z
  .array(
    z.object({
      id: z.number().optional(),
      name: z.string(),
      region: z.string(),
      country: z.string(),
      lat: z.union([z.string(), z.number()]),
      lon: z.union([z.string(), z.number()]),
      url: z.string().optional(),
    }),
  )
  .openapi('WeatherAPISearchResponse');

export const WeatherAPICurrentResponseSchema = z
  .object({
    location: WeatherAPILocationSchema,
    current: WeatherCurrentSchema,
  })
  .openapi('WeatherAPICurrentResponse');

export const WeatherAPIForecastResponseSchema = z
  .object({
    location: WeatherAPILocationSchema,
    current: WeatherCurrentSchema,
    forecast: z.object({
      forecastday: z.array(WeatherForecastDaySchema),
    }),
    alerts: WeatherAlertSchema.optional(),
  })
  .openapi('WeatherAPIForecastResponse');

export const LocationSearchResponseSchema = z
  .array(LocationSchema)
  .openapi('LocationSearchResponse');

// Export types for use in the application
export type Location = z.infer<typeof LocationSchema>;
export type WeatherAPILocation = z.infer<typeof WeatherAPILocationSchema>;
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
export type AirQuality = z.infer<typeof AirQualitySchema>;
export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;
export type WeatherDay = z.infer<typeof WeatherDaySchema>;
export type WeatherHour = z.infer<typeof WeatherHourSchema>;
export type WeatherForecastDay = z.infer<typeof WeatherForecastDaySchema>;
export type WeatherAlert = z.infer<typeof WeatherAlertSchema>;
export type WeatherForecast = z.infer<typeof WeatherForecastSchema>;
export type WeatherAPISearchResponse = z.infer<typeof WeatherAPISearchResponseSchema>;
export type WeatherAPICurrentResponse = z.infer<typeof WeatherAPICurrentResponseSchema>;
export type WeatherAPIForecastResponse = z.infer<typeof WeatherAPIForecastResponseSchema>;
export type LocationSearchResponse = z.infer<typeof LocationSearchResponseSchema>;
