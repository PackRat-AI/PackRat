import { useActionSheet } from '@expo/react-native-action-sheet';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, TextInput, View } from 'react-native';
import { SpeciesCard } from '../components/SpeciesCard';
import { useWildlifeHistory } from '../hooks/useWildlifeHistory';
import { useWildlifeIdentification } from '../hooks/useWildlifeIdentification';
import type { IdentificationResult } from '../types';

export function IdentificationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { selectedImage, pickImage, takePhoto, permanentlyPersistImageLocally } = useImagePicker();
  const { showActionSheetWithOptions } = useActionSheet();
  const [descriptionText, setDescriptionText] = useState('');
  const [savedResults, setSavedResults] = useState<IdentificationResult[] | null>(null);
  const latestSelectedImageUriRef = useRef<string | null>(null);

  useEffect(() => {
    latestSelectedImageUriRef.current = selectedImage?.uri ?? null;
  }, [selectedImage?.uri]);

  const { mutate: identify, isPending, data: results, reset } = useWildlifeIdentification();
  const { addIdentification } = useWildlifeHistory();

  const handleSelectImage = () => {
    const options = [t('wildlife.takePhoto'), t('wildlife.chooseFromLibrary'), t('common.cancel')];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: { backgroundColor: colors.card },
        textStyle: { color: colors.foreground },
      },
      async (selectedIndex) => {
        try {
          let picked: unknown;
          switch (selectedIndex) {
            case 0:
              picked = await takePhoto();
              break;
            case 1:
              picked = await pickImage();
              break;
          }
          // Only clear previous results when a new image was actually selected
          if (picked) {
            reset();
            setSavedResults(null);
          }
        } catch (err) {
          console.error('Error selecting image:', err);
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
    // Capture image URI at request-start time to guard against stale completions
    // if the user changes image before this request resolves.
    const imageUriAtStart = selectedImage.uri;
    identify(
      { selectedImage, offlineQuery: descriptionText.trim() || undefined },
      {
        onSuccess: async (identificationResults) => {
          // Ignore completion if the user has already changed or cleared the image
          if (latestSelectedImageUriRef.current !== imageUriAtStart) return;
          setSavedResults(identificationResults);
          let persistedUri = imageUriAtStart;
          try {
            persistedUri = (await permanentlyPersistImageLocally()) ?? imageUriAtStart;
          } catch (err) {
            console.warn('Failed to persist image locally, using original URI:', err);
          }
          await addIdentification(persistedUri, identificationResults);
        },
      },
    );
  };

  const handleSpeciesPress = (result: IdentificationResult) => {
    router.push({
      pathname: '/wildlife/[id]',
      params: { id: result.species.id },
    });
  };

  const displayResults = results ?? savedResults;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('wildlife.identifySpecies'),
          headerBackVisible: true,
        }}
      />

      <ScrollView className="flex-1 bg-background">
        {/* Image Section */}
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

        {/* Optional description for better offline matching */}
        <View className="mx-4 mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">
            {t('wildlife.describeSpecies')}
          </Text>
          <TextInput
            value={descriptionText}
            onChangeText={setDescriptionText}
            placeholder={t('wildlife.descriptionPlaceholder')}
            placeholderTextColor={colors.grey}
            multiline
            numberOfLines={2}
            className="bg-card border border-border rounded-xl px-3 py-2 text-foreground text-sm"
            style={{ color: colors.foreground, minHeight: 60 }}
          />
        </View>

        {/* Identify Button */}
        {selectedImage && !isPending && (
          <View className="mx-4 mb-4">
            <Button variant="tonal" onPress={handleIdentify} className="w-full">
              <Text>{t('wildlife.identifyNow')}</Text>
            </Button>
          </View>
        )}

        {/* Loading */}
        {isPending && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3 text-muted-foreground">{t('wildlife.identifying')}</Text>
          </View>
        )}

        {/* Results */}
        {displayResults && !isPending && (
          <View className="mx-4 mb-8">
            {displayResults.length > 0 ? (
              <>
                <Text className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {displayResults[0]?.source === 'offline'
                    ? t('wildlife.offlineResults')
                    : t('wildlife.identificationResults')}
                </Text>
                {displayResults.map((result) => (
                  <SpeciesCard
                    key={result.species.id}
                    result={result}
                    onPress={() => handleSpeciesPress(result)}
                  />
                ))}
              </>
            ) : (
              <View className="items-center py-12">
                <View className="bg-primary/10 rounded-full p-5 mb-4">
                  <Icon name="eye" size={40} color={colors.primary} />
                </View>
                <Text className="text-lg font-semibold text-center mb-2">
                  {t('wildlife.noResultsFound')}
                </Text>
                <Text className="text-center text-muted-foreground text-sm">
                  {t('wildlife.noResultsDescription')}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
