import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { SearchField, StatsRow } from 'expo-app/features/trip-stats/components/StatsParts';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMeasuredRegions, type MeasuredRegion } from '../lib/namedRegions';
import { matchRegions, NAMED_REGION_KINDS, type NamedRegionKind } from '../utils/namedRegions';

const SECTION_TITLE_KEYS = Object.freeze({
  park: 'offlineMaps.regionsParks',
  forest: 'offlineMaps.regionsForests',
  region: 'offlineMaps.regionsStates',
  country: 'offlineMaps.regionsCountries',
} as const satisfies Record<NamedRegionKind, string>);

/**
 * Find a park, forest, state or country by name, then save the map inside its outline. Places too
 * big to save whole stay listed with a note, and open on the picker's explanation of the fix.
 */
export function OfflineRegionListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const [query, setQuery] = useState('');
  const [measured, setMeasured] = useState<MeasuredRegion[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by Try again, which re-runs the load below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getMeasuredRegions().then(
      (found) => {
        if (live) setMeasured(found);
      },
      (error: unknown) => {
        Sentry.captureException(error, {
          tags: { feature: 'offlineMaps', action: 'measureRegions' },
        });
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const sections = useMemo(() => {
    const fits = new Map(measured?.map((item) => [item.region.id, item.fits]));
    const matches = matchRegions({ regions: measured?.map((item) => item.region) ?? [], query });
    return NAMED_REGION_KINDS.map((kind) => ({
      kind,
      title: t(SECTION_TITLE_KEYS[kind]),
      data: matches
        .filter((region) => region.kind === kind)
        .map((region) => ({ region, fits: fits.get(region.id) ?? true })),
    })).filter((section) => section.data.length > 0);
  }, [measured, query, t]);

  return (
    <SafeAreaView
      edges={['bottom']}
      className="flex-1 bg-background"
      testID={testIds.offlineMaps.regionList}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.region.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('offlineMaps.regionsSearch')}
            testID={testIds.offlineMaps.regionSearch}
          />
        }
        ListEmptyComponent={
          failed ? (
            <View className="items-center gap-3 px-6 pt-10">
              <Text variant="callout" className="text-center text-muted-foreground" wrap>
                {t('offlineMaps.regionsFailed')}
              </Text>
              <Button variant="tonal" onPress={() => setAttempt((count) => count + 1)}>
                <Text>{t('offlineMaps.tryAgain')}</Text>
              </Button>
            </View>
          ) : measured === null ? (
            <View className="items-center pt-10">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Text variant="callout" className="px-6 pt-10 text-center text-muted-foreground" wrap>
              {t('offlineMaps.regionsNoMatch', { query: query.trim() })}
            </Text>
          )
        }
        renderSectionHeader={({ section }) => (
          <Text variant="subhead" className="px-4 pb-1 pt-4 text-muted-foreground">
            {section.title}
          </Text>
        )}
        renderItem={({ item: { region, fits } }) => (
          <StatsRow
            title={region.name}
            subtitle={region.subtitle || null}
            trailing={
              fits ? undefined : (
                <Text variant="footnote" className="text-muted-foreground">
                  {t('offlineMaps.regionTooLarge')}
                </Text>
              )
            }
            onPress={() =>
              router.push({ pathname: '/offline-maps/pick', params: { regionId: region.id } })
            }
            testID={testIds.offlineMaps.regionRow(region.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}
