import { Env } from '@packrat/api/types/env';
import { Context } from 'hono';
import { env } from 'hono/adapter';

type WeatherData = {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
};

export async function getWeatherData(location: string, c: Context): Promise<WeatherData> {
  try {
    const { OPENWEATHER_KEY } = env<Env>(c);
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location,
      )}&units=imperial&appid=${OPENWEATHER_KEY}`,
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
  } catch (error) {
    c.get('sentry').setContext('weather', {
      location,
      openWeatherKey: !!env<Env>(c).OPENWEATHER_KEY,
    });
    console.error('Error fetching weather data:', error);
    throw error; // will be captured by Sentry middleware
  }
}
