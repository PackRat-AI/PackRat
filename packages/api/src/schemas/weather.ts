import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export const LocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  region: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
});

// Extended location schema for API responses
export const WeatherAPILocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  region: z.string(),
  country: z.string(),
  lat: z.union([z.string(), z.number()]),
  lon: z.union([z.string(), z.number()]),
  tz_id: z.string().optional(),
  localtime_epoch: z.number().optional(),
  localtime: z.string().optional(),
});

export const WeatherSearchQuerySchema = z.object({
  q: z.string().optional(),
});

export const WeatherCoordinateQuerySchema = z.object({
  lat: z.string(),
  lon: z.string(),
});

export const WeatherLocationIdSchema = z.object({
  id: z.string(),
});

export const WeatherConditionSchema = z.object({
  text: z.string(),
  icon: z.string(),
  code: z.number(),
});

// Air quality schema based on actual API response
export const AirQualitySchema = z.object({
  co: z.number(),
  no2: z.number(),
  o3: z.number(),
  so2: z.number(),
  pm2_5: z.number(),
  pm10: z.number(),
  'us-epa-index': z.number(),
  'gb-defra-index': z.number(),
});

export const WeatherCurrentSchema = z.object({
  last_updated: z.string(),
  temp_c: z.number(),
  temp_f: z.number(),
  condition: WeatherConditionSchema,
  wind_mph: z.number(),
  wind_kph: z.number(),
  wind_degree: z.number(),
  wind_dir: z.string(),
  pressure_mb: z.number(),
  pressure_in: z.number(),
  precip_mm: z.number(),
  precip_in: z.number(),
  humidity: z.number(),
  cloud: z.number(),
  feelslike_c: z.number(),
  feelslike_f: z.number(),
  vis_km: z.number(),
  vis_miles: z.number(),
  uv: z.number(),
  gust_mph: z.number().optional(),
  gust_kph: z.number().optional(),
  // Additional fields from actual API response
  is_day: z.number().optional(),
  windchill_c: z.number().optional(),
  windchill_f: z.number().optional(),
  heatindex_c: z.number().optional(),
  heatindex_f: z.number().optional(),
  dewpoint_c: z.number().optional(),
  dewpoint_f: z.number().optional(),
  will_it_rain: z.number().optional(),
  chance_of_rain: z.number().optional(),
  will_it_snow: z.number().optional(),
  chance_of_snow: z.number().optional(),
  snow_cm: z.number().optional(),
  air_quality: AirQualitySchema.optional(),
  short_rad: z.number().optional(),
  diff_rad: z.number().optional(),
  dni: z.number().optional(),
  gti: z.number().optional(),
});

export const WeatherDaySchema = z.object({
  maxtemp_c: z.number(),
  maxtemp_f: z.number(),
  mintemp_c: z.number(),
  mintemp_f: z.number(),
  avgtemp_c: z.number(),
  avgtemp_f: z.number(),
  maxwind_mph: z.number(),
  maxwind_kph: z.number(),
  totalprecip_mm: z.number(),
  totalprecip_in: z.number(),
  totalsnow_cm: z.number(),
  avghumidity: z.number(),
  avgvis_km: z.number(),
  avgvis_miles: z.number(),
  uv: z.number(),
  condition: WeatherConditionSchema,
  daily_chance_of_rain: z.number().optional(),
  daily_chance_of_snow: z.number().optional(),
});

export const WeatherHourSchema = z.object({
  time_epoch: z.number(),
  time: z.string(),
  temp_c: z.number(),
  temp_f: z.number(),
  condition: WeatherConditionSchema,
  wind_mph: z.number(),
  wind_kph: z.number(),
  wind_degree: z.number(),
  wind_dir: z.string(),
  pressure_mb: z.number(),
  pressure_in: z.number(),
  precip_mm: z.number(),
  precip_in: z.number(),
  humidity: z.number(),
  cloud: z.number(),
  feelslike_c: z.number(),
  feelslike_f: z.number(),
  vis_km: z.number(),
  vis_miles: z.number(),
  uv: z.number(),
  gust_mph: z.number().optional(),
  gust_kph: z.number().optional(),
  chance_of_rain: z.number().optional(),
  chance_of_snow: z.number().optional(),
  // Additional fields from actual API response
  is_day: z.number().optional(),
  windchill_c: z.number().optional(),
  windchill_f: z.number().optional(),
  heatindex_c: z.number().optional(),
  heatindex_f: z.number().optional(),
  dewpoint_c: z.number().optional(),
  dewpoint_f: z.number().optional(),
  will_it_rain: z.number().optional(),
  will_it_snow: z.number().optional(),
  snow_cm: z.number().optional(),
  air_quality: AirQualitySchema.optional(),
  short_rad: z.number().optional(),
  diff_rad: z.number().optional(),
  dni: z.number().optional(),
  gti: z.number().optional(),
});

export const WeatherForecastDaySchema = z.object({
  date: z.string(),
  date_epoch: z.number(),
  day: WeatherDaySchema,
  astro: z
    .object({
      sunrise: z.string(),
      sunset: z.string(),
      moonrise: z.string(),
      moonset: z.string(),
      moon_phase: z.string(),
      moon_illumination: z.number(),
    })
    .optional(),
  hour: z.array(WeatherHourSchema).optional(),
});

export const WeatherAlertSchema = z
  .object({
    alert: z
      .array(
        z.object({
          headline: z.string(),
          msgtype: z.string(),
          severity: z.string(),
          urgency: z.string(),
          areas: z.string(),
          category: z.string(),
          certainty: z.string(),
          event: z.string(),
          note: z.string().optional(),
          effective: z.string(),
          expires: z.string(),
          desc: z.string(),
          instruction: z.string().optional(),
        }),
      )
      .optional(),
  })
  .optional();

export const WeatherForecastSchema = z.object({
  location: WeatherAPILocationSchema,
  current: WeatherCurrentSchema,
  forecast: z.object({
    forecastday: z.array(WeatherForecastDaySchema),
  }),
});

// Raw WeatherAPI.com response schemas for internal use
export const WeatherAPISearchResponseSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    region: z.string(),
    country: z.string(),
    lat: z.union([z.string(), z.number()]),
    lon: z.union([z.string(), z.number()]),
    url: z.string().optional(),
  }),
);

export const WeatherAPICurrentResponseSchema = z.object({
  location: WeatherAPILocationSchema,
  current: WeatherCurrentSchema,
});

export const WeatherAPIForecastResponseSchema = z.object({
  location: WeatherAPILocationSchema,
  current: WeatherCurrentSchema,
  forecast: z.object({
    forecastday: z.array(WeatherForecastDaySchema),
  }),
  alerts: WeatherAlertSchema.optional(),
});

export const LocationSearchResponseSchema = z.array(LocationSchema);

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
