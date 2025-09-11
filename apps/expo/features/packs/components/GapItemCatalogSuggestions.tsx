import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import axiosInstance from 'expo-app/lib/api/client';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';

interface GapItemCatalogSuggestionsProps {
  visible: boolean;
  onClose: () => void;
  gapItem: GapAnalysisItem;
  onItemsSelected: (items: CatalogItem[]) => void;
}

export function GapItemCatalogSuggestions({
  visible,
  onClose,
  gapItem,
  onItemsSelected,
}: GapItemCatalogSuggestionsProps) {
  const { colors } = useColorScheme();
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const fetchCatalogSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      // Use vector search to find relevant catalog items
      const response = await axiosInstance.post('/api/catalog/vector-search', {
        query: `${gapItem.suggestion} ${gapItem.category || ''} hiking outdoor gear`,
        limit: 6,
      });
      setSuggestions(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch catalog suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [gapItem.suggestion, gapItem.category]);

  useEffect(() => {
    if (visible && gapItem) {
      fetchCatalogSuggestions();
    }
  }, [visible, gapItem, fetchCatalogSuggestions]);

  const toggleItemSelection = (itemId: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleAddSelected = () => {
    const itemsToAdd = suggestions.filter((item) => selectedItems.has(item.id));
    onItemsSelected(itemsToAdd);
  };

  const formatPrice = (price?: number | null, currency?: string | null) => {
    if (!price) return '';
    return `${currency || '$'}${price.toFixed(2)}`;
  };

  const formatWeight = (weight?: number | null, unit?: string | null) => {
    if (!weight) return '';
    return `${weight}${unit || 'g'}`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border p-4">
          <View className="flex-1">
            <Text className="text-lg font-semibold">Catalog Suggestions</Text>
            <Text className="text-sm text-muted-foreground">{gapItem.suggestion}</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Icon name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView className="flex-1">
          {/* Gap Item Info */}
          <View className="border-b border-border bg-muted p-4">
            <Text className="mb-2 font-medium text-foreground">{gapItem.suggestion}</Text>
            <Text className="text-sm text-muted-foreground">{gapItem.reason}</Text>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator />
              <Text className="mt-4 text-muted-foreground">Finding similar items...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <View className="p-4">
              <Text className="mb-4 text-base font-medium">Top Matches ({suggestions.length})</Text>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  className={`mb-4 rounded-lg border p-4 ${
                    selectedItems.has(item.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                  onPress={() => toggleItemSelection(item.id)}
                >
                  <View className="flex-row gap-3">
                    {/* Image */}
                    {item.images?.[0] ? (
                      <Image
                        source={{ uri: item.images[0] }}
                        className="h-16 w-16 rounded-md bg-muted"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-16 w-16 items-center justify-center rounded-md bg-muted">
                        <Icon name="image" size={24} color={colors.foreground} />
                      </View>
                    )}

                    {/* Content */}
                    <View className="flex-1">
                      <Text className="font-medium text-foreground" numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.brand && (
                        <Text className="text-sm text-muted-foreground">{item.brand}</Text>
                      )}

                      <View className="mt-2 flex-row items-center gap-4">
                        {item.price && (
                          <Text className="text-sm font-medium text-foreground">
                            {formatPrice(item.price, item.currency)}
                          </Text>
                        )}
                        {item.weight && (
                          <Text className="text-sm text-muted-foreground">
                            {formatWeight(item.weight, item.weightUnit)}
                          </Text>
                        )}
                        {item.ratingValue && (
                          <View className="flex-row items-center gap-1">
                            <Icon name="star" size={12} color={colors.yellow} />
                            <Text className="text-sm text-muted-foreground">
                              {item.ratingValue.toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Selection indicator */}
                    <View className="items-center justify-center">
                      {selectedItems.has(item.id) ? (
                        <Icon name="check-circle" size={24} color={colors.primary} />
                      ) : (
                        <Icon name="circle" size={24} color={colors.border} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <Icon name="search" size={48} color={colors.foreground} />
              <Text className="mt-4 text-center font-medium text-foreground">No Items Found</Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                No catalog items found for "{gapItem.suggestion}". Try browsing manually.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {suggestions.length > 0 && (
          <View className="border-t border-border p-4">
            <Button
              onPress={handleAddSelected}
              disabled={selectedItems.size === 0}
              className="w-full"
            >
              <Icon name="plus" size={16} />
              <Text>
                Add {selectedItems.size > 0 ? `${selectedItems.size} ` : ''}Selected Items
              </Text>
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
