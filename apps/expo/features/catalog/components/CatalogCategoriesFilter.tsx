import { Text } from '@packrat/ui/src/text';
import { decodeHtmlEntities } from 'expo-app/lib/utils/decodeHtmlEntities';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useCatalogItemsCategories } from '../hooks/useCatalogItemsCategories';

export function CatalogCategoriesFilter({
  activeFilter,
  onFilter,
}: {
  activeFilter: string;
  onFilter: (filter: string) => void;
}) {
  const { data, isLoading } = useCatalogItemsCategories();

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      onPress={() => onFilter(filter)}
      className={`mr-2 h-8 justify-center rounded-lg border px-4 ${activeFilter === filter ? 'border-transparent bg-secondary' : 'border-border'}`}
    >
      <Text
        className={`text-sm font-medium ${
          activeFilter === filter ? 'text-secondary-foreground' : 'text-muted-foreground'
        }`}
      >
        {decodeHtmlEntities(filter)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="bg-background px-4 py-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <View
                key={i}
                className="h-8 w-20 rounded-lg mr-2 bg-neutral-300 dark:bg-neutral-600 animate-pulse"
              />
            ))
          : /** biome-ignore lint/style/noNonNullAssertion: will always be defined because we return fallback categories on client */
            data!.map(renderFilterChip)}
      </ScrollView>
    </View>
  );
}
