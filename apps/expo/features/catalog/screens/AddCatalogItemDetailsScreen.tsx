'use client';

import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useCreatePackItem, usePackDetailsFromStore } from 'expo-app/features/packs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { ErrorScreen } from 'expo-app/screens/ErrorScreen';
import type { WeightUnit } from 'expo-app/types';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useCatalogItemDetails } from '../hooks';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { cacheCatalogItemImage } from '../lib/cacheCatalogItemImage';

export function AddCatalogItemDetailsScreen() {
  const router = useRouter();
  const { catalogItemId, packId } = useLocalSearchParams();
  const {
    data: catalogItem,
    isLoading: isLoadingItem,
    isError,
    refetch,
  } = useCatalogItemDetails(catalogItemId as string);
  const pack = usePackDetailsFromStore(packId as string);
  const createItem = useCreatePackItem();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [isConsumable, setIsConsumable] = useState(false);
  const [isWorn, setIsWorn] = useState(false);
  const [category, setCategory] = useState('');

  const { colors } = useColorScheme();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Reset form when catalog item changes
  useEffect(() => {
    if (catalogItem) {
      setQuantity('1');
      setNotes('');
      setIsConsumable(false);
      setIsWorn(false);
      setCategory('');
    }
  }, [catalogItem]);

  const handleAddToPack = async () => {
    assertDefined(catalogItem);
    assertDefined(packId);

    let imageFileName = null;
    if (catalogItem.images) {
      try {
        const imageUrl = Array.isArray(catalogItem.images)
          ? catalogItem.images[0]
          : catalogItem.images;

        if (imageUrl) {
          imageFileName = await ImageCacheManager.cacheRemoteImage(imageUrl);
        }
      } catch (error) {
        console.error('Error caching image:', error);
      }
    }
    setIsAdding(true);
    
    const cachedImageFilename = await cacheCatalogItemImage(catalogItem.images?.[0]);

    createItem({
      packId: packId as string,
      itemData: {
        name: catalogItem.name,
        description: catalogItem.description ?? undefined,
        weight: catalogItem.weight || 0,
        weightUnit: (catalogItem.weightUnit ?? 'g') as WeightUnit,
        quantity: Number.parseInt(quantity, 10) || 1,
        category,
        consumable: isConsumable,
        worn: isWorn,
        notes,
        image: imageFileName,
        catalogItemId: catalogItem.id,
      },
    });
    setIsAdding(false);
    // Navigate back to the catalog item detail screen
    router.dismissTo({
      pathname: '/catalog/[id]',
      params: { id: catalogItemId as string },
    });
  };

  if (isLoadingItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="text-primary" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <ErrorScreen
        title="Error fetching item"
        message="Please try again."
        onRetry={refetch}
        variant="destructive"
      />
    );
  }

  assertDefined(catalogItem);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <SafeAreaView className="flex-1">
        <Animated.View style={{ opacity: fadeAnim }} className="flex-1">
          <ScrollView className="flex-1">
            <View className="mb-6 rounded-lg bg-card p-4 shadow-sm">
              <Text className="mb-2 text-xl font-semibold text-foreground">{catalogItem.name}</Text>
              <Text className="mb-4 text-muted-foreground">{catalogItem.description}</Text>
              <View className="flex-row gap-4">
                <View className="flex-row items-center">
                  <Icon name="dumbbell" size={16} color={colors.grey} />
                  <Text className="ml-1 text-muted-foreground">
                    {catalogItem.weight} {catalogItem.weightUnit}
                  </Text>
                </View>
                {catalogItem.brand && (
                  <View>
                    <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">{catalogItem.brand}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Selected Pack */}
            <View className="mt-6 border-b border-border bg-card px-4 py-3">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted-foreground">Selected Pack</Text>
                  <Text className="text-base font-medium text-foreground">{pack.name}</Text>
                  <View className="mt-1 flex-row items-center">
                    <Icon name="basket-outline" size={14} color={colors.grey} />
                    <Text className="ml-1 text-xs text-muted-foreground">
                      {pack.items.length} {pack.items.length === 1 ? 'item' : 'items'}
                    </Text>
                    <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                    <Text className="text-xs capitalize text-muted-foreground">
                      {pack.category}
                    </Text>
                  </View>
                </View>
                <Button
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/catalog/add-to-pack',
                      params: { catalogItemId },
                    })
                  }
                  disabled={isAdding}
                >
                  <Text className="font-normal">Change</Text>
                </Button>
              </View>
            </View>

            {/* Item Details Form */}
            <View className="p-4">
              <View className="rounded-lg bg-card p-4 shadow-sm">
                <View className="mb-4">
                  <Text className="mb-1 text-sm font-medium text-foreground">Quantity</Text>
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      className="items-center justify-center rounded-l-md border border-r-0 border-border bg-card px-3 py-2"
                      onPress={() =>
                        setQuantity((prev) => Math.max(1, Number.parseInt(prev, 10) - 1).toString())
                      }
                    >
                      <Icon name="minus" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TextInput
                      className="flex-1 border-y border-border bg-background px-3 py-2 text-center text-foreground"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      className="items-center justify-center rounded-r-md border border-l-0 border-border bg-card px-3 py-2"
                      onPress={() =>
                        setQuantity((prev) => (Number.parseInt(prev, 10) + 1).toString())
                      }
                    >
                      <Icon name="plus" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="mb-1 text-sm font-medium text-foreground">Notes</Text>
                  <TextInput
                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add any notes about this item..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View className="mb-4">
                  <Text className="mb-1 text-sm font-medium text-foreground">Category</Text>
                  <TextInput
                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Category (e.g., Shelter, Cooking)"
                  />
                </View>

                <View className="mb-2 flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-medium text-foreground">Consumable</Text>
                    <Text className="text-xs text-muted-foreground">
                      Item will be consumed during trip
                    </Text>
                  </View>
                  <Switch value={isConsumable} onValueChange={setIsConsumable} />
                </View>

                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-medium text-foreground">Worn</Text>
                    <Text className="text-xs text-muted-foreground">
                      Item will be worn, not carried
                    </Text>
                  </View>
                  <Switch value={isWorn} onValueChange={setIsWorn} />
                </View>
              </View>

              <View className="mb-2 mt-6">
                <Button onPress={handleAddToPack} disabled={isAdding}>
                  {isAdding ? (
                    <ActivityIndicator color={colors.foreground} />
                  ) : (
                    <Text>Add to Pack</Text>
                  )}
                </Button>
              </View>

              <View>
                <Button variant="secondary" onPress={() => router.back()} disabled={isAdding}>
                  <Text>Cancel</Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
