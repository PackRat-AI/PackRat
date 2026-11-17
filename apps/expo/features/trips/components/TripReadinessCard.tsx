import { use$ } from '@legendapp/state/react';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { Icon, type MaterialIconName } from 'expo-app/components/Icon';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { getPackItems } from 'expo-app/features/packs/store/packItems';
import { packingModeStore } from 'expo-app/features/packs/store/packingMode';
import { WeatherAttribution } from 'expo-app/features/weather/components/WeatherAttribution';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { tripConditionsStore } from '../store/tripReminders';
import type { Trip } from '../types';
import { packAdvice, type TripConditions, temperatureSummary } from '../utils/tripConditions';
import {
  daysUntilStart,
  fieldChargingTip,
  listNames,
  openChecklistTitles,
  packedIdsFrom,
  packState,
} from '../utils/tripReminderPlanner';

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Row({
  icon,
  tint,
  title,
  children,
}: {
  icon: MaterialIconName;
  tint: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="w-6 items-center pt-0.5">
        <Icon name={icon} size={20} color={tint} />
      </View>
      <View className="flex-1 gap-1">
        <Text variant="callout" className="font-semibold text-foreground">
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return (
    <Text variant="callout" className="text-muted-foreground">
      {children}
    </Text>
  );
}

/**
 * The top of a trip in the week before it starts: what's left to pack, what
 * needs a charge, the forecast and the Before-you-go list — the same picture
 * the pre-trip reminders carry, so a reminder tap lands on what's left.
 */
export function TripReadinessCard({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { unit } = useTemperatureUnit();
  const items = use$(() => (trip.packId ? getPackItems(trip.packId) : null));
  const packed = use$(() =>
    trip.packId ? obs({ store: packingModeStore, id: trip.packId }).get() : null,
  );
  const conditions = use$(() => obs({ store: tripConditionsStore, id: trip.id }).get());

  const state = packState({ items, packedItemIds: packedIdsFrom(packed) });
  const days = daysUntilStart({ trip, now: new Date() }) ?? 0;
  const leaves =
    days <= 0
      ? t('trips.reminders.leavesToday')
      : days === 1
        ? t('trips.reminders.leavesTomorrow')
        : t('trips.reminders.leavesInDays', { count: days });
  const tip = fieldChargingTip({ trip, state });
  const todo = openChecklistTitles(trip);
  const { progress } = state;
  // Lands in packing mode: the card is about what's left to pack.
  const openPack = () => trip.packId && router.push(`/pack/${trip.packId}?packing=1`);

  const rows = [
    progress.kind === 'noPack' && (
      <Pressable
        key="pack"
        onPress={() => router.push(`/trip/${trip.id}/edit`)}
        testID={testIds.trips.readinessLinkPack}
      >
        <Row icon="bag-personal-outline" tint={colors.primary} title={t('trips.reminders.noPack')}>
          <Text variant="callout" className="font-semibold text-primary">
            {t('trips.reminders.linkPack')}
          </Text>
        </Row>
      </Pressable>
    ),
    progress.kind === 'empty' && (
      <Pressable key="pack" onPress={openPack}>
        <Row
          icon="bag-personal-outline"
          tint={colors.primary}
          title={t('trips.reminders.packEmpty')}
        >
          <Detail>{t('trips.reminders.packEmptyDetail')}</Detail>
        </Row>
      </Pressable>
    ),
    progress.kind === 'partial' && (
      <Pressable key="pack" onPress={openPack} testID={testIds.trips.readinessPacking}>
        <Row
          icon="bag-personal"
          tint={colors.primary}
          title={t('trips.reminders.packedCount', {
            packed: progress.packed,
            total: progress.total,
          })}
        >
          <View className="my-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${(progress.packed / progress.total) * 100}%` }}
            />
          </View>
          <Detail>{t('trips.reminders.stillToPack', { items: listNames(state.unpacked) })}</Detail>
        </Row>
      </Pressable>
    ),
    state.chargeable.length > 0 && (
      <Row key="charge" icon="flash" tint={colors.yellow} title={t('trips.reminders.chargeTitle')}>
        <Detail>{capitalizeFirst(listNames(state.chargeable))}</Detail>
      </Row>
    ),
    conditions ? (
      <ForecastRows key="forecast" conditions={conditions} celsius={unit === 'C'} />
    ) : (
      trip.location && (
        <Row
          key="forecast"
          icon="weather-partly-cloudy"
          tint="#06B6D4"
          title={t('trips.reminders.forecast')}
        >
          <Detail>{t('trips.reminders.forecastPending')}</Detail>
        </Row>
      )
    ),
    tip && (
      <Row
        key="tip"
        icon="battery-charging-high"
        tint={colors.yellow}
        title={t('trips.reminders.fieldCharging')}
      >
        <Detail>{tip}</Detail>
      </Row>
    ),
    todo.length > 0 && (
      <Row
        key="todo"
        icon="clipboard-check-outline"
        tint="#8B5CF6"
        title={t('trips.reminders.beforeYouGo')}
      >
        <Detail>{capitalizeFirst(listNames(todo))}</Detail>
      </Row>
    ),
  ].filter(Boolean);

  return (
    <View className="mb-6" testID={testIds.trips.readinessCard}>
      {/* Keyed by what it shows: a Compose card sizes to its content once. */}
      <Card
        key={`${progress.kind}|${rows.length}|${conditions?.fetchedAt ?? 0}`}
        className="gap-4 p-4"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon name="hiking" size={20} color={colors.primary} />
            <Text variant="subhead" className="font-semibold text-primary">
              {leaves}
            </Text>
          </View>
          {progress.kind === 'done' && (
            <View className="flex-row items-center gap-1" testID={testIds.trips.readinessAllPacked}>
              <Icon name="check-circle" size={18} color={colors.green} />
              <Text variant="subhead" className="font-semibold" textColor={colors.green}>
                {t('trips.reminders.allPacked')}
              </Text>
            </View>
          )}
        </View>
        {rows}
      </Card>
    </View>
  );
}

function ForecastRows({ conditions, celsius }: { conditions: TripConditions; celsius: boolean }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const summary = [
    temperatureSummary({ conditions, celsius }),
    conditions.maxChanceOfRain >= 20
      ? t('trips.reminders.chanceOfRain', { percent: conditions.maxChanceOfRain })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="gap-4" testID={testIds.trips.readinessForecast}>
      {conditions.alerts.map((alert) => (
        <Row key={alert.id} icon="alert" tint={colors.destructive} title={alert.event}>
          <Detail>{t('trips.reminders.alertDetail')}</Detail>
        </Row>
      ))}
      <Row icon="weather-partly-cloudy" tint="#06B6D4" title={t('trips.reminders.forecast')}>
        <Detail>{summary}</Detail>
        {packAdvice({ conditions, celsius }).map((line) => (
          <Detail key={line}>{line}</Detail>
        ))}
        {conditions.coveredDays < conditions.tripDays && (
          <Text variant="footnote" className="text-muted-foreground">
            {t('trips.reminders.forecastCoverage', {
              covered: conditions.coveredDays,
              total: conditions.tripDays,
            })}
          </Text>
        )}
        {conditions.attribution && <WeatherAttribution attribution={conditions.attribution} />}
      </Row>
    </View>
  );
}
