import { useActionSheet } from '@expo/react-native-action-sheet';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { ErrorState } from 'expo-app/components/ErrorState';
import { type SelectedImage, useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertNonNull } from 'expo-app/utils/typeAssertions';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { CatalogItem } from '../../catalog/types';
import { HorizontalCatalogItemCard } from '../components/HorizontalCatalogItemCard';
import { useBulkAddCatalogItems } from '../hooks';
import { useImageDetection } from '../hooks/useImageDetection';

export function ItemsScanScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { packId, ...fileInfo } = useLocalSearchParams();
  const { selectedImage, pickImage, takePhoto } = useImagePicker(fileInfo as SelectedImage);
  const { showActionSheetWithOptions } = useActionSheet();
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<number>>(new Set());

  const { mutate: scanImage, isPending: isScanning, data } = useImageDetection();
  const { addItemsToPack } = useBulkAddCatalogItems();

  const handleAnalyzeImage = useCallback(async () => {
    assertNonNull(selectedImage);
    scanImage({
      selectedImage,
      matchLimit: 1,
    });

    setSelectedCatalogItems(new Set()); // Reset selection when analyzing new image
  }, [selectedImage, scanImage]);

  useEffect(() => {
    handleAnalyzeImage();
  }, []);

  const handleAddImage = () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
      },
      async (selectedIndex) => {
        try {
          switch (selectedIndex) {
            case 0: {
              // Take Photo
              await takePhoto();
              break;
            }
            case 1: {
              // Choose from Library
              await pickImage();
              break;
            }
            case cancelButtonIndex:
              // Canceled
              return;
          }
          handleAnalyzeImage();
        } catch (err) {
          console.error('Error handling image:', err);
          appAlert.current?.alert({
            title: 'Error',
            message: 'Failed to process image. Please try again.',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        }
      },
    );
  };

  const handleCatalogItemToggle = (item: CatalogItem) => {
    const newSelected = new Set(selectedCatalogItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedCatalogItems(newSelected);
  };

  // Get all catalog items from analysis results with their similarity scores
  const allCatalogItems: (CatalogItem & { similarity: number })[] =
    data?.flatMap((item) =>
      item.catalogMatches.map((match) => ({
        ...match,
        similarity: match.similarity * item.detected.confidence,
      })),
    ) || [];

  // Get unique catalog items (in case same item matches multiple detections)
  const uniqueCatalogItems = allCatalogItems.reduce(
    (acc, item) => {
      const existing = acc.find((existing) => existing.id === item.id);
      if (!existing || item.similarity > existing.similarity) {
        acc = acc.filter((existing) => existing.id !== item.id);
        acc.push(item);
      }
      return acc;
    },
    [] as (CatalogItem & { similarity: number })[],
  );

  const selectedCatalogItemsList = uniqueCatalogItems.filter((item) =>
    selectedCatalogItems.has(item.id),
  );

  const handleCatalogItemsSelected = async () => {
    router.back();
    await addItemsToPack(packId as string, selectedCatalogItemsList);
    Toast.show({
      type: 'success',
      text1: `Added ${selectedCatalogItemsList.length} items to your pack`,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Scan Items from Photo',
          headerBackVisible: true,
        }}
      />

      <View className="flex-row items-center justify-between bg-card px-4 py-2 border border-border rounded-md">
        <Image
          source={{ uri: (selectedImage as SelectedImage).uri }}
          className="h-24 w-24 rounded-lg"
          resizeMode="cover"
        />
        <Button variant="secondary" onPress={handleAddImage}>
          <Text>Change</Text>
        </Button>
      </View>

      <ScrollView className="flex-1 bg-background">
        {isScanning ? (
          <View className="items-center mt-32 justify-center py-4">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="ml-2 text-muted-foreground">Scanning for items...</Text>
          </View>
        ) : data ? (
          uniqueCatalogItems.length > 0 ? (
            <View className="gap-2 p-4">
              <Text variant="footnote">Identified {uniqueCatalogItems.length} items</Text>
              {uniqueCatalogItems.map((item) => (
                <HorizontalCatalogItemCard
                  key={item.id}
                  item={item}
                  selected={selectedCatalogItems.has(item.id)}
                  onSelect={handleCatalogItemToggle}
                />
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <View className="items-center mb-8">
                <View className="bg-muted rounded-full p-6 mb-4">
                  <Icon name="search" size={48} color={colors.muted_foreground} />
                </View>
                <Text className="text-xl font-semibold text-center mb-2">No Items Found</Text>
                <Text className="text-center text-muted-foreground text-base leading-6">
                  We couldn't identify any outdoor gear in this photo. Try taking a clearer image
                  with better lighting.
                </Text>
              </View>

              <View className="w-full space-y-3">
                <Text className="text-sm font-medium text-foreground mb-2">
                  Tips for better scanning:
                </Text>
                <View className="flex-row items-start space-x-3 mb-2">
                  <View className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                    <Icon name="lightbulb" size={12} color={colors.primary} />
                  </View>
                  <Text className="flex-1 text-sm text-muted-foreground">
                    Spread items on a contrasting background
                  </Text>
                </View>
                <View className="flex-row items-start space-x-3 mb-2">
                  <View className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                    <Icon name="sun" size={12} color={colors.primary} />
                  </View>
                  <Text className="flex-1 text-sm text-muted-foreground">
                    Use good lighting (natural light works best)
                  </Text>
                </View>
                <View className="flex-row items-start space-x-3 mb-2">
                  <View className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                    <Icon name="eye" size={12} color={colors.primary} />
                  </View>
                  <Text className="flex-1 text-sm text-muted-foreground">
                    Ensure items are clearly visible and not overlapping
                  </Text>
                </View>
              </View>

              <Button variant="outline" onPress={handleAddImage} className="mt-6 w-full">
                <Icon name="camera" size={16} color={colors.foreground} />
                <Text className="ml-2">Try Another Photo</Text>
              </Button>
            </View>
          )
        ) : (
          <ErrorState
            title="An Error Occured"
            text="Please try again"
            onRetry={handleAnalyzeImage}
            className="mt-36"
          />
        )}
      </ScrollView>
      {/* Action Button */}
      {uniqueCatalogItems && uniqueCatalogItems.length > 0 && (
        <View className="border-t border-border p-4 pb-8">
          <Button
            onPress={handleCatalogItemsSelected}
            disabled={!data || selectedCatalogItems.size === 0}
            className="w-full"
            variant="tonal"
          >
            <Text>
              Add {selectedCatalogItems.size} {selectedCatalogItems.size > 1 ? 'Items' : 'Item'}
            </Text>
          </Button>
        </View>
      )}
    </>
  );
}
