import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Context } from 'hono';

export type WeatherData = {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
};

export type WeatherForecast = {
  date: string;
  tempHigh: number;
  tempLow: number;
  conditions: string;
  precipitation: number;
  windSpeed: number;
};

export type TripWeatherOutlook = {
  location: string;
  tripDuration: number;
  forecast: WeatherForecast[];
  summary: {
    avgTempHigh: number;
    avgTempLow: number;
    rainDays: number;
    condition: string;
    recommendation: string;
  };
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

  /**
   * Get 5-day weather forecast for a location
   */
  async getWeatherForecast(location: string): Promise<WeatherForecast[]> {
    // First, get coordinates from city name
    const geoResponse = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location,
      )}&limit=1&appid=${this.env.OPENWEATHER_KEY}`,
    );

    if (!geoResponse.ok) {
      throw new Error('Geocoding API request failed');
    }

    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      throw new Error('Location not found');
    }

    const { lat, lon } = geoData[0];

    // Get 5-day forecast
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${this.env.OPENWEATHER_KEY}`,
    );

    if (!forecastResponse.ok) {
      throw new Error('Weather forecast API request failed');
    }

    const forecastData = await forecastResponse.json();

    // Process 3-hour forecast into daily data
    const dailyForecasts: Map<string, WeatherForecast> = new Map();

    for (const item of forecastData.list) {
      const date = item.dt_txt.split(' ')[0];

      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, {
          date,
          tempHigh: item.main.temp_max,
          tempLow: item.main.temp_min,
          conditions: item.weather[0].main,
          precipitation: item.pop || 0,
          windSpeed: item.wind.speed,
        });
      } else {
        const existing = dailyForecasts.get(date)!;
        existing.tempHigh = Math.max(existing.tempHigh, item.main.temp_max);
        existing.tempLow = Math.min(existing.tempLow, item.main.temp_min);
        existing.precipitation = Math.max(existing.precipitation, item.pop || 0);
      }
    }

    // Return next 5 days
    return Array.from(dailyForecasts.values()).slice(0, 5);
  }

  /**
   * Get weather outlook for a trip (combines forecast with recommendations)
   */
  async getTripWeatherOutlook(
    location: string,
    tripDuration: number,
  ): Promise<TripWeatherOutlook> {
    const forecast = await this.getWeatherForecast(location);

    // Calculate summary statistics
    const validForecast = forecast.slice(0, tripDuration);
    const avgTempHigh =
      validForecast.reduce((sum, f) => sum + f.tempHigh, 0) /
      validForecast.length;
    const avgTempLow =
      validForecast.reduce((sum, f) => sum + f.tempLow, 0) /
      validForecast.length;
    const rainDays = validForecast.filter(
      (f) => f.conditions.toLowerCase().includes('rain') || f.precipitation > 0.4,
    ).length;

    // Determine overall condition
    const condition = this.getOverallCondition(validForecast);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      avgTempHigh,
      avgTempLow,
      rainDays,
      condition,
    );

    return {
      location,
      tripDuration,
      forecast: validForecast,
      summary: {
        avgTempHigh: Math.round(avgTempHigh),
        avgTempLow: Math.round(avgTempLow),
        rainDays,
        condition,
        recommendation,
      },
    };
  }

  private getOverallCondition(forecast: WeatherForecast[]): string {
    const conditions = forecast.map((f) => f.conditions.toLowerCase());
    const rainCount = conditions.filter((c) => c.includes('rain')).length;
    const cloudCount = conditions.filter((c) => c.includes('cloud')).length;

    if (rainCount >= 3) return 'Rainy';
    if (cloudCount >= 3) return 'Cloudy';
    if (conditions.every((c) => c.includes('clear') || c.includes('sun'))) return 'Sunny';
    return 'Mixed';
  }

  private generateRecommendation(
    avgHigh: number,
    avgLow: number,
    rainDays: number,
    condition: string,
  ): string {
    const recommendations: string[] = [];

    // Temperature-based recommendations
    if (avgLow < 40) {
      recommendations.push('Bring warm layers and insulated jacket');
    }
    if (avgHigh > 80) {
      recommendations.push('Plan for heat and bring extra water');
    }

    // Rain-based recommendations
    if (rainDays > 0) {
      recommendations.push(`Rain expected on ${rainDays} day(s) - pack waterproof gear`);
    }

    // Condition-based recommendations
    if (condition === 'Sunny') {
      recommendations.push('Great conditions for outdoor activities');
    } else if (condition === 'Rainy') {
      recommendations.push('Consider indoor backup activities');
    }

    return recommendations.join('. ') || 'Conditions look generally favorable';
  }
}
