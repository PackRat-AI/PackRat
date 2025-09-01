import { Text } from '@packrat/ui/nativewindui';
import { CatalogItemCard } from 'expo-app/features/catalog/components';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useRouter } from 'expo-router';
import { Dimensions, ScrollView, View } from 'react-native';
import type { ToolInvocation } from '../types';
import { ToolCard } from './ToolCard';

type CatalogItemsToolOutput =
  | {
      success: true;
      data: {
        items: CatalogItem[];
        total: number;
        limit: number;
        offset: number;
      };
    }
  | {
      success: false;
      error: string;
    };

type CatalogItemsToolInput = {
  query?: string;
  category?: string;
  limit: number;
  offset: number;
};

export type CatalogItemsTool = {
  type: 'tool-getCatalogItems' | 'tool-semanticCatalogSearch';
} & ToolInvocation<CatalogItemsToolInput, CatalogItemsToolOutput>;

interface CatalogItemsGenerativeUIProps {
  toolInvocation: CatalogItemsTool;
}

export function CatalogItemsGenerativeUI({ toolInvocation }: CatalogItemsGenerativeUIProps) {
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;

  const handleItemPress = (catalogItem: CatalogItem) => {
    router.push({
      pathname: '/catalog/[id]',
      params: { id: catalogItem.id },
    });
  };

  switch (toolInvocation.state) {
    case 'input-streaming':
      return <ToolCard text="Initiating catalog search..." icon="loading" />;
    case 'input-available':
      return (
        <ToolCard
          text={
            'query' in toolInvocation.input
              ? `Searching catalog for "${toolInvocation.input.query}"...`
              : 'category' in toolInvocation.input
                ? `Fetching items in category "${toolInvocation.input.category}"...`
                : 'Fetching catalog items...'
          }
          icon="loading"
        />
      );
    case 'output-available': {
      if (!toolInvocation.output.success) {
        return <ToolCard text="Error fetching catalog items" icon="error" />;
      }
      const items = toolInvocation.output.data.items;

      if (items.length === 0) {
        return <ToolCard text="No items found in catalog for your search" icon="info" />;
      }
      return (
        <View>
          {/* Header */}
          <Text variant="callout" className="text-sm text-foreground uppercase" color="secondary">
            Catalog Gears
          </Text>

          {/* Items List */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
            className="max-h-80 rounded-2xl overflow-hidden"
            // pagingEnabled
          >
            <View className="flex-row gap-4">
              {items.map((item, _index) => (
                <View key={item.id} style={{ width: screenWidth - 64 }}>
                  <CatalogItemCard onPress={() => handleItemPress(item)} item={item} />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    case 'output-error':
      return <ToolCard text="Error fetching catalog items" icon="error" />;
    default:
      return null;
  }
}
