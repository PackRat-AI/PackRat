'use client';

import { Button } from '@packrat/ui/nativewindui/Button';
import { SearchInput } from '@packrat/ui/nativewindui/SearchInput';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon } from '@roninoss/icons';
import { usePacks } from 'expo-app/features/packs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { Pack } from 'expo-app/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, FlatList, Image, SafeAreaView, TouchableOpacity, View } from 'react-native';
import { useCatalogItemDetails } from '../hooks';

export function PackSelectionScreen() {
  const router = useRouter();
  const { catalogItemId } = useLocalSearchParams();
  const packs = usePacks();
  const { data: catalogItem, isLoading: isLoadingItem } = useCatalogItemDetails(
    catalogItemId as string,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPacks, setFilteredPacks] = useState<Pack[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const { colors } = useColorScheme();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (packs) {
      if (searchQuery.trim() === '') {
        setFilteredPacks(packs);
      } else {
        const query = searchQuery.toLowerCase();
        setFilteredPacks(
          packs.filter(
            (pack) =>
              pack.name.toLowerCase().includes(query) ||
              pack.description.toLowerCase().includes(query) ||
              pack.category.toLowerCase().includes(query),
          ),
        );
      }
    }
  }, [packs, searchQuery]);

  const handlePackSelect = (packId: string) => {
    router.push({
      pathname: '/catalog/add-to-pack/details',
      params: { catalogItemId, packId },
    });
  };

  const handleCreatePack = () => {
    router.push('/pack/new');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Animated.View style={{ opacity: fadeAnim }} className="flex-1">
        {catalogItem && (
          <View className="border-b border-border bg-card px-4 py-3">
            <View className="flex-row items-center">
              <Image
                source={{ uri: catalogItem.image }}
                className="h-16 w-16 rounded-md"
                resizeMode="cover"
              />
              <View className="ml-3 flex-1">
                <Text variant="subhead">Adding</Text>
                <Text variant="title3" color="primary">
                  {catalogItem.name}
                </Text>
                <View className="mt-1 flex-row items-center">
                  <Icon name="dumbbell" size={14} color={colors.grey2} />
                  <Text variant="caption2" className="ml-1">
                    {catalogItem.defaultWeight} {catalogItem.weightUnit}
                  </Text>
                  {catalogItem.brand && (
                    <>
                      <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                      <Text variant="caption2">{catalogItem.brand}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="p-4">
          <View className="mb-4">
            <SearchInput
              textContentType="none"
              autoComplete="off"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredPacks && filteredPacks.length > 0 ? (
            <>
              <Text variant="subhead" color="primary" className="mb-2">
                Select a pack ({filteredPacks.length} available)
              </Text>
              <FlatList
                data={filteredPacks}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="mb-3 overflow-hidden rounded-lg bg-card shadow-sm"
                    onPress={() => handlePackSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <View className="p-4 py-8">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 gap-4">
                          <Text variant="title3" color="primary">
                            {item.name}
                          </Text>
                          <View className="mt-1 flex-row flex-wrap items-center">
                            <View className="mr-3 flex-row items-center">
                              <Icon name="basket-outline" size={14} color={colors.grey2} />
                              <Text variant="caption2" className="ml-1">
                                {item.items?.length} {item.items?.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>
                            <View className="mr-3 flex-row items-center">
                              <Icon name="dumbbell" size={14} color={colors.grey2} />
                              <Text variant="caption2" className="ml-1">
                                {item.baseWeight?.toFixed(2)} g
                              </Text>
                            </View>
                            <View className="flex-row items-center">
                              <Icon name="tag-outline" size={14} color={colors.grey2} />
                              <Text variant="caption2" className="ml-1 capitalize">
                                {item.category}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Icon name="chevron-right" size={20} color={colors.grey2} />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View className="items-center justify-center py-8">
                    <Text variant="body" className="text-center">
                      No packs found
                    </Text>
                  </View>
                }
              />
            </>
          ) : (
            <View className="items-center justify-center rounded-lg bg-card p-8 shadow-sm">
              <Icon name="backpack-outline" size={48} color="text-muted-foreground" />
              <Text variant="title3" color="primary" className="mt-4 text-center">
                No packs available
              </Text>
              <Text variant="body" className="mb-4 text-center">
                Create a pack to add items to it
              </Text>
              <Button onPress={handleCreatePack}>
                <Icon
                  name="add-outline"
                  size={18}
                  color="text-primary-foreground"
                  className="mr-1"
                />
                <Text variant="body" color="primary">
                  Create Pack
                </Text>
              </Button>
            </View>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
