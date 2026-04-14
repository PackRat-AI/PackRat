import { getWeatherData } from 'expo-app/features/weather/lib/weatherService';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { activeLocationAtom } from '../atoms/locationsAtoms';

export type WeatherAlert = {
  id: string;
  type: string;
  location: string;
  dates: string;
  severity: 'Low' | 'Moderate' | 'High';
  details: string;
};

// Minimal shape of the weather API response used by this alert generator.
// The upstream API payload is much richer; we only type the fields we read.
type ApiAlert = {
  event?: string;
  effective?: string;
  expires?: string;
  areas?: string;
  severity?: string;
  desc?: string;
  instruction?: string;
};

type ForecastHour = {
  condition?: { text?: string };
  wind_kph?: number;
};

type ForecastDay = {
  hour?: ForecastHour[];
  day?: { maxtemp_c?: number };
  date?: string;
};

type WeatherCurrent = {
  temp_c?: number;
  wind_kph?: number;
  uv?: number;
  air_quality?: Record<string, number | undefined>;
  condition?: { text?: string };
};

export type WeatherApiData = {
  location?: { name?: string };
  alerts?: { alert?: ApiAlert[] };
  current?: WeatherCurrent;
  forecast?: { forecastday?: ForecastDay[] };
};

type ActiveLocation = { name?: string } | null;

export function generateAlerts(
  data: WeatherApiData | undefined,
  activeLocation: ActiveLocation,
): WeatherAlert[] {
  const locationName = data?.location?.name || activeLocation?.name || 'Unknown';
  const apiAlerts = data?.alerts?.alert;

  const alerts: WeatherAlert[] = [];

  if (apiAlerts && apiAlerts.length > 0) {
    return apiAlerts.map((a: ApiAlert, index: number) => ({
      id: `${a.event}-${a.effective}-${index}`,
      type: a.event || 'Weather Alert',
      location: a.areas || locationName,
      dates: `${a.effective} - ${a.expires}`,
      severity: a.severity === 'Severe' ? 'High' : a.severity === 'Moderate' ? 'Moderate' : 'Low',
      details: a.desc || a.instruction || 'No details available',
    }));
  }

  const current = data?.current || {};
  const forecastDays = data?.forecast?.forecastday || [];

  const temp = current?.temp_c;
  const wind = current?.wind_kph;
  const uv = current?.uv;
  const airQuality = current?.air_quality?.['us-epa-index'];
  const condition = current?.condition?.text?.toLowerCase() || '';

  // 🌡 Heat
  if (temp !== undefined && temp >= 35) {
    alerts.push({
      id: 'heat',
      type: 'Heat Advisory',
      location: locationName,
      dates: 'Now',
      severity: 'High',
      details: 'High temperature. Stay hydrated.',
    });
  }

  // ❄️ Cold
  if (temp !== undefined && temp <= 5) {
    alerts.push({
      id: 'cold',
      type: 'Cold Alert',
      location: locationName,
      dates: 'Now',
      severity: 'Moderate',
      details: 'Low temperature. Wear warm clothes.',
    });
  }

  // 💨 Wind
  if (wind !== undefined && wind >= 25) {
    alerts.push({
      id: 'wind',
      type: 'High Wind',
      location: locationName,
      dates: 'Now',
      severity: 'Moderate',
      details: 'Strong winds expected.',
    });
  }

  // 🌧 Rain
  if (condition.includes('rain') || condition.includes('drizzle')) {
    alerts.push({
      id: 'rain-now',
      type: 'Rain Alert',
      location: locationName,
      dates: 'Now',
      severity: 'Moderate',
      details: 'Rain expected. Carry an umbrella.',
    });
  }

  // 🌫 Fog
  if (condition.includes('fog') || condition.includes('mist')) {
    alerts.push({
      id: 'fog',
      type: 'Low Visibility',
      location: locationName,
      dates: 'Now',
      severity: 'Low',
      details: 'Drive carefully due to low visibility.',
    });
  }

  // ☀️ UV
  if (uv !== undefined && uv >= 7) {
    alerts.push({
      id: 'uv',
      type: 'High UV',
      location: locationName,
      dates: 'Now',
      severity: 'Moderate',
      details: 'High UV index. Use sunscreen.',
    });
  }

  // 🌫 Air Quality
  if (airQuality !== undefined && airQuality >= 3) {
    alerts.push({
      id: 'air',
      type: 'Air Quality Alert',
      location: locationName,
      dates: 'Now',
      severity: 'Moderate',
      details: 'Air quality is unhealthy.',
    });
  }

  const todayHours = forecastDays[0]?.hour || [];

  // 🌧 Rain coming soon
  const willRain = todayHours.some((h: ForecastHour) =>
    h.condition?.text?.toLowerCase().includes('rain'),
  );
  if (willRain) {
    alerts.push({
      id: 'rain-soon',
      type: 'Rain Expected',
      location: locationName,
      dates: 'Next few hours',
      severity: 'Moderate',
      details: 'Rain expected soon.',
    });
  }

  // 💨 Wind coming
  const highWindComing = todayHours.some((h: ForecastHour) => (h.wind_kph ?? 0) >= 30);
  if (highWindComing) {
    alerts.push({
      id: 'wind-soon',
      type: 'Strong Wind Expected',
      location: locationName,
      dates: 'Next few hours',
      severity: 'Moderate',
      details: 'Wind speed may increase.',
    });
  }

  // 🌡 Tomorrow heat
  const tomorrow = forecastDays[1];
  const tomorrowMax = tomorrow?.day?.maxtemp_c;
  if (tomorrow && tomorrowMax !== undefined && tomorrowMax >= 35) {
    alerts.push({
      id: 'heat-tomorrow',
      type: 'Heat Alert (Tomorrow)',
      location: locationName,
      dates: tomorrow.date ?? '',
      severity: 'High',
      details: 'High temperature expected tomorrow.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'clear',
      type: 'No Active Alerts',
      location: locationName,
      dates: 'Now',
      severity: 'Low',
      details: 'Weather is normal.',
    });
  }

  return alerts;
}

/**
 * Hook to fetch and manage weather alerts
 */
export function useWeatherAlerts() {
  const activeLocation = useAtomValue(activeLocationAtom);

  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeLocation?.id) {
      setLoading(false);
      return;
    }

    const locationId = activeLocation.id;

    async function fetchAlerts() {
      setLoading(true);
      setError(null);

      try {
        const data = await getWeatherData(locationId);
        const formatted = generateAlerts(data as unknown as WeatherApiData, activeLocation);
        setAlerts(formatted);
      } catch (err) {
        console.error('Weather alerts error:', err);
        setError('Failed to fetch weather alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [activeLocation]);

  return {
    alerts,
    loading,
    error,
    activeLocation,
  };
}
