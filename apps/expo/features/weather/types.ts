export interface WeatherApiForecastResponse {
  location: Location;
  current: CurrentWeather;
  forecast: {
    forecastday: ForecastDay[];
  };
  alerts: {
    alert: Alert[];
  };
}

export interface Location {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  tz_id: string;
  localtime_epoch: number;
  localtime: string;
}

export interface CurrentWeather {
  last_updated_epoch: number;
  last_updated: string;
  temp_c: number;
  temp_f: number;
  is_day: number;
  condition: WeatherCondition;
  wind_mph: number;
  wind_kph: number;
  wind_degree: number;
  wind_dir: string;
  pressure_mb: number;
  pressure_in: number;
  precip_mm: number;
  precip_in: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  feelslike_f: number;
  windchill_c: number;
  windchill_f: number;
  heatindex_c: number;
  heatindex_f: number;
  dewpoint_c: number;
  dewpoint_f: number;
  vis_km: number;
  vis_miles: number;
  uv: number;
  gust_mph: number;
  gust_kph: number;
  air_quality?: AirQuality;
}

export interface ForecastDay {
  date: string;
  date_epoch: number;
  day: DayWeather;
  astro: AstroData;
  hour: HourWeather[];
  air_quality?: AirQuality;
}

export interface DayWeather {
  maxtemp_c: number;
  maxtemp_f: number;
  mintemp_c: number;
  mintemp_f: number;
  avgtemp_c: number;
  avgtemp_f: number;
  maxwind_mph: number;
  maxwind_kph: number;
  totalprecip_mm: number;
  totalprecip_in: number;
  totalsnow_cm: number;
  avgvis_km: number;
  avgvis_miles: number;
  avghumidity: number;
  condition: WeatherCondition;
  uv: number;
  daily_will_it_rain: number;
  daily_will_it_snow: number;
  daily_chance_of_rain: number;
  daily_chance_of_snow: number;
}

export interface AstroData {
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  moon_illumination: number;
  is_moon_up: number;
  is_sun_up: number;
}

export interface HourWeather {
  time_epoch: number;
  time: string;
  temp_c: number;
  temp_f: number;
  condition: WeatherCondition;
  wind_mph: number;
  wind_kph: number;
  wind_degree: number;
  wind_dir: string;
  pressure_mb: number;
  pressure_in: number;
  precip_mm: number;
  precip_in: number;
  snow_cm: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  feelslike_f: number;
  windchill_c: number;
  windchill_f: number;
  heatindex_c: number;
  heatindex_f: number;
  dewpoint_c: number;
  dewpoint_f: number;
  will_it_rain: number;
  will_it_snow: number;
  is_day: number;
  vis_km: number;
  vis_miles: number;
  chance_of_rain: number;
  chance_of_snow: number;
  gust_mph: number;
  gust_kph: number;
  uv: number;
  short_rad: number;
  diff_rad: number;
  air_quality?: AirQuality;
}

export interface WeatherCondition {
  text: string;
  icon: string;
  code: number;
}

export interface AirQuality {
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  pm2_5?: number;
  pm10?: number;
  us_epa_index?: number;
  gb_defra_index?: number;
}

export interface Alert {
  headline: string;
  msgtype: string;
  severity: string;
  urgency: string;
  areas: string;
  category: string;
  certainty: string;
  event: string;
  note: string;
  effective: string;
  expires: string;
  desc: string;
  instruction: string;
}

// Location shape used in app
export interface WeatherLocation {
  id: string;
  name: string;
  temperature: number;
  condition: string;
  time: string;
  highTemp: number;
  lowTemp: number;
  alerts?: string;
  lat: number;
  lon: number;
  isActive?: boolean;
  details?: {
    feelsLike: number;
    humidity: number;
    visibility: number;
    uvIndex: number;
    windSpeed: number;
    weatherCode: number;
    isDay: number;
  };
  hourlyForecast?: Array<{
    time: string;
    temp: number;
    icon: string;
    weatherCode: number;
    isDay: number;
  }>;
  dailyForecast?: Array<{
    day: string;
    high: number;
    low: number;
    icon: string;
    weatherCode: number;
  }>;
}

export type LocationSearchResult = {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
};

export type WeatherLocationsState =
  | { state: 'loading' }
  | { state: 'hasData'; data: WeatherLocation[] }
  | { state: 'error'; error: string };
