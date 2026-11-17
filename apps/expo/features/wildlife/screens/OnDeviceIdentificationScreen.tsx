import { useActionSheet } from '@packrat/ui/src/action-sheet';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SpeciesCard } from '../components/SpeciesCard';
import {
  ON_DEVICE_SPECIES_COUNT,
  type OnDeviceIdentificationState,
  useOnDeviceIdentification,
} from '../hooks/useOnDeviceIdentification';
import { useWildlifeHistory } from '../hooks/useWildlifeHistory';
import { useWildlifeLocation } from '../hooks/useWildlifeLocation';
import type { IdentificationResult } from '../types';

type OutcomeStatus = Exclude<
  OnDeviceIdentificationState['status'],
  'idle' | 'identifying' | 'results'
>;

const OUTCOME_COPY = Object.freeze({
  noConfidentMatch: {
    icon: 'eye',
    title: 'wildlife.onDevice.noConfidentMatchTitle',
    body: 'wildlife.onDevice.noConfidentMatchBody',
  },
  outsideLoadedPacks: {
    icon: 'map-outline',
    title: 'wildlife.onDevice.outsidePacksTitle',
    body: 'wildlife.onDevice.outsidePacksBody',
  },
  modelUnavailable: {
    icon: 'alert-circle-outline',
    title: 'wildlife.onDevice.unavailableTitle',
    body: 'wildlife.onDevice.unavailableBody',
  },
  failed: {
    icon: 'alert-circle-outline',
    title: 'wildlife.onDevice.failedTitle',
    body: 'wildlife.onDevice.failedBody',
  },
} as const satisfies Record<OutcomeStatus, { icon: string; title: string; body: string }>);

function isOutcome(status: OnDeviceIdentificationState['status']): status is OutcomeStatus {
  return status in OUTCOME_COPY;
}

/**
 * Identification with the on-device model. Every photo is answered on the
 * phone first, so the screen works with no signal; the server refines the
 * answer afterwards when it can be reached.
 */
export function OnDeviceIdentificationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { selectedImage, pickImage, takePhoto, permanentlyPersistImageLocally } = useImagePicker();
  const { showActionSheetWithOptions } = useActionSheet();
  const { state, identify, reset } = useOnDeviceIdentification();
  const { addIdentification, updateResults } = useWildlifeHistory();
  const location = useWildlifeLocation(true);
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const handleSelectImage = () => {
    const options = [t('wildlife.takePhoto'), t('wildlife.chooseFromLibrary'), t('common.cancel')];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 2,
        containerStyle: { backgroundColor: colors.card },
        textStyle: { color: colors.foreground },
      },
      async (selectedIndex) => {
        try {
          const picked =
            selectedIndex === 0
              ? await takePhoto()
              : selectedIndex === 1
                ? await pickImage()
                : null;
          if (picked) reset();
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: 'wildlife', action: 'handleSelectImage' },
          });
          appAlert.current?.alert({
            title: t('common.error'),
            message: t('wildlife.failedToSelectImage'),
            buttons: [{ text: t('common.ok'), style: 'default' }],
          });
        }
      },
    );
  };

  const handleIdentify = () => {
    if (!selectedImage) return;
    const imageUriAtStart = selectedImage.uri;
    const fix = locationRef.current;
    let savedId: string | null = null;

    void identify({
      selectedImage,
      region: fix?.region ?? null,
      onResults: async ({ results, phase }) => {
        if (phase === 'refined') {
          if (savedId) updateResults(savedId, results);
          return;
        }
        let persistedUri = imageUriAtStart;
        try {
          persistedUri = (await permanentlyPersistImageLocally()) ?? imageUriAtStart;
        } catch (err) {
          console.warn('Failed to persist image locally, using original URI:', err);
        }
        const entry = await addIdentification({
          imageUri: persistedUri,
          results,
          location: fix ? { latitude: fix.latitude, longitude: fix.longitude } : undefined,
        });
        savedId = entry.id;
      },
    });
  };

  const handleSpeciesPress = (result: IdentificationResult) => {
    router.push({ pathname: '/wildlife/[id]', params: { id: result.species.id } });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('wildlife.identifySpecies'), headerBackVisible: true }} />

      <ScrollView className="flex-1 bg-background">
        <View className="mx-4 mt-4 mb-3">
          {selectedImage ? (
            <View className="relative">
              <Image
                source={{ uri: selectedImage.uri }}
                className="w-full h-56 rounded-xl"
                resizeMode="cover"
              />
              <Button
                variant="secondary"
                onPress={handleSelectImage}
                className="absolute bottom-3 right-3"
              >
                <Text className="text-sm">{t('wildlife.changePhoto')}</Text>
              </Button>
            </View>
          ) : (
            <Button
              testID={testIds.wildlife.addPhotoBtn}
              variant="secondary"
              onPress={handleSelectImage}
              className="h-48 rounded-xl border-dashed border-2 border-border bg-card"
            >
              <View className="items-center gap-2">
                <Icon name="camera-outline" size={32} color={colors.grey} />
                <Text className="text-muted-foreground">{t('wildlife.addPhoto')}</Text>
              </View>
            </Button>
          )}
        </View>

        {state.status === 'idle' && (
          <View className="mx-4 mb-4 gap-1">
            <Text className="text-sm text-muted-foreground" wrap>
              {t('wildlife.onDevice.intro')}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t('wildlife.onDevice.coverage', { count: ON_DEVICE_SPECIES_COUNT })}
            </Text>
          </View>
        )}

        {selectedImage && (state.status === 'idle' || state.status === 'failed') && (
          <View className="mx-4 mb-4">
            <Button
              testID={testIds.wildlife.identifyBtn}
              variant="tonal"
              onPress={handleIdentify}
              className="w-full"
            >
              <Text>{t('wildlife.identifyNow')}</Text>
            </Button>
          </View>
        )}

        {state.status === 'identifying' && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3 text-muted-foreground">{t('wildlife.identifying')}</Text>
          </View>
        )}

        {state.status === 'results' && (
          <View testID={testIds.wildlife.resultsList} className="mx-4 mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {t('wildlife.onDevice.rankedMatches')}
              </Text>
              {state.isRefining && <ActivityIndicator size="small" color={colors.grey} />}
            </View>
            {state.results.map((result, index) => (
              <SpeciesCard
                key={result.species.id}
                testID={testIds.wildlife.resultCard(result.species.id)}
                result={result}
                ranked={{ isTopResult: index === 0 }}
                onPress={() => handleSpeciesPress(result)}
              />
            ))}
            <Text className="text-xs text-muted-foreground mt-1" wrap>
              {t('wildlife.onDevice.ambiguityNote')}
            </Text>
          </View>
        )}

        {isOutcome(state.status) && <OutcomeMessage copy={OUTCOME_COPY[state.status]} />}
      </ScrollView>
    </>
  );
}

function OutcomeMessage({ copy }: { copy: (typeof OUTCOME_COPY)[OutcomeStatus] }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  return (
    <View testID={testIds.wildlife.outcomeMessage} className="items-center px-6 py-12">
      <View className="bg-primary/10 rounded-full p-5 mb-4">
        <Icon name={copy.icon} size={40} color={colors.primary} />
      </View>
      <Text className="text-lg font-semibold text-center mb-2">{t(copy.title)}</Text>
      <Text className="text-center text-muted-foreground text-sm" wrap>
        {t(copy.body)}
      </Text>
    </View>
  );
}
