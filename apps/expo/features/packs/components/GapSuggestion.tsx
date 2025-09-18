import { Button, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useVectorSearch } from 'expo-app/features/catalog/hooks/useVectorSearch';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useState } from 'react';
import { View } from 'react-native';
import type { GapAnalysisItem } from '../hooks';
import { useAddCatalogItem } from '../hooks';
import { GapItemCatalogSuggestions } from './GapItemCatalogSuggestions';

interface GapSuggestionProps {
  gap: GapAnalysisItem;
  packId: string;
}

export function GapSuggestion({ gap, packId }: GapSuggestionProps) {
  const { isDarkColorScheme, colors } = useColorScheme();
  const [isAddressed, setIsAddressed] = useState(false);
  const [vectorQuery, setVectorQuery] = useState('');
  const { addItemToPack, isLoading: isAdding } = useAddCatalogItem();
  const [catalogSuggestionsModalVisible, setCatalogSuggestionsModalVisible] = useState(false);

  const { data, isLoading, refetch } = useVectorSearch({
    query: vectorQuery,
    limit: 6,
  });

  const handleAddItem = async (item: CatalogItem) => {
    await addItemToPack(packId, item, {
      consumable: gap.consumable,
      worn: gap.worn,
    });
    setCatalogSuggestionsModalVisible(false);
    setIsAddressed(true);
    setVectorQuery('');
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'must-have':
        return isDarkColorScheme ? '#ef4444' : colors.destructive;
      case 'nice-to-have':
        return colors.yellow;
      case 'optional':
        return colors.primary;
      default:
        return colors.grey2;
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'must-have':
        return {
          ios: { name: 'exclamationmark.triangle.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'alert-circle' as const,
          },
        };
      case 'nice-to-have':
        return {
          ios: { name: 'star.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'star' as const,
          },
        };
      case 'optional':
        return {
          ios: { name: 'circle.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'circle' as const,
          },
        };
      default:
        return {
          ios: { name: 'circle' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'circle-outline' as const,
          },
        };
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'must-have':
        return 'Must-Have';
      case 'nice-to-have':
        return 'Nice-to-Have';
      case 'optional':
        return 'Optional';
      default:
        throw new Error('Unknown priority level');
    }
  };

  return (
    <>
      <View className="mb-4 justify-between rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-start gap-2">
          <Text className="font-medium text-foreground flex-1">{gap.suggestion}</Text>
          {gap.priority && (
            <View>
              <View className="flex-row self-end items-center gap-2 rounded-full border border-border bg-transparent px-2 py-0.5">
                <Icon
                  {...getPriorityIcon(gap.priority)}
                  size={14}
                  color={getPriorityColor(gap.priority)}
                />
                <Text
                  className="text-xs font-medium"
                  style={{ color: getPriorityColor(gap.priority) }}
                >
                  {getPriorityLabel(gap.priority)}
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">{gap.reason}</Text>
        <Button
          onPress={() => {
            console.log('Searching for gear with query:', gap.suggestion);
            setVectorQuery(gap.suggestion);
            setCatalogSuggestionsModalVisible(true);
          }}
          className="self-end mr-1 mt-2"
          variant="secondary"
          disabled={isAddressed}
        >
          <Text className="text-base">{isAddressed ? 'Added' : 'Find Gear'}</Text>
        </Button>
      </View>

      {catalogSuggestionsModalVisible && (
        <GapItemCatalogSuggestions
          visible={catalogSuggestionsModalVisible}
          suggestions={data?.items}
          isLoading={isLoading}
          isAdding={isAdding}
          onRetry={refetch}
          onClose={() => setCatalogSuggestionsModalVisible(false)}
          gapItem={gap}
          onAddItem={handleAddItem}
        />
      )}
    </>
  );
}
