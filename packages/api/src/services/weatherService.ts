import { getEnv } from '@packrat/api/utils/env-validation';

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

    if (!response.ok) throw new Error('Weather API request failed');

    const data = (await response.json()) as {
      main: { temp: number; humidity: number };
      weather: Array<{ main: string }>;
      wind: { speed: number };
    };

    return {
      location,
      temperature: Math.round(data.main.temp),
      conditions: data.weather[0]?.main ?? '',
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
    };
  }
}
