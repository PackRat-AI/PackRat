import { Icon } from '@roninoss/icons';
import { getWeatherIconName, getWeatherIconByCondition } from '../lib/weatherIcons';

type WeatherIconProps = {
  // Either provide a condition code or text
  code?: number;
  condition?: string;
  isDay?: number;
  size?: number;
  color?: string;
  className?: string;
};

export function WeatherIcon({
  code,
  condition,
  isDay = 1,
  size = 24,
  color = 'white',
  className,
}: WeatherIconProps) {
  // Determine which icon to use
  let iconName: string;

  if (code !== undefined) {
    // If we have a code, use that for mapping
    iconName = getWeatherIconName(code, isDay);
  } else if (condition) {
    // If we have condition text, use that for mapping
    iconName = getWeatherIconByCondition(condition, isDay);
  } else {
    // Default fallback
    iconName = isDay ? 'weather-sunny' : 'weather-night';
  }

  return <Icon name={iconName} size={size} color={color} className={className} />;
}
