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
