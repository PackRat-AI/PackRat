import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAtom } from 'jotai';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { wildlifeHistoryAtom } from '../atoms/wildlifeAtoms';
import { getSpeciesById } from '../data/speciesDatabase';

const DANGER_BADGE = {
  safe: 'bg-green-100 dark:bg-green-900/30',
  caution: 'bg-yellow-100 dark:bg-yellow-900/30',
  dangerous: 'bg-red-100 dark:bg-red-900/30',
} as const;

const DANGER_TEXT = {
  safe: 'text-green-700 dark:text-green-400',
  caution: 'text-yellow-700 dark:text-yellow-400',
  dangerous: 'text-red-700 dark:text-red-400',
} as const;

export function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [historyLoadable] = useAtom(wildlifeHistoryAtom);

  // The id can be either a species id (from database browse) or a history entry id
  const species = getSpeciesById(id);

  // If not found in species db, search history:
  //   1. by history-entry id (navigating from WildlifeScreen history list)
  //   2. by species id within any entry's results (navigating from IdentificationScreen result)
  const historyEntry =
    !species && historyLoadable.state === 'hasData'
      ? historyLoadable.data.find((h) => h.id === id || h.results.some((r) => r.species.id === id))
      : null;

  const displaySpecies =
    species ??
    historyEntry?.results.find((r) => r.species.id === id)?.species ??
    historyEntry?.results[0]?.species;

  // Show a spinner while history is still loading (prevents premature "not found" state)
  if (!species && historyLoadable.state === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: t('wildlife.speciesDetail') }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!displaySpecies) {
    return (
      <>
        <Stack.Screen options={{ title: t('wildlife.speciesDetail') }} />
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-muted-foreground">{t('wildlife.speciesNotFound')}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: displaySpecies.commonName }} />
      <ScrollView className="flex-1 bg-background">
        <View className="p-4">
          {/* Header */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-foreground mb-1">
              {displaySpecies.commonName}
            </Text>
            <Text className="text-base italic text-muted-foreground mb-3">
              {displaySpecies.scientificName}
            </Text>

            {/* Badges */}
            <View className="flex-row flex-wrap gap-2">
              <View
                className={`px-3 py-1 rounded-full ${DANGER_BADGE[displaySpecies.dangerLevel]}`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${DANGER_TEXT[displaySpecies.dangerLevel]}`}
                >
                  {displaySpecies.dangerLevel}
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-primary/10">
                <Text className="text-sm font-medium capitalize text-primary">
                  {displaySpecies.category}
                </Text>
              </View>
              {displaySpecies.conservationStatus && (
                <View className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Text className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    {displaySpecies.conservationStatus}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">
              {t('wildlife.description')}
            </Text>
            <Text className="text-base text-foreground leading-6">
              {displaySpecies.description}
            </Text>
          </View>

          {/* Characteristics */}
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
              {t('wildlife.characteristics')}
            </Text>
            {displaySpecies.characteristics.map((c) => (
              <View key={c} className="flex-row items-start mb-2">
                <View className="w-1.5 h-1.5 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                <Text className="text-sm text-foreground flex-1 capitalize">{c}</Text>
              </View>
            ))}
          </View>

          {/* Habitat */}
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
              {t('wildlife.habitat')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {displaySpecies.habitat.map((h) => (
                <View key={h} className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-sm text-primary capitalize">{h}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Interesting Facts */}
          {displaySpecies.interestingFacts && displaySpecies.interestingFacts.length > 0 && (
            <View className="bg-card border border-border rounded-xl p-4 mb-4">
              <Text className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                {t('wildlife.interestingFacts')}
              </Text>
              {displaySpecies.interestingFacts.map((fact) => (
                <View key={fact} className="flex-row items-start mb-2">
                  <Text className="text-primary mr-2 text-base">•</Text>
                  <Text className="text-sm text-foreground flex-1">{fact}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
