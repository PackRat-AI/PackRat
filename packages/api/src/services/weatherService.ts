import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Context } from 'hono';

type WeatherData = {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
};

export class WeatherService {
  private env: Env;

  constructor(c: Context) {
    this.env = getEnv(c);
  }

  async getWeatherForLocation(location: string): Promise<WeatherData> {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location,
      )}&units=imperial&appid=${this.env.OPENWEATHER_KEY}`,
    );

    if (!response.ok) {
      throw new Error('Weather API request failed');
    }

    const data = await response.json();

    return {
      location,
      temperature: Math.round(data.main.temp),
      conditions: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
    };
  }
}
