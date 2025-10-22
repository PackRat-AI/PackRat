import { ActivityIndicator, Button, cn, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';
import { HorizontalCatalogItemCard } from './HorizontalCatalogItemCard';

interface GapItemCatalogSuggestionsProps {
  visible: boolean;
  onClose: () => void;
  suggestions?: (CatalogItem & { similarity: number })[];
  isLoading: boolean;
  isAdding: boolean;
  gapItem: GapAnalysisItem;
  onAddItem: (items: CatalogItem) => void;
  onRetry: () => void;
}

export function GapItemCatalogSuggestions({
  visible,
  onClose,
  suggestions,
  isLoading,
  isAdding,
  onRetry,
  gapItem,
  onAddItem,
}: GapItemCatalogSuggestionsProps) {
  const { isDarkColorScheme, colors } = useColorScheme();
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  const handleAddSelected = () => {
    assertDefined(suggestions);
    const itemToAdd = suggestions.find((item) => selectedItem === item.id);
    assertDefined(itemToAdd);
    onAddItem(itemToAdd);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center gap-2 justify-between border-b border-border p-4">
          <View className="flex-1">
            <Text className="text-lg font-semibold">{gapItem.suggestion}</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {gapItem.reason}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Icon name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerClassName={cn(!suggestions && 'flex-1')}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" />
              <Text className="mt-4 text-muted-foreground">Looking up gears...</Text>
            </View>
          ) : suggestions ? (
            suggestions.length > 0 ? (
              <View className="p-4 gap-3">
                {suggestions.map((item) => (
                  <HorizontalCatalogItemCard
                    key={item.id}
                    item={item}
                    onSelect={(item) => setSelectedItem(item.id)}
                    selected={selectedItem === item.id}
                  />
                ))}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-8 mt-32">
                <Icon
                  materialIcon={{ name: 'search', type: 'MaterialIcons' }}
                  ios={{ name: 'magnifyingglass' }}
                  size={48}
                  color={colors.foreground}
                />
                <Text className="mt-4 text-center font-medium text-foreground">No Gears Found</Text>
                <Text className="mt-2 mx-8 text-center text-sm text-muted-foreground">
                  No "{gapItem.suggestion}" gears found.{'\n'} Try browsing manually.
                </Text>
              </View>
            )
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <View className="bg-destructive/10 dark:bg-destructive/90 mb-4 rounded-full p-4">
                <Icon
                  name="exclamation"
                  size={32}
                  color={isDarkColorScheme ? '#ef4444' : colors.destructive}
                />
              </View>
              <Text className="mb-2 text-center text-lg font-medium text-foreground">
                Unable to Load Gears
              </Text>
              <Text className="mb-6 text-center text-sm text-muted-foreground">
                Please try again.
              </Text>
              <Button onPress={onRetry} variant="secondary">
                <Text>Retry</Text>
              </Button>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {suggestions && suggestions.length > 0 && (
          <View className="border-t border-border p-4">
            <Button
              onPress={handleAddSelected}
              disabled={selectedItem === null || isAdding}
              className="w-full"
            >
              {isAdding && <ActivityIndicator size="small" color="#fff" />}
              <Text>{isAdding ? 'Adding...' : 'Add to Pack'}</Text>
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
