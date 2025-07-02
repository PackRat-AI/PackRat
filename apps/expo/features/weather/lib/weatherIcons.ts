import type { MaterialIconName } from '@roninoss/icons';

// List of available weather-related icons
const AVAILABLE_WEATHER_ICONS = [
  'cloud',
  'cloud-outline',
  'lightning-bolt',
  'lightning-bolt-outline',
  'sun-thermometer',
  'sun-thermometer-outline',
  'umbrella',
  'umbrella-outline',
  'water',
  'water-circle',
  'water-outline',
  'weather-lightning',
  'weather-night',
  'weather-rainy',
  'weather-sunny',
  'weather-sunny-alert',
  'weather-tornado',
] as const;

type AvailableWeatherIcon = (typeof AVAILABLE_WEATHER_ICONS)[number];

/**
 * Maps weather condition codes to available icons
 * @param code The weather condition code
 * @param isDay Whether it's daytime (true) or nighttime (false)
 * @returns The icon name to use
 */
export function getWeatherIconName(code: number, isDay = 1): MaterialIconName {
  // Clear conditions
  if (code === 1000) {
    return isDay ? 'weather-sunny' : 'weather-night';
  }

  // Partly cloudy
  if (code >= 1003 && code <= 1006) {
    return isDay ? 'cloud-outline' : 'cloud-outline';
  }

  // Cloudy
  if (code >= 1009 && code <= 1030) {
    return 'cloud';
  }

  // Fog, mist
  if (code >= 1030 && code <= 1039) {
    return 'cloud-outline'; // Best approximation for fog
  }

  // Rain, drizzle
  if (
    (code >= 1063 && code <= 1069) ||
    (code >= 1150 && code <= 1201) ||
    (code >= 1240 && code <= 1246)
  ) {
    return 'weather-rainy';
  }

  // Snow
  if ((code >= 1114 && code <= 1117) || (code >= 1204 && code <= 1237)) {
    return 'water-outline'; // Best approximation for snow
  }

  // Sleet, freezing rain
  if (code >= 1069 && code <= 1072) {
    return 'water'; // Best approximation for sleet
  }

  // Thunderstorm
  if ((code >= 1087 && code <= 1087) || (code >= 1273 && code <= 1282)) {
    return 'weather-lightning';
  }

  // Heavy rain
  if (code >= 1240 && code <= 1246) {
    return 'umbrella';
  }

  // Extreme weather
  if (code >= 1273) {
    return 'weather-tornado';
  }

  // Hot conditions
  if (code === 1000 && isDay) {
    return 'sun-thermometer';
  }

  // Weather alerts
  if (code === 1000 && isDay) {
    return 'weather-sunny-alert';
  }

  // Default fallback
  return isDay ? 'weather-sunny' : 'weather-night';
}

/**
 * Maps weather condition text to available icons
 * @param condition The weather condition text
 * @param isDay Whether it's daytime (true) or nighttime (false)
 * @returns The icon name to use
 */
export function getWeatherIconByCondition(condition: string, isDay = 1): MaterialIconName {
  const conditionLower = condition.toLowerCase();

  // Clear, sunny
  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return isDay ? 'weather-sunny' : 'weather-night';
  }

  // Partly cloudy
  if (conditionLower.includes('partly cloudy')) {
    return 'cloud-outline';
  }

  // Cloudy, overcast
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return 'cloud';
  }

  // Fog, mist, haze
  if (
    conditionLower.includes('fog') ||
    conditionLower.includes('mist') ||
    conditionLower.includes('haze')
  ) {
    return 'cloud-outline';
  }

  // Rain, drizzle, shower
  if (
    conditionLower.includes('rain') ||
    conditionLower.includes('drizzle') ||
    conditionLower.includes('shower')
  ) {
    return conditionLower.includes('heavy') ? 'umbrella' : 'weather-rainy';
  }

  // Snow
  if (conditionLower.includes('snow') || conditionLower.includes('blizzard')) {
    return 'water-outline';
  }

  // Sleet, freezing rain
  if (conditionLower.includes('sleet') || conditionLower.includes('freezing')) {
    return 'water';
  }

  // Thunderstorm
  if (
    conditionLower.includes('thunder') ||
    conditionLower.includes('lightning') ||
    conditionLower.includes('storm')
  ) {
    return 'weather-lightning';
  }

  // Hot conditions
  if (conditionLower.includes('hot')) {
    return 'sun-thermometer';
  }

  // Default fallback
  return isDay ? 'weather-sunny' : 'weather-night';
}

/**
 * Get background gradient colors based on weather condition
 */
export function getWeatherBackgroundColors(code: number, isNight: boolean): string[] {
  if (isNight) {
    // Night gradients
    if (code === 1000) return ['#1a2a3a', '#0c1824', '#05101a']; // Clear night
    if (code >= 1003 && code <= 1009) return ['#2c3e50', '#1a2a3a', '#0c1824']; // Partly cloudy night
    if (code >= 1030 && code <= 1039) return ['#4b6584', '#2c3e50', '#1a2a3a']; // Foggy night
    if (code >= 1063 && code <= 1069) return ['#3c6382', '#2c3e50', '#1a2a3a']; // Light rain night
    if (code >= 1087 && code <= 1117) return ['#2c2c54', '#1a1a2e', '#0c0c1a']; // Thunderstorm night
    if (code >= 1150 && code <= 1201) return ['#3c6382', '#2c3e50', '#1a2a3a']; // Rain night
    if (code >= 1204 && code <= 1237) return ['#4b6584', '#2c3e50', '#1a2a3a']; // Snow night
    if (code >= 1240 && code <= 1246) return ['#3c6382', '#2c3e50', '#1a2a3a']; // Heavy rain night
    if (code >= 1249 && code <= 1264) return ['#4b6584', '#2c3e50', '#1a2a3a']; // Sleet night
    if (code >= 1273 && code <= 1282) return ['#2c2c54', '#1a1a2e', '#0c0c1a']; // Thunderstorm with rain night
  } else {
    // Day gradients
    if (code === 1000) return ['#4287f5', '#3a77d9', '#2e5eae']; // Clear day
    if (code >= 1003 && code <= 1009) return ['#5d8bc3', '#4287f5', '#3a77d9']; // Partly cloudy day
    if (code >= 1030 && code <= 1039) return ['#7a7a7a', '#5d6273', '#4a4e5c']; // Foggy day
    if (code >= 1063 && code <= 1069) return ['#5d6273', '#4a4e5c', '#3a3e49']; // Light rain day
    if (code >= 1087 && code <= 1117) return ['#525580', '#3a3e5c', '#2e3149']; // Thunderstorm day
    if (code >= 1150 && code <= 1201) return ['#5d6273', '#4a4e5c', '#3a3e49']; // Rain day
    if (code >= 1204 && code <= 1237) return ['#a3b8cc', '#8ca6b9', '#7590a3']; // Snow day
    if (code >= 1240 && code <= 1246) return ['#5d6273', '#4a4e5c', '#3a3e49']; // Heavy rain day
    if (code >= 1249 && code <= 1264) return ['#7590a3', '#5d7a8c', '#4a6273']; // Sleet day
    if (code >= 1273 && code <= 1282) return ['#525580', '#3a3e5c', '#2e3149']; // Thunderstorm with rain day
  }

  // Default gradient
  return isNight ? ['#1a2a3a', '#0c1824', '#05101a'] : ['#4287f5', '#3a77d9', '#2e5eae'];
}
