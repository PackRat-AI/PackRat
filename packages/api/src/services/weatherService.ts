import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';

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
      captureApiException(error, {
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
