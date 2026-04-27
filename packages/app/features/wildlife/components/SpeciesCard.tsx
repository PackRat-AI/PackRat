import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';
import type { IdentificationResult } from '../types';

interface SpeciesCardProps {
  result: IdentificationResult;
  onPress?: () => void;
}

const DANGER_COLORS = {
  safe: 'bg-green-100 dark:bg-green-900/30',
  caution: 'bg-yellow-100 dark:bg-yellow-900/30',
  dangerous: 'bg-red-100 dark:bg-red-900/30',
} as const;

const DANGER_TEXT_COLORS = {
  safe: 'text-green-700 dark:text-green-400',
  caution: 'text-yellow-700 dark:text-yellow-400',
  dangerous: 'text-red-700 dark:text-red-400',
} as const;

export function SpeciesCard({ result, onPress }: SpeciesCardProps) {
  const { t } = useTranslation();
  const { species, confidence, source } = result;

  const confidencePercent = Math.round(confidence * 100);

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-xl p-4 mb-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-foreground">{species.commonName}</Text>
          <Text className="text-sm italic text-muted-foreground">{species.scientificName}</Text>
        </View>
        {confidence > 0 && (
          <View className="items-end">
            <Text className="text-sm font-medium text-primary">{confidencePercent}%</Text>
            <Text className="text-xs text-muted-foreground">{t(`wildlife.source.${source}`)}</Text>
          </View>
        )}
      </View>

      <Text className="text-sm text-muted-foreground mb-3" numberOfLines={2}>
        {species.description}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        <View className={`px-2 py-0.5 rounded-full ${DANGER_COLORS[species.dangerLevel]}`}>
          <Text
            className={`text-xs font-medium capitalize ${DANGER_TEXT_COLORS[species.dangerLevel]}`}
          >
            {t(`wildlife.dangerLevel.${species.dangerLevel}`)}
          </Text>
        </View>
        <View className="px-2 py-0.5 rounded-full bg-primary/10">
          <Text className="text-xs font-medium capitalize text-primary">
            {t(`wildlife.category.${species.category}`)}
          </Text>
        </View>
        {species.conservationStatus && (
          <View className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Text className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {species.conservationStatus}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
