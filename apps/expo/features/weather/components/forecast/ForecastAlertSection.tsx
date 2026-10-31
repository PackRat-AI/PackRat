import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  type AlertSeverityTone,
  alertId,
  alertSeverityTone,
  alertTitle,
} from '../../utils/alertState';

// Severity stripe colours: the M3 error red for the worst, then the warning
// ramp, then a neutral info blue.
const TONE_COLOR: Record<AlertSeverityTone, string> = Object.freeze({
  extreme: '#F2B8B5',
  severe: '#FFB870',
  moderate: '#FFE082',
  other: '#A8C7FA',
} as const);

function AlertCard({ alert }: { alert: WeatherAlertItem }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const tone = alertSeverityTone(alert.severity);
  const title = alertTitle(alert);

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityHint={expanded ? t('weather.collapseAlert') : t('weather.expandAlert')}
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      className="flex-row overflow-hidden rounded-xl bg-black/25"
    >
      <View style={{ width: 4, backgroundColor: TONE_COLOR[tone] }} />
      <View className="flex-1 gap-1 p-4">
        <View className="flex-row items-start gap-3">
          <Icon name="alert" size={20} color={TONE_COLOR[tone]} />
          <View className="flex-1">
            <Text className="font-semibold text-white">{title}</Text>
            {alert.severity ? (
              <Text variant="footnote" className="capitalize text-white/80">
                {alert.severity.toLowerCase()}
              </Text>
            ) : null}
          </View>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="white" />
        </View>
        {expanded ? (
          <View className="mt-2 gap-2">
            {alert.areas ? (
              <Text variant="footnote" className="text-white/80">
                {alert.areas}
              </Text>
            ) : null}
            {alert.desc ? <Text className="text-white">{alert.desc}</Text> : null}
            {alert.instruction ? (
              <Text className="font-semibold text-white">{alert.instruction}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The forecast's alert surface: every active alert as an expandable card,
 * followed by the offer to watch the place — or the note that it is watched.
 */
export function ForecastAlertSection({
  alerts,
  monitoringEnabled,
  isWatched,
  isUpdatingWatch,
  onWatch,
}: {
  alerts: readonly WeatherAlertItem[];
  monitoringEnabled: boolean;
  isWatched: boolean;
  isUpdatingWatch: boolean;
  onWatch: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-3" testID={testIds.weather.alertSection}>
      <Text variant="footnote" className="font-medium uppercase tracking-wide text-white/80">
        {alerts.length === 1 ? t('weather.activeAlert') : t('weather.activeAlerts')}
      </Text>
      {alerts.map((alert) => (
        <AlertCard key={alertId(alert)} alert={alert} />
      ))}
      {monitoringEnabled && !isWatched ? (
        <View className="gap-3 pt-1">
          <Text variant="subhead" className="text-white/90">
            {t('weather.watchCtaBody')}
          </Text>
          <Button
            variant="tonal"
            onPress={onWatch}
            disabled={isUpdatingWatch}
            testID={testIds.weather.watchCta}
          >
            {isUpdatingWatch ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon name="bell-outline" size={18} />
            )}
            <Text>{t('weather.watchThisLocation')}</Text>
          </Button>
        </View>
      ) : null}
      {monitoringEnabled && isWatched ? (
        <View className="flex-row items-center gap-2 pt-1">
          <Icon name="bell-check" size={18} color="white" />
          <Text variant="subhead" className="text-white/90">
            {t('weather.youAreWatching')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
