import type { TripLandscape } from '@packrat/schemas/trips';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Pressable, View } from 'react-native';
import type { LandscapeBucket } from '../utils/landscapes';
import { StatsCard } from './StatsParts';

export const LANDSCAPE_ICONS = Object.freeze({
  desert: 'cactus',
  mountain: 'image-filter-hdr',
  forest: 'pine-tree',
  coastal: 'waves',
  water: 'water',
  grassland: 'grass',
  polar: 'snowflake',
} as const satisfies Record<TripLandscape, string>);

/**
 * Trips by landscape, most first, each row opening its trips. Follows the stats screen's year and
 * activity filters; hidden when no trip has a place.
 */
export function LandscapesCard({
  buckets,
  onOpen,
}: {
  buckets: readonly LandscapeBucket[];
  onOpen: (landscape: TripLandscape) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  if (buckets.length === 0) return null;
  const most = Math.max(buckets[0]?.trips.length ?? 1, 1);
  return (
    <StatsCard title={t('tripStats.landscapes.title')} testID={testIds.tripStats.landscapesCard}>
      <View>
        {buckets.map((bucket) => {
          const name = t(`tripStats.landscapes.names.${bucket.landscape}`);
          const count = bucket.trips.length;
          return (
            <Pressable
              key={bucket.landscape}
              onPress={() => onOpen(bucket.landscape)}
              accessibilityRole="button"
              accessibilityLabel={t('tripStats.landscapes.rowLabel', {
                landscape: name,
                trips: t('tripStats.countTrips', { count }),
              })}
              android_ripple={{ color: colors.grey5 }}
              testID={testIds.tripStats.landscapeRow(bucket.landscape)}
              className="min-h-12 flex-row items-center gap-3 py-1.5"
            >
              <Icon name={LANDSCAPE_ICONS[bucket.landscape]} size={24} color={colors.primary} />
              <Text variant="body" className="flex-1" numberOfLines={1}>
                {name}
              </Text>
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: (60 * count) / most,
                  backgroundColor: colors.primary,
                  opacity: 0.35,
                }}
              />
              <Text
                variant="subhead"
                className="min-w-5 text-right font-semibold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {String(count)}
              </Text>
              <Icon name="chevron-right" size={24} color={colors.grey} />
            </Pressable>
          );
        })}
      </View>
    </StatsCard>
  );
}
