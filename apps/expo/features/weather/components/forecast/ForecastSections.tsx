import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import type { WeatherLocation } from '../../types';
import { WeatherIcon } from '../WeatherIcon';

// A rain chance below this is noise on a daily row; the hourly strip shows any.
const DAILY_RAIN_THRESHOLD = 20;
const SUMMARY_RAIN_THRESHOLD = 30;

/** A translucent filled surface over the sky gradient, the one container every section uses. */
function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('rounded-xl bg-black/20 p-4', className)}>{children}</View>;
}

function SectionLabel({
  icon,
  children,
}: {
  icon: 'clock-outline' | 'calendar';
  children: string;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Icon name={icon} size={16} color="rgba(255,255,255,0.8)" />
      <Text variant="footnote" className="font-medium uppercase tracking-wide text-white/80">
        {children}
      </Text>
    </View>
  );
}

export function ForecastHero({ location }: { location: WeatherLocation }) {
  const { displayTemperature } = useTemperatureUnit();
  return (
    <View className="items-center pb-2 pt-4">
      <Text className="text-3xl font-normal text-white" accessibilityRole="header">
        {location.name}
      </Text>
      <Text className="mt-1 text-white/80">{location.time}</Text>
      <Text
        className="mt-2 text-white"
        style={{ fontSize: 96, fontWeight: '200', lineHeight: 104 }}
      >
        {displayTemperature(location.temperature)}
      </Text>
      <Text className="text-xl text-white">{location.condition}</Text>
      <Text className="mt-1 text-white/80">
        H:{displayTemperature(location.highTemp)} L:{displayTemperature(location.lowTemp)}
      </Text>
    </View>
  );
}

export function HourlyForecastStrip({ location }: { location: WeatherLocation }) {
  const { t } = useTranslation();
  const { displayTemperature } = useTemperatureUnit();
  const hours = location.hourlyForecast ?? [];
  if (hours.length === 0) return null;

  const rain = location.chanceOfRain ?? 0;
  const summary = [
    t('weather.todaySummary', { condition: location.condition }),
    rain >= SUMMARY_RAIN_THRESHOLD ? t('weather.rainChanceSentence', { percent: rain }) : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Surface>
      <Text className="mb-3 text-white">{summary}</Text>
      <View className="mb-3 h-px bg-white/20" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {hours.map((hour, index) => (
          <View key={hour.time} className="mr-5 min-w-[44px] items-center gap-1">
            <Text variant="footnote" className="font-medium text-white">
              {index === 0 ? t('weather.now') : hour.time}
            </Text>
            <WeatherIcon code={hour.weatherCode} isDay={hour.isDay} color="white" size={24} />
            <Text variant="caption2" className="text-sky-200">
              {hour.chanceOfRain ? `${hour.chanceOfRain}%` : ' '}
            </Text>
            <Text className="text-white">{displayTemperature(hour.temp)}</Text>
          </View>
        ))}
      </ScrollView>
    </Surface>
  );
}

export function DailyForecastList({ location }: { location: WeatherLocation }) {
  const { t } = useTranslation();
  const { displayTemperature } = useTemperatureUnit();
  const days = location.dailyForecast ?? [];
  if (days.length === 0) return null;

  // Each day's bar sits within the whole period's range, so the rows compare.
  const periodLow = Math.min(...days.map((d) => d.low));
  const periodHigh = Math.max(...days.map((d) => d.high));
  const span = Math.max(1, periodHigh - periodLow);

  return (
    <Surface>
      <SectionLabel icon="calendar">{t('weather.tenDayForecast')}</SectionLabel>
      {days.map((day, index) => (
        <View
          key={`${day.day}-${index}`}
          className={cn(
            'min-h-[48px] flex-row items-center gap-3',
            index < days.length - 1 && 'border-b border-white/15',
          )}
        >
          <Text className="w-12 text-white">{index === 0 ? t('weather.today') : day.day}</Text>
          <View className="w-10 items-center">
            <Icon name={day.icon} color="white" size={22} />
            {(day.chanceOfRain ?? 0) >= DAILY_RAIN_THRESHOLD ? (
              <Text variant="caption2" className="text-sky-200">
                {day.chanceOfRain}%
              </Text>
            ) : null}
          </View>
          <Text className="w-11 text-right text-white/70">{displayTemperature(day.low)}</Text>
          <View className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <LinearGradient
              colors={['#7DD3FC', '#FDE68A', '#FDBA74']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                borderRadius: 2,
                left: `${((day.low - periodLow) / span) * 100}%`,
                right: `${((periodHigh - day.high) / span) * 100}%`,
              }}
            />
          </View>
          <Text className="w-11 text-right text-white">{displayTemperature(day.high)}</Text>
        </View>
      ))}
    </Surface>
  );
}

function ConditionTile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View className="w-1/2 p-1.5">
      <View className="rounded-xl bg-black/20 p-4">
        <View className="mb-2 flex-row items-center gap-1.5">
          <Icon name={icon} size={16} color="rgba(255,255,255,0.8)" />
          <Text variant="footnote" className="font-medium uppercase tracking-wide text-white/80">
            {label}
          </Text>
        </View>
        <Text className="text-3xl font-normal text-white">{value}</Text>
      </View>
    </View>
  );
}

export function ConditionTiles({ location }: { location: WeatherLocation }) {
  const { t } = useTranslation();
  const { displayTemperature } = useTemperatureUnit();
  const { displayWindSpeed } = useSpeedUnit();
  const details = location.details;
  if (!details) return null;

  return (
    <View className="-m-1.5 flex-row flex-wrap">
      <ConditionTile
        icon="thermometer"
        label={t('weather.feelsLike')}
        value={displayTemperature(details.feelsLike)}
      />
      <ConditionTile
        icon="water-percent"
        label={t('weather.humidity')}
        value={`${details.humidity}%`}
      />
      <ConditionTile
        icon="weather-windy"
        label={t('weather.wind')}
        value={displayWindSpeed(details.windSpeed)}
      />
      <ConditionTile
        icon="white-balance-sunny"
        label={t('weather.uvIndex')}
        value={String(Math.round(details.uvIndex))}
      />
    </View>
  );
}
