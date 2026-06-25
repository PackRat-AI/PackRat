import * as Localization from 'expo-localization';

// Only three countries still use imperial weight (lbs) as the standard
const IMPERIAL_WEIGHT_REGIONS = new Set(['US', 'LR', 'MM']);

// Countries/territories that use Fahrenheit for everyday temperature
const FAHRENHEIT_REGIONS = new Set(['US', 'BS', 'BZ', 'KY', 'PW', 'PR', 'GU', 'VI', 'AS', 'MP']);

export function getDefaultWeightUnit(): 'kg' | 'lb' {
  const region = Localization.getLocales()[0]?.regionCode ?? '';
  return IMPERIAL_WEIGHT_REGIONS.has(region) ? 'lb' : 'kg';
}

export function getDefaultTemperatureUnit(): 'C' | 'F' {
  const region = Localization.getLocales()[0]?.regionCode ?? '';
  return FAHRENHEIT_REGIONS.has(region) ? 'F' : 'C';
}

// mph/miles correlate with the same regions that use Fahrenheit
export function getDefaultSpeedUnit(): 'mph' | 'kmh' {
  const region = Localization.getLocales()[0]?.regionCode ?? '';
  return FAHRENHEIT_REGIONS.has(region) ? 'mph' : 'kmh';
}
