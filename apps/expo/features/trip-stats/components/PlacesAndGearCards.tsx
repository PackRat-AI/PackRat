import { Text } from '@packrat/ui/src/text';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { formatDecimal, formatList, formatNumber } from '../lib/useStatsFormat';
import { type IdleGear, idleTotalGrams } from '../utils/idleGear';
import {
  type CountryStatus,
  mostVisitedPlace,
  newPlaces,
  regionCount,
  regionLabel,
  type TripPlaces,
} from '../utils/tripPlaces';
import type { Scope } from '../utils/tripStats';
import { CardLink, StatsCard } from './StatsParts';

const FLAG_LIMIT = 8;
const PREVIEW_LIMIT = 3;

/** A big number over its label, side by side with the card's other figure. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View className="gap-0.5">
      <Text variant="title1" className="font-bold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="subhead" className="text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A row of flags, busiest country first, with "+N" past what fits. */
function FlagStrip({ countries }: { countries: readonly CountryStatus[] }) {
  const { colors } = useColorScheme();
  const flags = countries.flatMap((country) =>
    country.flag ? [{ code: country.code, flag: country.flag }] : [],
  );
  if (flags.length === 0) return null;
  const hidden = flags.length - FLAG_LIMIT;
  return (
    <View
      className="flex-row flex-wrap gap-1.5"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {flags.slice(0, FLAG_LIMIT).map(({ code, flag }) => (
        <View
          key={code}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.grey5 }}
        >
          <Text style={{ fontSize: 20, lineHeight: 26 }}>{flag}</Text>
        </View>
      ))}
      {hidden > 0 ? (
        <View
          className="h-9 items-center justify-center rounded-full px-3"
          style={{ backgroundColor: colors.grey5 }}
        >
          <Text variant="footnote" className="font-semibold text-muted-foreground">
            {`+${hidden}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "A, B, C and 2 more". */
function usePreviewList() {
  const { t } = useTranslation();
  return (names: readonly string[]) => {
    const shown = names.slice(0, PREVIEW_LIMIT);
    const rest = names.length - shown.length;
    return formatList(rest > 0 ? [...shown, t('tripStats.places.more', { count: rest })] : shown);
  };
}

/**
 * Countries and states counted, a strip of flags, and what's new or most visited, opening the
 * full list. Follows the stats screen's year and activity filters.
 */
export function PlacesCard({
  places,
  scope,
  onPress,
}: {
  places: TripPlaces;
  scope: Scope;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const preview = usePreviewList();
  if (places.countries.length === 0) return null;
  const regions = regionCount(places);
  const countriesLabel = t('tripStats.places.countries', { count: places.countries.length });
  const regionsLabel = t(`tripStats.places.nouns.${regionLabel(places)}`);

  let summary: string | null = null;
  if (scope.year != null) {
    const fresh = newPlaces({
      places,
      window: { start: new Date(scope.year, 0, 1), end: new Date(scope.year, 11, 31) },
    });
    if (fresh.length > 0) {
      summary = t('tripStats.places.newIn', {
        year: scope.year,
        places: preview(fresh.map((place) => place.name)),
      });
    }
  } else {
    const top = mostVisitedPlace(places);
    if (top) {
      summary = t('tripStats.places.mostVisited', {
        name: top.name,
        trips: t('tripStats.countTrips', { count: top.trips }),
      });
    }
  }

  return (
    <StatsCard title={t('tripStats.places.title')}>
      <CardLink onPress={onPress} testID={testIds.tripStats.placesCard}>
        <View className="flex-row gap-6">
          <Figure value={formatNumber(places.countries.length)} label={countriesLabel} />
          {regions > 0 ? <Figure value={formatNumber(regions)} label={regionsLabel} /> : null}
        </View>
        <FlagStrip countries={places.countries} />
        {summary ? (
          <Text variant="subhead" className="text-muted-foreground" numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
      </CardLink>
    </StatsCard>
  );
}

/** Gear in the user's packs that no finished trip carried in twelve months. */
export function IdleGearCard({ gear, onPress }: { gear: IdleGear; onPress: () => void }) {
  const { t } = useTranslation();
  const { unit, convertWeight } = useWeightUnit();
  const preview = usePreviewList();
  if (gear.items.length === 0) return null;
  const grams = idleTotalGrams(gear);
  return (
    <StatsCard
      title={t('tripStats.idleGear.title')}
      subtitle={t('tripStats.idleGear.subtitle', {
        date: gear.since.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      })}
    >
      <CardLink onPress={onPress} testID={testIds.tripStats.idleGearCard}>
        <View className="flex-row gap-6">
          <Figure
            value={formatNumber(gear.items.length)}
            label={t('tripStats.idleGear.items', { count: gear.items.length })}
          />
          {grams > 0 ? (
            <Figure
              value={`${formatDecimal(convertWeight({ weight: grams, fromUnit: 'g' }))} ${unit}`}
              label={t('tripStats.idleGear.combinedWeight')}
            />
          ) : null}
        </View>
        <Text variant="subhead" className="text-muted-foreground" numberOfLines={2}>
          {preview(gear.items.map((item) => item.name))}
        </Text>
      </CardLink>
    </StatsCard>
  );
}
