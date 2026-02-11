import { Text } from '@packrat/ui/nativewindui';
import { CatalogItemCard } from 'expo-app/features/catalog/components';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
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
  type: 'tool-getCatalogItems' | 'tool-catalogVectorSearch';
} & ToolInvocation<CatalogItemsToolInput, CatalogItemsToolOutput>;

interface CatalogItemsGenerativeUIProps {
  toolInvocation: CatalogItemsTool;
}

export function CatalogItemsGenerativeUI({ toolInvocation }: CatalogItemsGenerativeUIProps) {
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;
  const { t } = useTranslation();

  const handleItemPress = (catalogItem: CatalogItem) => {
    router.push({
      pathname: '/catalog/[id]',
      params: { id: catalogItem.id },
    });
  };

  switch (toolInvocation.state) {
    case 'input-streaming':
      return <ToolCard text={t('ai.tools.initiatingCatalogSearch')} icon="loading" />;
    case 'input-available':
      return (
        <ToolCard
          text={
            'query' in toolInvocation.input
              ? t('ai.tools.searchingCatalogFor', { query: toolInvocation.input.query })
              : 'category' in toolInvocation.input
                ? t('ai.tools.fetchingCategoryItems', { category: toolInvocation.input.category })
                : t('ai.tools.fetchingCatalogItems')
          }
          icon="loading"
        />
      );
    case 'output-available': {
      if (!toolInvocation.output.success) {
        return <ToolCard text={t('ai.tools.errorFetchingCatalog')} icon="error" />;
      }
      const items = toolInvocation.output.data.items;

      if (items.length === 0) {
        return <ToolCard text={t('ai.tools.noItemsFound')} icon="info" />;
      }
      return (
        <View>
          {/* Header */}
          <Text variant="callout" className="text-sm text-foreground uppercase" color="secondary">
            {t('ai.tools.catalogGears')}
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
      return <ToolCard text={t('ai.tools.errorFetchingCatalog')} icon="error" />;
    default:
      return null;
  }
}
