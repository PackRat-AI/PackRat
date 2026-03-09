import { Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWildlifeIdentification } from '../hooks/useWildlifeIdentification';
import type { SpeciesIdentification } from '../types';

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const bgColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <View className={`rounded-full px-2 py-0.5 ${bgColor}`}>
      <Text variant="caption2" className="font-semibold text-white">
        {pct}%
      </Text>
    </View>
  );
}

function EdibilityBadge({ edibility }: { edibility?: string }) {
  if (!edibility || edibility === 'unknown') return null;
  const config: Record<string, { bg: string; label: string }> = {
    edible: { bg: 'bg-green-500/20', label: '✓ Edible' },
    poisonous: { bg: 'bg-red-500/20', label: '✗ Poisonous' },
    medicinal: { bg: 'bg-blue-500/20', label: '⚕ Medicinal' },
  };
  const c = config[edibility];
  if (!c) return null;
  return (
    <View className={`rounded-full px-3 py-1 ${c.bg}`}>
      <Text variant="caption1" className="font-medium">
        {c.label}
      </Text>
    </View>
  );
}

function SpeciesResultCard({ species }: { species: SpeciesIdentification }) {
  const { t } = useTranslation();
  return (
    <View className="mb-3 rounded-2xl bg-card p-4 shadow-sm">
      <View className="mb-2 flex-row items-center justify-between">
        <Text variant="headline" className="flex-1 font-semibold" numberOfLines={1}>
          {species.name}
        </Text>
        <ConfidenceBadge confidence={species.confidence} />
      </View>

      <Text variant="subhead" className="mb-2 italic text-muted-foreground">
        {species.scientificName}
      </Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <View className="rounded-full bg-primary/10 px-3 py-1">
          <Text variant="caption1" className="capitalize text-primary">
            {species.category}
          </Text>
        </View>
        <EdibilityBadge edibility={species.edibility} />
      </View>

      {species.edibility && species.edibility !== 'unknown' && (
        <View className="mb-3 rounded-xl bg-yellow-500/10 px-3 py-2">
          <Text variant="caption1" className="text-yellow-700 dark:text-yellow-400">
            ⚠️ {t('wildlife.edibilityDisclaimer')}
          </Text>
        </View>
      )}

      <Text variant="body" className="mb-3 leading-5 text-foreground">
        {species.description}
      </Text>

      {species.habitat && (
        <View className="mb-2 flex-row items-start gap-2">
          <Icon name="map-marker-outline" size={16} color="#6b7280" />
          <Text variant="caption1" className="flex-1 text-muted-foreground">
            {t('wildlife.habitat')}: {species.habitat}
          </Text>
        </View>
      )}

      {species.region && (
        <View className="mb-2 flex-row items-start gap-2">
          <Icon name="earth" size={16} color="#6b7280" />
          <Text variant="caption1" className="flex-1 text-muted-foreground">
            {t('wildlife.region')}: {species.region}
          </Text>
        </View>
      )}

      {species.funFact && (
        <View className="mt-2 rounded-xl bg-primary/5 p-3">
          <Text variant="caption1" className="text-muted-foreground">
            💡 {species.funFact}
          </Text>
        </View>
      )}
    </View>
  );
}

export function WildlifeIdentificationScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { identify, result, isPending, isError, reset } = useWildlifeIdentification();

  const handleIdentify = useCallback(
    (source: 'camera' | 'library') => {
      reset();
      identify(source, {
        onError: (err) => {
          Alert.alert(t('wildlife.identificationFailed'), err.message);
        },
      });
    },
    [identify, reset, t],
  );

  const imageUri = result?.species?.[0]?.imageUri;

  return (
    <View className="flex-1 bg-background">
      <LargeTitleHeader
        title={t('wildlife.wildlifeIdentification')}
        backVisible={false}
        rightView={() => (
          <Pressable className="px-2 opacity-80" onPress={() => router.push('/wildlife/history')}>
            {({ pressed }) => (
              <View className={pressed ? 'opacity-50' : 'opacity-90'}>
                <Icon name="history" size={22} color={colors.foreground} />
              </View>
            )}
          </Pressable>
        )}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Offline indicator */}
        <View className="mb-4 mt-2 flex-row items-center gap-2 rounded-xl bg-green-500/10 px-4 py-3">
          <Icon name="wifi-off" size={16} color="#22c55e" />
          <Text variant="caption1" className="text-green-600 dark:text-green-400">
            {t('wildlife.offlineCapable')}
          </Text>
        </View>

        {/* Camera capture buttons */}
        {!isPending && !result && (
          <View className="mb-6">
            <Text variant="title3" className="mb-4 text-center font-semibold">
              {t('wildlife.capturePhoto')}
            </Text>

            <View className="gap-3">
              <Button onPress={() => handleIdentify('camera')} className="w-full rounded-2xl py-4">
                <View className="flex-row items-center justify-center gap-3">
                  <Icon name="camera" size={20} color="white" />
                  <Text className="text-base font-semibold text-white">
                    {t('wildlife.takePhoto')}
                  </Text>
                </View>
              </Button>

              <Button
                variant="secondary"
                onPress={() => handleIdentify('library')}
                className="w-full rounded-2xl py-4"
              >
                <View className="flex-row items-center justify-center gap-3">
                  <Icon name="image-outline" size={20} color={colors.primary} />
                  <Text className="text-base font-semibold text-primary">
                    {t('wildlife.chooseFromLibrary')}
                  </Text>
                </View>
              </Button>
            </View>

            <Text variant="caption1" className="mt-4 text-center text-muted-foreground">
              {t('wildlife.photoTip')}
            </Text>
          </View>
        )}

        {/* Loading state */}
        {isPending && (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text variant="body" className="mt-4 text-muted-foreground">
              {t('wildlife.analyzing')}
            </Text>
            <Text variant="caption1" className="mt-1 text-muted-foreground">
              {t('wildlife.processingOnDevice')}
            </Text>
          </View>
        )}

        {/* Error state */}
        {isError && (
          <View className="items-center justify-center py-8">
            <Icon name="alert-circle-outline" size={48} color={colors.destructive} />
            <Text variant="body" className="mt-3 text-destructive">
              {t('wildlife.identificationFailed')}
            </Text>
            <Button variant="secondary" onPress={reset} className="mt-4">
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        )}

        {/* Results */}
        {result && !isPending && (
          <View>
            {imageUri && (
              <View className="mb-4 overflow-hidden rounded-2xl">
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: 220 }}
                  contentFit="cover"
                />
              </View>
            )}

            <View className="mb-3 flex-row items-center justify-between">
              <Text variant="title3" className="font-semibold">
                {t('wildlife.identificationResults')}
              </Text>
              <View className="flex-row items-center gap-1">
                <Icon name="chip" size={14} color="#22c55e" />
                <Text variant="caption1" className="text-green-600 dark:text-green-400">
                  {t('wildlife.onDevice')}
                  {result.processingTimeMs > 0 &&
                    ` · ${(result.processingTimeMs / 1000).toFixed(1)}s`}
                </Text>
              </View>
            </View>

            {result.species.map((species) => (
              <SpeciesResultCard key={species.id} species={species} />
            ))}

            <Button
              variant="secondary"
              onPress={() => {
                reset();
              }}
              className="mt-2 w-full rounded-2xl"
            >
              <View className="flex-row items-center justify-center gap-2">
                <Icon name="camera-plus-outline" size={18} color={colors.primary} />
                <Text className="font-medium text-primary">{t('wildlife.identifyAnother')}</Text>
              </View>
            </Button>
          </View>
        )}

        {/* Tips section when idle */}
        {!isPending && !result && (
          <View className="mt-4">
            <Text variant="subhead" className="mb-3 font-semibold text-muted-foreground">
              {t('wildlife.tipsTitle')}
            </Text>
            {(['tip1', 'tip2', 'tip3'] as const).map((key) => (
              <View key={key} className="mb-2 flex-row items-start gap-2">
                <Icon name="check-circle-outline" size={16} color={colors.primary} />
                <Text variant="caption1" className="flex-1 text-muted-foreground">
                  {t(`wildlife.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
